import express from 'express';
import { param, body, validationResult } from 'express-validator';
import auth from '../middleware/auth.js';
import UserService from '../services/userService.js';
import logger from '../utils/logger.js';
import argon2 from 'argon2';

const router = express.Router();

const userService = new UserService();

/**
 * @route GET /api/users
 * @desc Get list of users (paginated)
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    
    const result = await userService.getUsers(page, limit, search);
    
    res.json({
      users: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/:id', [
  auth,
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.params.id;
    const user = await userService.getUserProfile(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile', { error: error.message, userId: req.params.id });
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

/**
 * @route GET /api/users/:id/stats
 * @desc Get user game statistics
 * @access Private
 */
router.get('/:id/stats', [
  auth,
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.params.id;
    const stats = await userService.getUserStats(userId);
    
    if (!stats) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching user stats', { error: error.message, userId: req.params.id });
    res.status(500).json({ message: 'Server error fetching user stats' });
  }
});

/**
 * @route GET /api/users/:id/history
 * @desc Get user's game history
 * @access Private
 */
router.get('/:id/history', [
  auth,
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await userService.getUserGameHistory(userId, page, limit);
    
    res.json({
      games: result.games,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching user game history', { error: error.message, userId: req.params.id });
    res.status(500).json({ message: 'Server error fetching user game history' });
  }
});

/**
 * @route PATCH /api/users/me
 * @desc Update current user's profile
 * @access Private
 */
router.patch('/me', [
  auth,
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .trim(),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const updates = {};
    
    // Only allow updating specific fields
    if (req.body.username) {
      // Check if username already exists
      const existingUser = await userService.findByUsername(req.body.username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      updates.username = req.body.username;
    }
    
    if (req.body.password) {
      updates.password = await argon2.hash(req.body.password);
    }
    
    // If no valid updates, return early
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    const updatedUser = await userService.updateUser(userId, updates);
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username
      }
    });
  } catch (error) {
    logger.error('Error updating user profile', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error updating user profile' });
  }
});

export default router;