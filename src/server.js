const express = require('express');
const { configureMiddleware, configureErrorHandling } = require('./middleware');
const { logger } = require('./middleware/logging.middleware');

// Import routes
const lobbyRoutes = require('./routes/lobby.routes');
const quickJoinRoutes = require('./routes/quick-join.routes');

// Create Express app
const app = express();

// Configure middleware
configureMiddleware(app);

// Sample route for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Use API routes
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/quick-join', quickJoinRoutes);

// Configure error handling (must be after routes)
configureErrorHandling(app);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Don't crash the server but log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Give the server a grace period to finish current requests
  // then shut down
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = app; // For testing purposes
