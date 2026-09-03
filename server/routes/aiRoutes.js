const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All AI endpoints require Firebase Token Authentication
router.post('/extract', authMiddleware, upload.array('documents', 5), aiController.extractText);
router.get('/documents', authMiddleware, aiController.getUserDocuments);
router.get('/documents/latest', authMiddleware, aiController.getLatestDocumentSummary);
router.get('/documents/:documentId', authMiddleware, aiController.getDocumentSummary);
router.delete('/documents/:documentId', authMiddleware, aiController.deleteUserDocument);
router.get('/summary/:documentId', authMiddleware, aiController.getDocumentSummary);
router.post('/reprocess/:documentId', authMiddleware, aiController.reprocessDocument);
router.post('/chat/:documentId', authMiddleware, aiController.chatWithDocument);

module.exports = router;
