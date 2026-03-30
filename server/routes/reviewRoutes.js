const express = require('express');
const router = express.Router();
const { createReview, getLawyerReviews } = require('../controllers/reviewController');

// POST /api/reviews
router.post('/', createReview);

// GET /api/reviews?lawyerId=
router.get('/', getLawyerReviews);

module.exports = router;
