// src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Create a store with sliding window using in-memory cache
// For production, consider using Redis or another persistent store
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { 
        ip: req.ip, 
        path: req.path 
      });
      res.status(429).json({
        message: 'Too many requests, please try again later.'
      });
    }
  };

  return rateLimit({
    ...defaultOptions,
    ...options
  });
};

// Auth routes specific limiter - more strict
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});

// Registration specific limiter
const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  handler: (req, res) => {
    logger.warn('Registration rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      message: 'Too many registration attempts, please try again later.'
    });
  }
});

// Login specific limiter - even more strict
const loginLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 login attempts per hour
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      message: 'Too many login attempts, please try again later.'
    });
  }
});

// API routes general limiter
const apiLimiter = createRateLimiter();

export {
  authLimiter,
  registrationLimiter,
  loginLimiter,
  apiLimiter
};
