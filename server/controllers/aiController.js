const Tesseract = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');
const { uploadToS3 } = require('../utils/s3');
const OriginalDocument = require('../models/OriginalDocument');

const extractText = async (req, res) => {
    let documentId = null;
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // ==========================================
        // STEP 1: DURABLE FILE REGISTRY INTAKE
        // ==========================================
        documentId = uuidv4();
        console.log(`[Registry] Ingesting files under Document ID: ${documentId}`);

        const uploadPromises = req.files.map(async (file, index) => {
            // Upload to S3 (or local disk in fallback mode) with server-side encryption
            const s3Key = await uploadToS3(file.buffer, file.originalname, file.mimetype);

            // Save raw file metadata record to MongoDB
            const originalDoc = new OriginalDocument({
                documentId,
                fileName: file.originalname,
                s3Key,
                mimeType: file.mimetype,
                size: file.size,
                sequenceIndex: index,
                status: 'pending' // Initial status is pending
            });

            return await originalDoc.save();
        });

        // Wait for all uploads and database records to resolve
        await Promise.all(uploadPromises);
        console.log(`[Registry] Durably registered ${req.files.length} file(s) for Document ID: ${documentId}`);

        const firstFile = req.files[0];
        const mimeType = firstFile.mimetype;
        let extractedText = '';
        let aiResult = null;

        if (mimeType === 'application/pdf') {
            if (req.files.length > 1) {
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(400).json({ message: 'Please upload only 1 PDF document at a time.' });
            }
            
            const fileBuffer = firstFile.buffer;
            
            // ==========================================
            // NATIVE-FIRST ROUTING (PDFs -> Python)
            // ==========================================
            try {
                // Send raw file to Python for Native Text Extraction (PyMuPDF)
                const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                const formData = new FormData();
                formData.append('file', blob, firstFile.originalname || 'document.pdf');
                formData.append('source_language', 'auto');

                const aiResponse = await fetch('http://localhost:8000/process-pdf', {
                    method: 'POST',
                    body: formData
                });

                if (aiResponse.status === 422) {
                    // Python detected a scanned PDF (low text density). Fall back to Tesseract OCR!
                    console.log("Python reported Scanned PDF. Falling back to OCR...");
                    const result = await Tesseract.recognize(fileBuffer, 'eng');
                    extractedText = result.data.text;
                    
                    // Route the extracted text via Text-First routing
                    aiResult = await sendTextToPython(extractedText);
                } else if (!aiResponse.ok) {
                    console.error('Python AI Engine error:', aiResponse.statusText);
                    await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                    return res.status(500).json({ message: 'Error processing PDF natively' });
                } else {
                    aiResult = await aiResponse.json();
                }
            } catch (err) {
                console.error("Failed Native PDF processing:", err);
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(500).json({ message: 'AI processing failed natively' });
            }
        } else if (mimeType.startsWith('image/')) {
            // Check if all files are images
            const allImages = req.files.every(f => f.mimetype.startsWith('image/'));
            if (!allImages) {
                await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
                return res.status(400).json({ message: 'Cannot mix PDFs and images. Please upload up to 5 images OR 1 PDF.' });
            }
            
            // Process scanned images using Tesseract OCR concurrently
            console.log(`Processing ${req.files.length} image(s)...`);
            const ocrPromises = req.files.map(file => Tesseract.recognize(file.buffer, 'eng'));
            const results = await Promise.all(ocrPromises);
            
            // Combine extracted text with page separators
            extractedText = results.map((result, idx) => `--- PAGE ${idx + 1} ---\n${result.data.text}`).join('\n\n');
            
            // Route extracted text to Python AI Engine
            aiResult = await sendTextToPython(extractedText);
        } else {
            await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
            return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF or Image(s).' });
        }

        // Update document status in the registry to processed upon success
        await OriginalDocument.updateMany({ documentId }, { status: 'processed' });

        // Respond to frontend with the documentId included
        res.json({ 
            documentId,
            text: aiResult.translated_text || aiResult.text || extractedText,
            original_length: aiResult.original_length || extractedText.length,
            is_anonymized: true,
            classification: aiResult.classification,
            fileCount: req.files.length
        });

    } catch (error) {
        console.error('Error during extraction:', error);
        if (documentId) {
            await OriginalDocument.updateMany({ documentId }, { status: 'failed' });
        }
        res.status(500).json({ message: 'Error processing document', error: error.message });
    }
};

/**
 * Helper function to send OCR-extracted text to Python AI Engine for processing
 */
const sendTextToPython = async (text) => {
    try {
        const aiResponse = await fetch('http://localhost:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text,
                source_language: "auto" 
            })
        });

        if (!aiResponse.ok) {
            console.error('Python AI Engine error:', aiResponse.statusText);
            return { text };
        }

        return await aiResponse.json();
    } catch (aiError) {
        console.error('Failed to connect to Python AI Engine. Ensure it is running on port 8000.', aiError);
        return { text, error: 'AI processing failed' };
    }
};

module.exports = { extractText };
