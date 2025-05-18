const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const GameService = require('../services/gameService');

const gameService = new GameService();

/**
 * @route GET /api/games
 * @desc Get list of active games
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const games = await gameService.getActiveGames();
    res.json(games);
  } catch (error) {
    logger.error('Error fetching active games', { error: error.message });
    res.status(500).json({ message: 'Server error fetching active games' });
  }
});

/**
 * @route GET /api/games/:id
 * @desc Get game by ID
 * @access Private
 */
router.get('/:id', [
  auth,
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const gameId = req.params.id;
    const userId = req.user.id;
    
    const game = await gameService.getGameById(gameId, userId);
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    logger.error('Error fetching game', { error: error.message, gameId: req.params.id });
    res.status(500).json({ message: 'Server error fetching game' });
  }
});

/**
 * @route POST /api/games/:id/move
 * @desc Submit a move
 * @access Private
 */
router.post('/:id/move', [
  auth,
  param('id').isUUID().withMessage('Invalid game ID'),
  body('move').isObject().withMessage('Move must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const gameId = req.params.id;
    const userId = req.user.id;
    const move = req.body.move;
    
    const result = await gameService.processMove(gameId, userId, move);
    
    res.json(result);
  } catch (error) {
    logger.error('Error processing move', { error: error.message, gameId: req.params.id, userId: req.user.id });
    
    // Handle specific errors
    if (error.message === 'Game not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Not your turn' ||
      error.message === 'Game is not active' ||
      error.message.includes('Invalid move')
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error processing move' });
  }
});

/**
 * @route POST /api/games/:id/forfeit
 * @desc Forfeit a game
 * @access Private
 */
router.post('/:id/forfeit', [
  auth,
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const gameId = req.params.id;
    const userId = req.user.id;
    
    const result = await gameService.forfeitGame(gameId, userId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error forfeiting game', { error: error.message, gameId: req.params.id, userId: req.user.id });
    
    if (error.message === 'Game not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Game is not active' ||
      error.message === 'Player not in this game'
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error forfeiting game' });
  }
});

/**
 * @route POST /api/games/quick-match
 * @desc Request a quick match
 * @access Private
 */
router.post('/quick-match', [
  auth,
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const username = req.user.username;
    const preferences = req.body.preferences || {};
    
    const result = await gameService.requestQuickMatch(userId, username, preferences);
    
    res.json(result);
  } catch (error) {
    logger.error('Error requesting quick match', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error requesting quick match' });
  }
});

/**
 * @route DELETE /api/games/quick-match
 * @desc Cancel a quick match request
 * @access Private
 */
router.delete('/quick-match', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await gameService.cancelQuickMatch(userId);
    
    res.json({ message: 'Quick match request canceled' });
  } catch (error) {
    logger.error('Error canceling quick match', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error canceling quick match' });
  }
});

/**
 * @route POST /api/games/invite
 * @desc Send a game invitation
 * @access Private
 */
router.post('/invite', [
  auth,
  body('targetUserId').isUUID().withMessage('Invalid target user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const fromUserId = req.user.id;
    const fromUsername = req.user.username;
    const targetUserId = req.body.targetUserId;
    
    const result = await gameService.createInvitation(fromUserId, fromUsername, targetUserId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error creating invitation', { 
      error: error.message, 
      fromUserId: req.user.id, 
      targetUserId: req.body.targetUserId 
    });
    
    if (error.message === 'User not found' || error.message === 'User is not online') {
      return res.status(404).json({ message: error.message });
    } else if (error.message === 'Cannot invite yourself') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error creating invitation' });
  }
});

/**
 * @route POST /api/games/invite/:id/respond
 * @desc Respond to a game invitation
 * @access Private
 */
router.post('/invite/:id/respond', [
  auth,
  param('id').isUUID().withMessage('Invalid invitation ID'),
  body('accept').isBoolean().withMessage('Accept must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const invitationId = req.params.id;
    const userId = req.user.id;
    const accept = req.body.accept;
    
    const result = await gameService.respondToInvitation(invitationId, userId, accept);
    
    res.json(result);
  } catch (error) {
    logger.error('Error responding to invitation', { 
      error: error.message, 
      invitationId: req.params.id, 
      userId: req.user.id 
    });
    
    if (error.message === 'Invitation not found or expired') {
      return res.status(404).json({ message: error.message });
    } else if (error.message === 'This invitation is not for you') {
      return res.status(403).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error responding to invitation' });
  }
});

module.exports = router;