// // Initialize Sentry before everything else
// import './instrument.js';

import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { configureWebSockets } from './websockets.js';
import { logger, setupGlobalErrorHandlers } from './services/logging.js';
import { startMonitoring } from './services/monitoring.js';
import db from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Create logs directory if it doesn't exist
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Setup global error handlers
setupGlobalErrorHandlers();

// Validate critical environment variables
const requiredEnvVars = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'JWT_SECRET', 'REFRESH_TOKEN_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length) {
  logger.error({
    message: 'Missing required environment variables',
    missingVars: missingEnvVars.join(', ')
  });
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
    logger.info({ message: 'Database connection successful' });
    
    // Start the server
    server.listen(port, () => {
      logger.info({ 
        message: 'Server started',
        port,
        environment: process.env.NODE_ENV || 'development',
        time: new Date().toISOString()
      });
      
      // Start the monitoring system
      startMonitoring();
    });
  })
  .catch(err => {
    logger.error({
      message: 'Database connection failed',
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });

// Handle graceful shutdown
const shutdown = async () => {
  logger.info({ message: 'Shutting down gracefully...' });
  
  // Close server first to stop accepting new connections
  server.close(async () => {
    logger.info({ message: 'Server closed' });
    
    try {
      // Destroy database connection pool
      await db.destroy();
      logger.info({ message: 'Database connections closed' });
      
      process.exit(0);
    } catch (err) {
      logger.error({
        message: 'Error during shutdown',
        error: err.message,
        stack: err.stack
      });
      process.exit(1);
    }
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error({ message: 'Forced shutdown due to timeout' });
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;