// src/middleware/csrf.js
import crypto from 'crypto';
import logger from '../utils/logger.js';

// Store for CSRF tokens (in a real app, use Redis or another persistent store)
const tokenStore = new Map();

// Clean up expired tokens periodically (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (value.expires < now) {
      tokenStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Generate a CSRF token for the user session
 */
export const generateToken = (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  tokenStore.set(userId, { token, expires });
  return token;
};

/**
 * CSRF protection middleware
 * Verifies that the CSRF token in the request header matches the one stored for the user
 */
export const csrfProtection = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests (they should be idempotent)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // User must be authenticated for CSRF protection
  if (!req.user || !req.user.id) {
    return next();
  }
  
  const storedToken = tokenStore.get(req.user.id);
  const requestToken = req.headers['x-csrf-token'];
  
  // If no token exists for this user yet, create one
  if (!storedToken) {
    const newToken = generateToken(req.user.id);
    // Set header for the client to use in future requests
    res.setHeader('X-CSRF-Token', newToken);
    return next();
  }
  
  // Token expired
  if (storedToken.expires < Date.now()) {
    const newToken = generateToken(req.user.id);
    res.setHeader('X-CSRF-Token', newToken);
    return next();
  }
  
  // Token missing or doesn't match
  if (!requestToken || requestToken !== storedToken.token) {
    logger.warn('CSRF token validation failed', { 
      userId: req.user.id,
      ip: req.ip,
      path: req.path
    });
    
    return res.status(403).json({ 
      message: 'CSRF token validation failed',
      error: 'Please refresh the page and try again'
    });
  }
  
  // Token is valid
  next();
};

/**
 * Middleware to provide a fresh CSRF token
 * Used on login and initial page loads
 */
export const provideCsrfToken = (req, res, next) => {
  if (req.user && req.user.id) {
    const token = generateToken(req.user.id);
    res.setHeader('X-CSRF-Token', token);
  }
  next();
};

export default {
  csrfProtection,
  provideCsrfToken,
  generateToken
};
