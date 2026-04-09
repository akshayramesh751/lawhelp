const Lawyer = require('../models/Lawyer');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

const getLawyers = async (req, res) => {
  try {
    const { specialization, city, minRating, maxCost } = req.query;
    
    let query = {};
    if (specialization) query.specializations = { $in: [specialization] };
    if (city) query.city = new RegExp(city, 'i');
    if (minRating) query.rating = { $gte: Number(minRating) };
    if (maxCost) query.cost = { $lte: Number(maxCost) };

    const lawyers = await Lawyer.find(query);
    res.json(lawyers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLawyerById = async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id);
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    
    const reviews = await Review.find({ lawyerId: req.params.id }).populate('userId', 'name');
    
    const confirmedBookings = await Booking.find({ 
       lawyerId: req.params.id, 
       status: 'confirmed' 
    }).select('date timeSlot');
    
    res.json({ lawyer, reviews, confirmedBookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLawyers, getLawyerById };
