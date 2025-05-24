import logger from '../utils/logger.js';

/**
 * Error handling middleware
 */
export default (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user.id : 'unauthenticated'
  });
  
  // Set appropriate status code
  const statusCode = err.statusCode || 500;
  
  // Send error response
  res.status(statusCode).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : err.message || 'Server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};