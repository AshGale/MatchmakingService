const express = require('express');
const { body, validationResult } = require('express-validator');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const router = express.Router();
const UserService = require('../services/userService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const userService = new UserService();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', [
  // Validation
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .trim(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if username already exists
    const existingUser = await userService.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await argon2.hash(password);

    // Create user
    const user = await userService.createUser({
      username,
      password: hashedPassword
    });

    // Create tokens
    const accessToken = generateAccessToken(user.id, username);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    await userService.saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.created_at
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', [
  // Validation
  body('username').trim().not().isEmpty(),
  body('password').not().isEmpty()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Get user
    const user = await userService.findByUsername(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await argon2.verify(user.password, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create tokens
    const accessToken = generateAccessToken(user.id, username);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    await userService.saveRefreshToken(user.id, refreshToken);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ message: 'Server error during login' });
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public (with refresh token)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      // Check if refresh token exists in database
      const storedToken = await userService.findRefreshToken(decoded.userId, refreshToken);
      if (!storedToken) {
        return res.status(403).json({ message: 'Refresh token revoked' });
      }

      // Get user
      const user = await userService.findById(decoded.userId);
      if (!user) {
        return res.status(403).json({ message: 'User not found' });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user.id, user.username);
      const newRefreshToken = generateRefreshToken(user.id);

      // Replace old refresh token with new one
      await userService.replaceRefreshToken(user.id, refreshToken, newRefreshToken);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    res.status(500).json({ message: 'Server error during token refresh' });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user by revoking refresh token
 * @access Private
 */
router.post('/logout', auth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    // Delete refresh token
    await userService.deleteRefreshToken(req.user.id, refreshToken);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({ message: 'Server error during logout' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await userService.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      rating: user.rating,
      stats: {
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      }
    });
  } catch (error) {
    logger.error('Get user profile error', { error: error.message });
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

// Helper functions for token generation
function generateAccessToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
}

module.exports = router;