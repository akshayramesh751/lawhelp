const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// We can process up to 5 image files or 1 PDF at a time
router.post('/extract', upload.array('documents', 5), aiController.extractText);

module.exports = router;
