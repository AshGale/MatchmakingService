const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const LobbyService = require('../services/lobbyService');

const lobbyService = new LobbyService();

/**
 * @route GET /api/lobbies
 * @desc Get list of lobbies
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const includePrivate = req.query.includePrivate === 'true';
    const lobbies = await lobbyService.getLobbies(includePrivate);
    
    res.json(lobbies);
  } catch (error) {
    logger.error('Error fetching lobbies', { error: error.message });
    res.status(500).json({ message: 'Server error fetching lobbies' });
  }
});

/**
 * @route POST /api/lobbies
 * @desc Create a new lobby
 * @access Private
 */
router.post('/', [
  auth,
  body('name')
    .isLength({ min: 3, max: 50 })
    .withMessage('Lobby name must be between 3 and 50 characters')
    .trim(),
  body('maxPlayers')
    .optional()
    .isInt({ min: 2, max: 10 })
    .withMessage('Max players must be between 2 and 10'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, maxPlayers = 2, isPrivate = false } = req.body;
    const userId = req.user.id;
    const username = req.user.username;
    
    const lobby = await lobbyService.createLobby({
      name,
      creatorId: userId,
      creatorName: username,
      maxPlayers,
      isPrivate
    });
    
    res.status(201).json(lobby);
  } catch (error) {
    logger.error('Error creating lobby', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error creating lobby' });
  }
});

/**
 * @route GET /api/lobbies/:id
 * @desc Get lobby by ID
 * @access Private
 */
router.get('/:id', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const lobbyId = req.params.id;
    const lobby = await lobbyService.getLobbyById(lobbyId);
    
    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }
    
    // Check if private lobby - only creator or invited players can see it
    if (
      lobby.isPrivate && 
      lobby.creatorId !== req.user.id && 
      !lobby.invitedPlayers?.includes(req.user.id)
    ) {
      return res.status(403).json({ message: 'You do not have access to this lobby' });
    }
    
    res.json(lobby);
  } catch (error) {
    logger.error('Error fetching lobby', { error: error.message, lobbyId: req.params.id });
    res.status(500).json({ message: 'Server error fetching lobby' });
  }
});

/**
 * @route POST /api/lobbies/:id/join
 * @desc Join a lobby
 * @access Private
 */
router.post('/:id/join', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const lobbyId = req.params.id;
    const userId = req.user.id;
    const username = req.user.username;
    
    const result = await lobbyService.joinLobby(lobbyId, userId, username);
    
    res.json(result);
  } catch (error) {
    logger.error('Error joining lobby', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    
    // Handle specific errors with appropriate status codes
    if (error.message === 'Lobby not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Lobby is full' ||
      error.message === 'You are already in this lobby' ||
      error.message === 'Lobby is not accepting new players' ||
      error.message === 'This is a private lobby'
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error joining lobby' });
  }
});

/**
 * @route POST /api/lobbies/:id/leave
 * @desc Leave a lobby
 * @access Private
 */
router.post('/:id/leave', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const lobbyId = req.params.id;
    const userId = req.user.id;
    
    const result = await lobbyService.leaveLobby(lobbyId, userId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error leaving lobby', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    
    if (error.message === 'Lobby not found' || error.message === 'You are not in this lobby') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error leaving lobby' });
  }
});

/**
 * @route POST /api/lobbies/:id/start
 * @desc Start game from lobby
 * @access Private
 */
router.post('/:id/start', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const lobbyId = req.params.id;
    const userId = req.user.id;
    
    const result = await lobbyService.startGame(lobbyId, userId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error starting game from lobby', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    
    if (error.message === 'Lobby not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Only the lobby creator can start the game' ||
      error.message === 'Not enough players to start' ||
      error.message === 'Too many players to start'
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error starting game' });
  }
});

/**
 * @route POST /api/lobbies/:id/invite
 * @desc Invite a player to a private lobby
 * @access Private
 */
router.post('/:id/invite', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID'),
  body('userId').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const lobbyId = req.params.id;
    const creatorId = req.user.id;
    const targetUserId = req.body.userId;
    
    const result = await lobbyService.inviteToLobby(lobbyId, creatorId, targetUserId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error inviting to lobby', { 
      error: error.message, 
      lobbyId: req.params.id, 
      creatorId: req.user.id,
      targetUserId: req.body.userId
    });
    
    if (error.message === 'Lobby not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Only the lobby creator can send invitations' ||
      error.message === 'Cannot invite yourself' ||
      error.message === 'User not found' ||
      error.message === 'User already invited'
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error inviting to lobby' });
  }
});

module.exports = router;