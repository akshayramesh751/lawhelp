const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Redis Client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis nicely!'));

// Wrap the connect process so we can await it
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Initial Redis connection failed (is Redis running?):', error);
  }
};

module.exports = {
  redisClient,
  connectRedis
};
