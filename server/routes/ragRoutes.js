const express = require('express');
const router = express.Router();
const ragController = require('../controllers/ragController');
const authMiddleware = require('../middleware/auth');

// Protected RAG routes requiring Firebase user token verification
router.post('/seed', authMiddleware, ragController.seedLegalKnowledge);
router.post('/retrieve', authMiddleware, ragController.retrieveLegalContext);

module.exports = router;
