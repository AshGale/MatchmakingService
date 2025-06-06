const cors = require('cors');

// Configure CORS options based on environment
const configureCors = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Define allowed origins based on environment
  const allowedOrigins = isDevelopment
    ? ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'] // Development origins
    : ['https://game-client.example.com', 'https://admin.example.com']; // Production origins
  
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      if (allowedOrigins.indexOf(origin) !== -1 || isDevelopment) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 86400, // Cache preflight request for 1 day (in seconds)
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  
  return cors(corsOptions);
};

// Middleware for handling preflight requests
const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    // End the request early for preflight
    res.status(204).end();
    return;
  }
  next();
};

module.exports = {
  configureCors,
  handlePreflight
};
