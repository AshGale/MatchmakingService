import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
// import * as Sentry from './instrument.js';
import { logger, requestLogger, errorLogger, setupGlobalErrorHandlers } from './services/logging.js';
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import { securityMiddleware, handleValidationErrors, lobbyValidation, gameValidation, userValidation, matchmakingValidation } from './middleware/security.js';
import { csrfProtection, provideCsrfToken } from './middleware/csrf.js';
import { sanitizeRequestBody } from './utils/sanitize.js';

// Import routes
import authRoutes from './routes/auth.js';
import lobbyRoutes from './routes/lobbies.js';
import gameRoutes from './routes/games.js';
import userRoutes from './routes/users.js';
import matchmakingRoutes from './routes/matchmaking.js';
import invitationRoutes from './routes/invitations.js';

// Create Express app
const app = express();

// Init Sentry request handler (must come before all other middleware)
// app.use(Sentry.Handlers.requestHandler());

// Setup global error handlers for unhandled exceptions and rejections
setupGlobalErrorHandlers();

// Apply comprehensive security middleware
app.use(securityMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      endpoint: req.originalUrl
    });
    res.status(429).json({
      message: 'Too many requests, please try again later.'
    });
  }
});
app.use(limiter);

// Import specialized rate limiters
import * as rateLimiter from './middleware/rateLimiter.js';

// Logging middleware
app.use(requestLogger);
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// CORS middleware with secure configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // In production, restrict to specific origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  credentials: true,
  maxAge: 600 // Cache preflight requests for 10 minutes
}));

// Body parsing middleware - already included in securityMiddleware
// but kept here for clarity
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Add CSRF protection to all non-GET requests
app.use(csrfProtection);

// Add XSS protection by sanitizing all input
app.use(sanitizeRequestBody);

// Routes with validation middleware
app.use('/api/auth', rateLimiter.authLimiter, (req, res, next) => {
  // Add CSRF token on login response
  if (req.path === '/login' || req.path === '/register') {
    res.on('finish', () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        provideCsrfToken(req, res, () => {});
      }
    });
  }
  next();
}, authRoutes);

// Apply validation to lobby routes
app.use('/api/lobbies', rateLimiter.apiLimiter, (req, res, next) => {
  // Apply specific validation based on the route and method
  if (req.method === 'POST' && req.path === '/') {
    lobbyValidation.create.forEach(validator => validator(req, res, next));
  } else if (req.method === 'PUT' && /\/[\w-]+$/.test(req.path)) {
    lobbyValidation.update.forEach(validator => validator(req, res, next));
  } else if (req.method === 'POST' && /\/[\w-]+\/join$/.test(req.path)) {
    lobbyValidation.join.forEach(validator => validator(req, res, next));
  } else if (req.method === 'POST' && /\/[\w-]+\/leave$/.test(req.path)) {
    lobbyValidation.leave.forEach(validator => validator(req, res, next));
  }
  next();
}, handleValidationErrors, lobbyRoutes);

// Apply validation to game routes
app.use('/api/games', rateLimiter.apiLimiter, (req, res, next) => {
  if (req.method === 'POST' && /\/[\w-]+\/move$/.test(req.path)) {
    gameValidation.move.forEach(validator => validator(req, res, next));
  } else if (req.method === 'GET' && /\/[\w-]+$/.test(req.path)) {
    gameValidation.getGame.forEach(validator => validator(req, res, next));
  }
  next();
}, handleValidationErrors, gameRoutes);

// Apply validation to user routes
app.use('/api/users', rateLimiter.apiLimiter, (req, res, next) => {
  if (req.method === 'GET' && /\/[\w-]+$/.test(req.path)) {
    userValidation.getProfile.forEach(validator => validator(req, res, next));
  } else if (req.method === 'PUT' && /\/[\w-]+$/.test(req.path)) {
    userValidation.updateProfile.forEach(validator => validator(req, res, next));
  }
  next();
}, handleValidationErrors, userRoutes);

// Apply validation to matchmaking routes
app.use('/api/matchmaking', rateLimiter.apiLimiter, (req, res, next) => {
  if (req.method === 'POST' && req.path === '/join') {
    matchmakingValidation.join.forEach(validator => validator(req, res, next));
  }
  next();
}, handleValidationErrors, matchmakingRoutes);

// Apply invitation routes
app.use('/api/invitations', rateLimiter.apiLimiter, handleValidationErrors, invitationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Security headers test endpoint
app.get('/security-check', (req, res) => {
  res.status(200).json({ 
    message: 'Security headers check',
    headers: {
      'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
      'X-Frame-Options': res.getHeader('X-Frame-Options'),
      'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
      'X-XSS-Protection': res.getHeader('X-XSS-Protection')
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Sentry error handler - must come before any other error middleware
// app.use(Sentry.Handlers.errorHandler());

// Custom error logger middleware
app.use(errorLogger);

// Regular error handler
app.use(errorHandler);

export default app;