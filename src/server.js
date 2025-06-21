const express = require('express');
const { configureMiddleware, configureErrorHandling } = require('./middleware');
const { logger } = require('./middleware/logging.middleware');

// Database modules
const { checkDatabaseStatus, closePool } = require('./utils/database/pool');
const { createHealthMonitor } = require('./utils/database/health');
const { initializeDatabase } = require('./utils/database/init');
const dbConfig = require('./config/database');

// Import routes
const lobbyRoutes = require('./routes/lobby.routes');
const quickJoinRoutes = require('./routes/quick-join.routes');

// Create Express app
const app = express();

// Configure middleware
configureMiddleware(app);

// Health check endpoint with database status
app.get('/api/health', async (req, res) => {
  try {
    // Basic app health
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      inMemoryMode: dbConfig.isUsingInMemoryStorage()
    };
    
    // Add database status if requested
    if (req.query.db === 'true') {
      health.database = await checkDatabaseStatus();
    }
    
    // Determine overall status
    if (health.database && health.database.status !== 'connected') {
      health.status = 'degraded';
    }
    
    res.json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Use API routes
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/quick-join', quickJoinRoutes);

// Configure error handling (must be after routes)
configureErrorHandling(app);

// Initialize database health monitoring
const dbHealthMonitor = createHealthMonitor({
  intervalMs: 30000, // Check every 30 seconds
  onUnhealthy: (health) => {
    logger.error('Database connection unhealthy:', health.error);
  }
});

// Initialize database before starting server
initializeDatabase()
  .then(dbReady => {
    if (!dbReady) {
      logger.warn('Using in-memory storage mode');
    }
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start database health monitoring if we're not in memory-only mode
      if (!dbConfig.isUsingInMemoryStorage()) {
        dbHealthMonitor.start();
        
        // Do initial database check
        checkDatabaseStatus()
          .then(status => {
            if (status.status === 'connected') {
              logger.info('Database connection established successfully');
            } else {
              logger.warn('Database connection issues detected:', status.error);
            }
          })
          .catch(err => {
            logger.error('Failed to check database status:', err);
          });
      }
    });
    
    // Handle graceful shutdown
    function shutdown() {
      logger.info('Shutting down server...');
      
      // Stop health monitoring
      dbHealthMonitor.stop();
      
      // Close server
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections
        closePool()
          .then(() => {
            logger.info('Database connections closed');
            process.exit(0);
          })
          .catch(err => {
            logger.error('Error closing database connections:', err);
            process.exit(1);
          });
      });
      
      // Force close after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    }
    
    // Handle termination signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch(err => {
    logger.error('Failed to initialize database:', err);
    process.exit(1);
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

// Handle graceful shutdown
function shutdown() {
  logger.info('Shutting down server...');
  
  // Stop health monitoring
  dbHealthMonitor.stop();
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections
    closePool()
      .then(() => {
        logger.info('Database connections closed');
        process.exit(0);
      })
      .catch(err => {
        logger.error('Error closing database connections:', err);
        process.exit(1);
      });
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app; // For testing purposes
