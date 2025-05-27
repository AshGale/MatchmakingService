// src/utils/sanitize.js
import { escape } from 'html-escaper';

/**
 * HTML-escape potentially unsafe strings to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  return escape(str);
};

/**
 * Recursively sanitize all string values in an object
 * @param {object|array} data - Object or array to sanitize 
 * @returns {object|array} - Sanitized object or array
 */
export const sanitizeObject = (data) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeObject(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item => sanitizeObject(item));
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return typeof data === 'string' ? sanitizeString(data) : data;
};

/**
 * Sanitize request body to prevent XSS
 */
export const sanitizeRequestBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    }
  }
  
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }
  
  next();
};

export default {
  sanitizeString,
  sanitizeObject,
  sanitizeRequestBody
};
