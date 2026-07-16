const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocuments, getDocumentUrls, localViewFile } = require('../controllers/documentController');

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB file size limit per upload
});

// Route for uploading multiple documents/images to be aggregated
router.post('/upload', upload.array('documents', 10), uploadDocuments);

// Route for retrieving secure expiring presigned viewing URLs
router.get('/:documentId/view', getDocumentUrls);

// Route for local fallback view serving (only active when S3 credentials are not set)
router.get('/local-view/:filename', localViewFile);

module.exports = router;
