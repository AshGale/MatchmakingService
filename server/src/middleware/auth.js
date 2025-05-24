import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

/**
 * Authentication middleware
 * Verifies JWT and adds user data to request
 */
export default (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  // Extract token from Bearer format
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user data to request
    req.user = {
      id: decoded.userId,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired', expired: true });
    }
    
    res.status(401).json({ message: 'Token is not valid' });
  }
};