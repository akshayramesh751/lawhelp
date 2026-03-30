const express = require('express');
const router = express.Router();
const { getLawyers, getLawyerById } = require('../controllers/lawyerController');

// GET /api/lawyers
router.get('/', getLawyers);

// GET /api/lawyers/:id
router.get('/:id', getLawyerById);

module.exports = router;
