const Review = require('../models/Review');
const Lawyer = require('../models/Lawyer');

const createReview = async (req, res) => {
  try {
    const { bookingId, userId, lawyerId, rating, comment } = req.body;
    
    const review = new Review({
      bookingId,
      userId,
      lawyerId,
      rating,
      comment
    });
    
    const savedReview = await review.save();
    
    // Recalculate lawyer's average rating and total reviews
    const allReviews = await Review.find({ lawyerId });
    const totalReviews = allReviews.length;
    
    const avgRating = totalReviews > 0 
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;
      
    await Lawyer.findByIdAndUpdate(lawyerId, {
      rating: Number(avgRating.toFixed(1)),
      totalReviews
    });
    
    res.status(201).json(savedReview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLawyerReviews = async (req, res) => {
  try {
    const { lawyerId } = req.query;
    if (!lawyerId) return res.status(400).json({ message: 'lawyerId is required' });
    
    const reviews = await Review.find({ lawyerId }).populate('userId', 'name');
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createReview, getLawyerReviews };
