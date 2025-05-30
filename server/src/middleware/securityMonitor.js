// server/src/middleware/securityMonitor.js
import { logSecurityEvent } from '../services/logging.js';
import rateLimit from 'express-rate-limit';

// Authentication attempt monitor
export const authMonitor = (req, res, next) => {
  const endpoint = req.originalUrl;
  const ip = req.ip;
  const userId = req.body.username || req.body.email || 'unknown';
  
  // Log authentication attempts
  if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
    logSecurityEvent('authentication_attempt', {
      endpoint,
      ip,
      userId,
      method: req.method
    });
  }
  
  next();
};

// Failed authentication monitor
export const failedAuthMonitor = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    const endpoint = req.originalUrl;
    const statusCode = res.statusCode;
    
    // Detect failed authentication
    if ((endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) && 
        (statusCode === 401 || statusCode === 403)) {
      
      const ip = req.ip;
      const userId = req.body.username || req.body.email || 'unknown';
      
      logSecurityEvent('authentication_failed', {
        endpoint,
        ip,
        userId,
        statusCode,
        method: req.method
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Permission changes monitor
export const permissionMonitor = (req, res, next) => {
  const endpoint = req.originalUrl;
  
  // Detect permission or role changes
  if (endpoint.includes('/users/role') || endpoint.includes('/users/permissions')) {
    const ip = req.ip;
    const userId = req.user?.id || 'unknown';
    const targetUserId = req.params.userId || req.body.userId;
    
    logSecurityEvent('permission_change_attempt', {
      endpoint,
      ip,
      userId,
      targetUserId,
      changes: req.body,
      method: req.method
    });
  }
  
  next();
};

// Rate limiting for sensitive endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logSecurityEvent('rate_limit_exceeded', {
      endpoint: req.originalUrl,
      ip: req.ip,
      userId: req.body.username || req.body.email || 'unknown'
    });
    
    res.status(429).json({
      error: 'Too many requests, please try again later'
    });
  }
});

// API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logSecurityEvent('api_rate_limit_exceeded', {
      endpoint: req.originalUrl,
      ip: req.ip,
      userId: req.user?.id || 'unknown'
    });
    
    res.status(429).json({
      error: 'API rate limit exceeded, please try again later'
    });
  }
});

// Suspicious activity detection
export const suspiciousActivityMonitor = (req, res, next) => {
  const endpoint = req.originalUrl;
  const ip = req.ip;
  const userId = req.user?.id || 'unknown';
  
  // List of sensitive operations to monitor
  const sensitiveOperations = [
    '/users/delete',
    '/admin',
    '/settings',
    '/reset-password',
    '/export-data'
  ];
  
  if (sensitiveOperations.some(op => endpoint.includes(op))) {
    logSecurityEvent('sensitive_operation', {
      endpoint,
      ip,
      userId,
      method: req.method,
      body: req.body,
      params: req.params
    });
  }
  
  next();
};
