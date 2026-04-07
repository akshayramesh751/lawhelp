const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');

dotenv.config();

connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for Twilio Webhooks!

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[API CALL] ${req.method} ${req.url}`);
  next();
});

// Route Imports
const lawyerRoutes = require('./routes/lawyerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');

app.get('/', (req, res) => {
  res.send('Server running on port 5000');
});

// Mount Routes
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
