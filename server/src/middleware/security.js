// src/middleware/security.js
import helmet from 'helmet';
import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger.js';

// Create a validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation error', { 
      errors: errors.array(),
      ip: req.ip,
      path: req.path
    });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Common security middleware
export const securityMiddleware = [
  // Set security headers with helmet
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Strict-Transport-Security
    hsts: {
      maxAge: 15552000, // 180 days in seconds
      includeSubDomains: true,
      preload: true,
    },
    // X-Frame-Options
    frameguard: {
      action: 'deny',
    },
    // X-Content-Type-Options
    contentTypeOptions: true,
    // Referrer-Policy
    referrerPolicy: {
      policy: 'same-origin',
    },
  }),
  
  // Limit request body size to prevent DoS attacks
  express.json({ limit: '10kb' }),
  express.urlencoded({ extended: true, limit: '10kb' }),
  
  // Add timestamp for timing attack prevention
  (req, res, next) => {
    req.requestTime = Date.now();
    next();
  },
  
  // Check for suspicious requests
  (req, res, next) => {
    // Check for JSON syntax errors
    if (req.body && Object.keys(req.body).length > 0 && req._body) {
      try {
        JSON.parse(JSON.stringify(req.body));
      } catch (err) {
        logger.warn('Malformed JSON in request', { 
          ip: req.ip, 
          path: req.path,
          error: err.message 
        });
        return res.status(400).json({ message: 'Invalid JSON in request body' });
      }
    }
    
    // Check for suspicious SQL injection patterns in query params
    const suspiciousPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /(union).*(select)/i,
      /exec(\s|\+)+(s|x)p\w+/i
    ];
    
    const checkInput = (input) => {
      if (!input) return false;
      return suspiciousPatterns.some(pattern => pattern.test(input));
    };
    
    // Check query params
    if (req.query) {
      for (const key in req.query) {
        if (checkInput(req.query[key])) {
          logger.warn('Potential SQL injection attempt in query params', { ip: req.ip, path: req.path });
          return res.status(403).json({ message: 'Invalid input detected' });
        }
      }
    }
    
    // Check URL params
    if (req.params) {
      for (const key in req.params) {
        if (checkInput(req.params[key])) {
          logger.warn('Potential SQL injection attempt in URL params', { ip: req.ip, path: req.path });
          return res.status(403).json({ message: 'Invalid input detected' });
        }
      }
    }
    
    next();
  }
];

// Validation rules for different resources
export const lobbyValidation = {
  create: [
    body('name')
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('Lobby name must be between 3 and 50 characters')
      .trim()
      .escape(),
    body('gameType')
      .isString()
      .isIn(['chess', 'checkers', 'tictactoe', 'connect4'])
      .withMessage('Invalid game type'),
    body('maxPlayers')
      .optional()
      .isInt({ min: 2, max: 10 })
      .withMessage('Max players must be between 2 and 10'),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean')
  ],
  update: [
    param('id').isUUID().withMessage('Invalid lobby ID'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('Lobby name must be between 3 and 50 characters')
      .trim()
      .escape(),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean')
  ],
  join: [
    param('id').isUUID().withMessage('Invalid lobby ID')
  ],
  leave: [
    param('id').isUUID().withMessage('Invalid lobby ID')
  ]
};

export const gameValidation = {
  move: [
    param('id').isUUID().withMessage('Invalid game ID'),
    body('move')
      .isObject()
      .withMessage('Move must be an object'),
    body('move.from')
      .optional()
      .isString()
      .withMessage('From position must be a string'),
    body('move.to')
      .optional()
      .isString()
      .withMessage('To position must be a string'),
    body('move.position')
      .optional()
      .isString()
      .withMessage('Position must be a string')
  ],
  getGame: [
    param('id').isUUID().withMessage('Invalid game ID')
  ]
};

export const userValidation = {
  getProfile: [
    param('id').isUUID().withMessage('Invalid user ID')
  ],
  updateProfile: [
    body('displayName')
      .optional()
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('Display name must be between 3 and 50 characters')
      .trim()
      .escape(),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('Avatar URL must be a valid URL')
  ]
};

export const matchmakingValidation = {
  join: [
    body('gameType')
      .isString()
      .isIn(['chess', 'checkers', 'tictactoe', 'connect4'])
      .withMessage('Invalid game type'),
    body('rating')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Rating must be a positive integer')
  ],
  leave: []
};

export const authValidation = {
  register: [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .trim(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  login: [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  refresh: [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  logout: [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ]
};
