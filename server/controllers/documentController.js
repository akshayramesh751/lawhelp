const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const OriginalDocument = require('../models/OriginalDocument');
const { uploadToS3, getPresignedUrl } = require('../utils/s3');

/**
 * Handle document uploads: upload to S3/local and save metadata in MongoDB under a single documentId.
 */
const uploadDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const documentId = uuidv4();
    const uploadPromises = req.files.map(async (file, index) => {
      // 1. Upload file buffer to S3 (or local fallback)
      const s3Key = await uploadToS3(file.buffer, file.originalname, file.mimetype);

      // 2. Save metadata to MongoDB with sequenceIndex for correct ordering
      const originalDoc = new OriginalDocument({
        documentId,
        fileName: file.originalname,
        s3Key,
        mimeType: file.mimetype,
        size: file.size,
        sequenceIndex: index,
        status: 'pending'
      });

      return await originalDoc.save();
    });

    const savedDocs = await Promise.all(uploadPromises);

    res.status(201).json({
      message: 'Documents aggregated and uploaded successfully.',
      documentId,
      fileCount: savedDocs.length,
      documents: savedDocs.map(doc => ({
        id: doc._id,
        fileName: doc.fileName,
        sequenceIndex: doc.sequenceIndex,
        size: doc.size,
        status: doc.status
      }))
    });
  } catch (error) {
    console.error('Error in uploadDocuments:', error);
    res.status(500).json({ error: 'Failed to upload and catalog documents.', details: error.message });
  }
};

/**
 * Retrieve secure temporary presigned links for all files grouped under a documentId.
 */
const getDocumentUrls = async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find all files belonging to this document, sorted by their sequenceIndex
    const docs = await OriginalDocument.find({ documentId }).sort({ sequenceIndex: 1 });

    if (!docs || docs.length === 0) {
      return res.status(404).json({ error: 'Document bundle not found or expired (retention is 30 days).' });
    }

    // Generate presigned URLs for each page/image
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        const tempUrl = await getPresignedUrl(doc.s3Key);
        return {
          fileName: doc.fileName,
          sequenceIndex: doc.sequenceIndex,
          mimeType: doc.mimeType,
          size: doc.size,
          url: tempUrl,
          status: doc.status
        };
      })
    );

    res.json({
      documentId,
      pages: docsWithUrls
    });
  } catch (error) {
    console.error('Error in getDocumentUrls:', error);
    res.status(500).json({ error: 'Failed to retrieve document secure URLs.', details: error.message });
  }
};

/**
 * Fallback controller to serve files locally in offline/development mode.
 */
const localViewFile = async (req, res) => {
  try {
    const { filename } = req.params;
    // Sanitization: Ensure filename contains only valid key characters (no directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(403).json({ error: 'Invalid file access' });
    }

    const filePath = path.join(__dirname, '../uploads', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on local disk.' });
    }

    // Attempt to match Content-Type if we can find it in database, otherwise fallback to octet-stream
    const doc = await OriginalDocument.findOne({ s3Key: `documents/${filename}` });
    const contentType = doc ? doc.mimeType : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc ? doc.fileName : filename}"`);
    
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error in localViewFile:', error);
    res.status(500).json({ error: 'Failed to serve local file.', details: error.message });
  }
};

module.exports = {
  uploadDocuments,
  getDocumentUrls,
  localViewFile
};
