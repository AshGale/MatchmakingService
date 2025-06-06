const winston = require('winston');
const morgan = require('morgan');

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add environment-specific configurations
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Function to mask sensitive data
const maskSensitiveData = (obj) => {
  const masked = { ...obj };
  // Mask sensitive fields if they exist
  if (masked.session_id) masked.session_id = '***MASKED***';
  if (masked.password) masked.password = '***MASKED***';
  // Add more fields to mask as needed
  return masked;
};

// Custom token for morgan to log request body
morgan.token('body', (req) => JSON.stringify(maskSensitiveData(req.body)));
morgan.token('query', (req) => JSON.stringify(req.query));

// Create a request ID for tracking
morgan.token('request-id', () => require('uuid').v4());

// Create middleware
const loggingMiddleware = (req, res, next) => {
  // Start timer
  const start = Date.now();
  
  // Add request ID to the request object for tracking
  req.requestId = require('uuid').v4();
  
  // Log when the request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      query: maskSensitiveData(req.query),
      body: req.method !== 'GET' ? maskSensitiveData(req.body) : undefined
    });
  });

  next();
};

// HTTP request logger middleware using morgan
const httpLogger = morgan(':method :url :status :response-time ms - :body - :query [:request-id]', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
});

module.exports = {
  logger,
  loggingMiddleware,
  httpLogger
};
