// server/src/services/logging.js
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'matchmaking-service' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logDir = path.join(__dirname, '../../logs');
  
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create request logger middleware
const requestLogger = (req, res, next) => {
  // Log request start
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request details
  logger.info({
    message: `${req.method} ${req.originalUrl} started`,
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || 'anonymous'
  });
  
  // Log response on completion
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]({
      message: `${req.method} ${req.originalUrl} completed`,
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
};

// Event logger for application events
const logEvent = (eventName, data = {}) => {
  logger.info({
    message: `Event: ${eventName}`,
    event: eventName,
    ...data
  });
};

// Error logger middleware
const errorLogger = (err, req, res, next) => {
  const requestId = res.getHeader('X-Request-ID') || 'unknown';
  
  logger.error({
    message: `Error: ${err.message}`,
    requestId,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
    userId: req.user?.id || 'anonymous'
  });
  
  next(err);
};

// Security event logger
const logSecurityEvent = (event, details = {}) => {
  logger.warn({
    message: `Security event: ${event}`,
    securityEvent: event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Global unhandled exception logger
const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    logger.error({
      message: 'Uncaught exception',
      error: error.message,
      stack: error.stack
    });
    // Give logger time to flush before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({
      message: 'Unhandled promise rejection',
      reason: reason.toString(),
      stack: reason.stack
    });
  });
};

export {
  logger,
  requestLogger,
  errorLogger,
  logEvent,
  logSecurityEvent,
  setupGlobalErrorHandlers
};
