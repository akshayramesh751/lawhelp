const { redisClient } = require('../utils/redis');

// Middleware to cache Redis requests
const cacheMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Create a unique key based on the URL and query parameters
  const key = `cache:${req.originalUrl}`;

  // Check if Redis is connected
  if (!redisClient.isReady) {
    return next(); // Fallback if Redis is down
  }

  redisClient.get(key)
    .then((cachedData) => {
      if (cachedData) {
        // Return cached response instantly
        console.log(`[REDIS] CACHE HIT: ${key}`);
        return res.json(JSON.parse(cachedData));
      } else {
        // Not in cache, proceed and intercept the response
        console.log(`[REDIS] CACHE MISS: ${key}`);
        
        // Wrap res.json to store the response in Redis before sending
        const originalJson = res.json.bind(res);
        res.json = (body) => {
          // Cache the response for 3600 seconds (1 hour)
          redisClient.setEx(key, 3600, JSON.stringify(body))
            .catch(err => console.error('Redis Set Error:', err));
            
          originalJson(body);
        };
        next();
      }
    })
    .catch((err) => {
      console.error('Redis Get Error:', err);
      next(); // Continue on error
    });
};

module.exports = cacheMiddleware;
