// // Initialize Sentry before everything else
// require('./instrument');

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { configureWebSockets } = require('./websockets');
const logger = require('./utils/logger');
const db = require('./db');

// Validate critical environment variables
const requiredEnvVars = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'JWT_SECRET', 'REFRESH_TOKEN_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create HTTP server
const server = http.createServer(app);

// Configure WebSockets
configureWebSockets(server);

// Set port
const port = process.env.PORT || 3000;

// Test database connection before starting the server
db.raw('SELECT 1')
  .then(() => {
    logger.info('Database connection successful');
    
    // Start the server
    server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  })
  .catch(err => {
    logger.error('Database connection failed', err);
    process.exit(1);
  });

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  // Close server first to stop accepting new connections
  server.close(async () => {
    logger.info('Server closed');
    
    try {
      // Destroy database connection pool
      await db.destroy();
      logger.info('Database connections closed');
      
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = server;