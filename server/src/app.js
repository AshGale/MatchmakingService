import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
// import * as Sentry from './instrument.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import lobbyRoutes from './routes/lobbies.js';
import gameRoutes from './routes/games.js';
import userRoutes from './routes/users.js';

// Create Express app
const app = express();

// Init Sentry request handler (must come before all other middleware)
// app.use(Sentry.Handlers.requestHandler());

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      message: 'Too many requests, please try again later.'
    });
  }
});
app.use(limiter);

// Import specialized rate limiters
import * as rateLimiter from './middleware/rateLimiter.js';

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// CORS middleware
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', rateLimiter.authLimiter, authRoutes);
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// 404 handler
app.use(notFoundHandler);

// Sentry error handler - must come before any other error middleware
// app.use(Sentry.Handlers.errorHandler());

// Regular error handler
app.use(errorHandler);

export default app;