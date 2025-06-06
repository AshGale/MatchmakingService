const helmet = require('helmet');
const express = require('express');
const { errorHandler, notFoundHandler } = require('./error.middleware');
const { loggingMiddleware, httpLogger } = require('./logging.middleware');
const { configureCors, handlePreflight } = require('./cors.middleware');
const { validators } = require('./validation.middleware');

// Configure middleware stack
const configureMiddleware = (app) => {
  // Security middleware (must be at the beginning)
  app.use(helmet());
  
  // CORS middleware
  app.use(configureCors());
  app.use(handlePreflight);
  
  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Logging middleware
  app.use(loggingMiddleware);
  app.use(httpLogger);
  
  return app;
};

// Configure error handling (must be at the end, after routes are defined)
const configureErrorHandling = (app) => {
  // 404 handler for undefined routes
  app.use(notFoundHandler);
  
  // Global error handler
  app.use(errorHandler);
  
  return app;
};

module.exports = {
  configureMiddleware,
  configureErrorHandling,
  validators
};
