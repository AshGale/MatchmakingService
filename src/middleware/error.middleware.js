const { logger } = require('./logging.middleware');

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  // Set default error status and message
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.details || undefined;

  // Map different error types to appropriate status codes
  const errorResponse = {
    error: message,
    ...(details && { details })
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  // Log error details
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]({
    message: `${err.name || 'Error'}: ${message}`,
    statusCode,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const err = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError
};
