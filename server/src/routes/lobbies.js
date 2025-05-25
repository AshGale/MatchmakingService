import express from 'express';
import auth from '../middleware/auth.js';
import logger from '../utils/logger.js';
import LobbyService from '../services/lobbyService.js';
import { lobbyValidators, handleValidationErrors } from '../middleware/lobbyValidator.js';
import { configureWebSockets } from '../websockets.js';

const router = express.Router();

const lobbyService = new LobbyService();

/**
 * @route GET /api/lobbies
 * @desc Get list of lobbies with optional filtering
 * @access Private
 */
router.get('/', [
  auth,
  ...lobbyValidators.getLobbies,
  handleValidationErrors
], async (req, res) => {
  try {
    const includePrivate = req.query.includePrivate === 'true';
    const gameType = req.query.gameType;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    const filters = {
      gameType,
      isPrivate: includePrivate ? undefined : false,
      limit,
      offset
    };
    
    const lobbies = await lobbyService.getLobbies(filters);
    
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
  ...lobbyValidators.createLobby,
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, gameType = 'standard', maxPlayers = 2, isPrivate = false, password = null } = req.body;
    const userId = req.user.id;
    const username = req.user.username;
    
    const lobby = await lobbyService.createLobby({
      name,
      creatorId: userId,
      creatorName: username,
      gameType,
      maxPlayers,
      isPrivate,
      password: isPrivate ? password : null
    });
    
    // Notify connected clients through WebSockets about the new lobby
    const io = configureWebSockets.io;
    if (io) {
      io.emit('lobby_created', {
        id: lobby.id,
        name: lobby.name,
        creatorId: lobby.creatorId,
        creatorName: lobby.creatorName,
        gameType: lobby.gameType,
        maxPlayers: lobby.maxPlayers,
        isPrivate: lobby.isPrivate,
        playerCount: 1,
        status: lobby.status
      });
    }
    
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
  ...lobbyValidators.getLobby,
  handleValidationErrors
], async (req, res) => {
  try {
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
  ...lobbyValidators.joinLobby,
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const userId = req.user.id;
    const username = req.user.username;
    const password = req.body.password || null;
    
    const result = await lobbyService.joinLobby(lobbyId, userId, username, password);
    
    // Notify connected clients through WebSockets
    if (result.success) {
      const io = configureWebSockets.io;
      if (io) {
        io.to(`lobby:${lobbyId}`).emit('player_joined_lobby', {
          lobbyId,
          player: { id: userId, username }
        });
      }
    }
    
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
      error.message === 'This is a private lobby' ||
      error.message === 'Invalid lobby password'
    ) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error joining lobby' });
  }
});

/**
 * @route DELETE /api/lobbies/:id/leave
 * @desc Leave a lobby
 * @access Private
 */
router.delete('/:id/leave', [
  auth,
  ...lobbyValidators.leaveLobby,
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const userId = req.user.id;
    
    const result = await lobbyService.leaveLobby(lobbyId, userId);
    
    // Notify connected clients through WebSockets
    if (result.success) {
      const io = configureWebSockets.io;
      if (io) {
        // If lobby was deleted, notify all clients
        if (result.lobbyDeleted) {
          io.emit('lobby_deleted', { lobbyId });
        } else {
          // Otherwise notify only lobby members
          io.to(`lobby:${lobbyId}`).emit('player_left_lobby', {
            lobbyId,
            playerId: userId,
            newOwner: result.newOwner
          });
          
          // Also update the lobby in the public list
          io.emit('lobby_updated', await lobbyService.getLobbyById(lobbyId));
        }
      }
    }
    
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
  ...lobbyValidators.startGame,
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const userId = req.user.id;
    
    const result = await lobbyService.startGame(lobbyId, userId);
    
    // Notify connected clients through WebSockets
    if (result.gameId) {
      const io = configureWebSockets.io;
      if (io) {
        io.to(`lobby:${lobbyId}`).emit('game_started', {
          lobbyId,
          gameId: result.gameId,
          timestamp: Date.now()
        });
      }
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error starting game from lobby', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    
    if (error.message === 'Lobby not found') {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === 'Only the lobby creator can start the game' ||
      error.message === 'Not enough players to start' ||
      error.message === 'Too many players to start' ||
      error.message === 'Not all players are ready'
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
  ...lobbyValidators.invitePlayer,
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const creatorId = req.user.id;
    const targetUserId = req.body.userId;
    
    const result = await lobbyService.inviteToLobby(lobbyId, creatorId, targetUserId);
    
    // Notify target user if they're online
    if (result.targetUser) {
      const io = configureWebSockets.io;
      if (io) {
        io.to(`user:${targetUserId}`).emit('lobby_invitation', {
          lobbyId,
          inviterId: creatorId,
          inviterName: req.user.username
        });
      }
    }
    
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

/**
 * @route POST /api/lobbies/:id/ready
 * @desc Set player ready status in a lobby
 * @access Private
 */
router.post('/:id/ready', [
  auth,
  ...lobbyValidators.setReady,
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const userId = req.user.id;
    const isReady = req.body.isReady;
    
    // Check if lobby exists and player is in it
    const lobby = await lobbyService.getLobbyById(lobbyId);
    
    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }
    
    const playerInLobby = lobby.players.some(player => player.id === userId);
    if (!playerInLobby) {
      return res.status(400).json({ message: 'You are not in this lobby' });
    }
    
    // Update ready status
    const result = await lobbyService.setPlayerReady(lobbyId, userId, isReady);
    
    // Notify connected clients through WebSockets
    const io = configureWebSockets.io;
    if (io) {
      io.to(`lobby:${lobbyId}`).emit('player_ready_status_changed', {
        lobbyId,
        playerId: userId,
        isReady
      });
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error setting ready status', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    res.status(500).json({ message: 'Server error setting ready status' });
  }
});

/**
 * @route GET /api/lobbies/:id/chat
 * @desc Get chat history for a lobby
 * @access Private
 */
router.get('/:id/chat', [
  auth,
  param('id').isUUID().withMessage('Invalid lobby ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const lobbyId = req.params.id;
    const userId = req.user.id;
    
    // Check if lobby exists and player is in it or has access
    const lobby = await lobbyService.getLobbyById(lobbyId);
    
    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }
    
    const playerInLobby = lobby.players.some(player => player.id === userId);
    const isCreator = lobby.creatorId === userId;
    const isInvited = lobby.invitedPlayers?.includes(userId);
    
    if (!playerInLobby && !isCreator && !isInvited) {
      return res.status(403).json({ message: 'You do not have access to this lobby' });
    }
    
    // Get chat history (implementation depends on how chat is stored)
    const chatHistory = await lobbyService.getLobbyChat(lobbyId);
    
    res.json(chatHistory);
  } catch (error) {
    logger.error('Error fetching lobby chat', { error: error.message, lobbyId: req.params.id, userId: req.user.id });
    res.status(500).json({ message: 'Server error fetching lobby chat' });
  }
});

export default router;