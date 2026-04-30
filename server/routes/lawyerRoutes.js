const express = require('express');
const router = express.Router();
const { getLawyers, getLawyerById } = require('../controllers/lawyerController');
const cacheMiddleware = require('../middleware/cache');

// GET /api/lawyers
router.get('/', cacheMiddleware, getLawyers);

// GET /api/lawyers/:id
router.get('/:id', getLawyerById);

module.exports = router;
