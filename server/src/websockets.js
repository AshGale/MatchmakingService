import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './utils/logger.js';
import { GameManager } from './services/gameManager.js';
import { LobbyManager } from './services/lobbyManager.js';
import { LobbyStateManager, LOBBY_STATES } from './services/lobbyStateManager.js';
import LobbyModel from './models/LobbyModel.js';
import MatchmakingHandler from './services/matchmakingHandler.js';

// Create singleton managers
const gameManager = new GameManager();
const lobbyManager = new LobbyManager();
let matchmakingHandler = null; // Will be initialized with io instance

// Connection tracking for enhanced management
const connectionTracker = {
  connections: new Map(),
  disconnectTimers: new Map(),
  reconnectionWindow: 60000, // 60 seconds to reconnect
  
  // Add a new connection
  addConnection(userId, socketId) {
    this.connections.set(userId, {
      socketId,
      connected: true,
      lastActivity: Date.now()
    });
    
    // Clear any existing disconnect timer
    if (this.disconnectTimers.has(userId)) {
      clearTimeout(this.disconnectTimers.get(userId));
      this.disconnectTimers.delete(userId);
    }
  },
  
  // Update connection status when user disconnects
  markDisconnected(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.connected = false;
      connection.disconnectedAt = Date.now();
      
      // Set up reconnection timer
      const timer = setTimeout(() => {
        this.handleReconnectionTimeout(userId);
      }, this.reconnectionWindow);
      
      this.disconnectTimers.set(userId, timer);
    }
  },
  
  // Handle reconnection timeout
  handleReconnectionTimeout(userId) {
    if (this.disconnectTimers.has(userId)) {
      this.disconnectTimers.delete(userId);
      this.connections.delete(userId);
      
      // Call any cleanup actions needed
      logger.info(`User ${userId} reconnection timeout expired, removing from tracked connections`);
    }
  },
  
  // Check if user is active within a specific timeframe
  isActive(userId, timeframeMs = 300000) { // Default 5 minutes
    const connection = this.connections.get(userId);
    if (!connection) return false;
    
    return connection.connected && 
           (Date.now() - connection.lastActivity) < timeframeMs;
  },
  
  // Update last activity time
  updateActivity(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  },
  
  // Get all active user IDs
  getActiveUsers() {
    const activeUsers = [];
    this.connections.forEach((connection, userId) => {
      if (connection.connected) {
        activeUsers.push(userId);
      }
    });
    return activeUsers;
  }
};

const configureWebSockets = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 10000,
    pingInterval: 5000
  });
  
  // Create the lobby state manager with socket.io instance
  const lobbyStateManager = new LobbyStateManager(LobbyModel, io);
  
  // Initialize matchmaking handler
  matchmakingHandler = new MatchmakingHandler(io);

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        logger.warn('Socket connection attempt without token', { ip: socket.handshake.address });
        return next(new Error('Authentication error: Token missing'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Enhance with additional user data
      socket.user = {
        id: decoded.userId,
        username: decoded.username,
        roles: decoded.roles || [],
        connectedAt: new Date().toISOString()
      };
      
      // Store IP for rate limiting and security monitoring
      socket.user.ipAddress = socket.handshake.address;
      
      logger.info('Socket authenticated successfully', { 
        userId: socket.user.id, 
        username: socket.user.username 
      });
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.warn('Socket connection with expired token', { 
          ip: socket.handshake.address,
          error: error.message 
        });
        return next(new Error('Authentication error: Token expired'));
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Socket connection with invalid token', { 
          ip: socket.handshake.address,
          error: error.message 
        });
        return next(new Error('Authentication error: Invalid token'));
      }
      
      logger.error('Socket authentication error', { 
        ip: socket.handshake.address,
        error: error.message 
      });
      next(new Error('Authentication error'));
    }
  });
  
  // Rate limiting middleware for socket connections
  io.use((socket, next) => {
    const userId = socket.user?.id;
    const ipAddress = socket.handshake.address;
    
    // Simple rate limiting based on recent connections
    // This could be enhanced with a more sophisticated rate limiter
    const recentConnections = Array.from(connectionTracker.connections.values())
      .filter(conn => {
        const isRecent = (Date.now() - conn.lastActivity) < 10000; // Last 10 seconds
        return isRecent;
      });
    
    // Count connections from this IP
    const ipConnectionCount = recentConnections.filter(conn => conn.ipAddress === ipAddress).length;
    
    if (ipConnectionCount > 10) { // More than 10 connections in 10 seconds
      logger.warn('Rate limit exceeded for socket connections', { 
        userId, 
        ipAddress, 
        connectionCount: ipConnectionCount 
      });
      return next(new Error('Too many connection attempts. Try again later.'));
    }
    
    next();
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    const { id, username } = socket.user;
    logger.info(`User connected: ${username} (${id})`);

    // Track connection for enhanced management
    connectionTracker.addConnection(id, socket.id);
    
    // Update user status to online
    lobbyManager.userConnected(id, username, socket.id);
    
    // Join user's personal room for direct messages
    socket.join(`user:${id}`);
    
    // Register socket with matchmaking handler
    matchmakingHandler.registerSocket(socket);
    
    // Get active lobbies the user is in and join those rooms
    const userLobbies = Array.from(lobbyManager.getLobbies(true))
      .filter(lobby => lobby.players.some(player => player.id === id));
      
    userLobbies.forEach(lobby => {
      socket.join(`lobby:${lobby.id}`);
      logger.info(`User ${username} (${id}) automatically joined lobby room: ${lobby.id}`);
    });
    
    // Get active games the user is in and join those rooms
    const userGames = gameManager.getGamesForPlayer(id);
    
    userGames.forEach(game => {
      socket.join(`game:${game.id}`);
      logger.info(`User ${username} (${id}) automatically joined game room: ${game.id}`);
      
      // Notify other players in the game that this player has reconnected
      socket.to(`game:${game.id}`).emit('player_reconnected', {
        gameId: game.id,
        userId: id,
        username: username
      });
    });
    
    // Send initial state
    socket.emit('initial_state', {
      lobbies: lobbyManager.getLobbies(),
      onlineUsers: lobbyManager.getOnlineUsers(),
      activeGames: gameManager.getPublicGamesList(),
      userLobbies: userLobbies,
      userGames: userGames
    });
    
    // Notify others that user is online
    socket.broadcast.emit('user_connected', { userId: id, username });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${username} (${id}), reason: ${reason}`);
      
      // Update connection tracker
      connectionTracker.markDisconnected(id);
      
      // Update lobby manager
      lobbyManager.userDisconnected(id);
      
      // Notify others that user is offline
      socket.broadcast.emit('user_disconnected', { userId: id, reason });
      
      // Handle ongoing games - don't remove player immediately in case of reconnect
      userGames.forEach(game => {
        io.to(`game:${game.id}`).emit('player_disconnected', {
          gameId: game.id,
          userId: id,
          username: username,
          reason: reason,
          willReconnect: reason !== 'io client disconnect' // Likely to reconnect if not explicit disconnect
        });
      });
      
      // Set timeout to handle player leaving games after reconnection window expires
      setTimeout(() => {
        // Only proceed if player hasn't reconnected
        if (!connectionTracker.isActive(id)) {
          gameManager.handlePlayerDisconnect(id);
          
          // Notify any games that the player has fully left
          userGames.forEach(game => {
            if (gameManager.getGame(game.id)) { // Check if game still exists
              io.to(`game:${game.id}`).emit('player_left_game', {
                gameId: game.id,
                userId: id,
                username: username
              });
            }
          });
        }
      }, connectionTracker.reconnectionWindow);
    });
    
    // Handle ping to keep connection alive and track activity
    socket.on('ping', (callback) => {
      connectionTracker.updateActivity(id);
      if (typeof callback === 'function') {
        callback({ success: true, timestamp: Date.now() });
      }
    });

    // LOBBY EVENTS
    
    // Create lobby
    socket.on('create_lobby', async (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        // Validate lobby data
        if (!data.name || data.name.trim() === '') {
          throw new Error('Lobby name is required');
        }
        
        if (data.maxPlayers && (data.maxPlayers < 2 || data.maxPlayers > 8)) {
          throw new Error('Max players must be between 2 and 8');
        }
        
        // Create in the in-memory manager first
        const lobby = lobbyManager.createLobby({
          name: data.name,
          creatorId: id,
          creatorName: username,
          maxPlayers: data.maxPlayers || 2,
          isPrivate: data.isPrivate || false,
          gameType: data.gameType || 'standard'
        });
        
        // Create in the database for persistence
        const persistedLobby = await LobbyModel.createLobby(
          id, 
          {
            name: data.name,
            gameType: data.gameType || 'standard',
            maxPlayers: data.maxPlayers || 2,
            isPrivate: data.isPrivate || false,
            password: data.password || null,
            metadata: data.metadata || {}
          }
        );
        
        // Join the lobby's room
        socket.join(`lobby:${lobby.id}`);
        
        // Set initial lobby state
        await lobbyStateManager.transitionState(persistedLobby.id, LOBBY_STATES.FILLING);
        
        // Track player connection to lobby
        lobbyStateManager.playerConnected(lobby.id, id, socket.id);
        
        logger.info(`Lobby created: ${lobby.name} (${lobby.id}) by ${username} (${id})`);
        
        // Notify everyone about the new lobby
        io.emit('lobby_created', lobby);
        
        callback({ success: true, lobby: {...lobby, dbId: persistedLobby.id} });
      } catch (error) {
        logger.error('Error creating lobby', { error: error.message, userId: id });
        callback({ success: false, error: error.message });
      }
    });
    
    // Join lobby
    socket.on('join_lobby', async (data, callback) => {
      try {
        const { lobbyId, password } = data;
        
        // First try to join in the database for validation
        const joinResult = await LobbyModel.joinLobby(lobbyId, id, password);
        
        if (!joinResult.success) {
          throw new Error(joinResult.message);
        }
        
        // Now join in the in-memory manager
        const lobby = lobbyManager.joinLobby(lobbyId, id, username);
        
        // Join the lobby's room
        socket.join(`lobby:${lobbyId}`);
        
        // Track player connection to lobby
        lobbyStateManager.playerConnected(lobbyId, id, socket.id);
        
        // Notify lobby members about the new player
        io.to(`lobby:${lobbyId}`).emit('player_joined_lobby', {
          lobbyId,
          player: { id, username }
        });
        
        // Update lobby list for everyone
        io.emit('lobby_updated', lobby);
        
        callback({ success: true, lobby });
      } catch (error) {
        logger.error('Error joining lobby', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Leave lobby
    socket.on('leave_lobby', async (data, callback) => {
      try {
        const { lobbyId } = data;
        
        // First leave in the database
        const leaveResult = await LobbyModel.leaveLobby(lobbyId, id);
        
        if (!leaveResult.success) {
          throw new Error(leaveResult.message);
        }
        
        // Now leave in the in-memory manager
        const result = lobbyManager.leaveLobby(lobbyId, id);
        
        // Leave the lobby's room
        socket.leave(`lobby:${lobbyId}`);
        
        // Track player disconnection from lobby
        lobbyStateManager.playerDisconnected(lobbyId, id);
        
        // If lobby still exists, notify remaining players
        if (!result.lobbyDeleted) {
          io.to(`lobby:${lobbyId}`).emit('player_left_lobby', {
            lobbyId,
            playerId: id,
            newOwner: result.newOwner
          });
        }
        
        // Update or remove lobby for everyone
        if (result.lobbyDeleted) {
          io.emit('lobby_deleted', { lobbyId });
        } else {
          io.emit('lobby_updated', result.lobby);
        }
        
        callback({ success: true });
      } catch (error) {
        logger.error('Error leaving lobby', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Player ready status
    socket.on('set_ready_status', async (data, callback) => {
      try {
        const { lobbyId, isReady } = data;
        
        // Update ready status
        const result = await lobbyStateManager.setPlayerReady(lobbyId, id, isReady);
        
        callback({ success: true, result });
      } catch (error) {
        logger.error('Error setting ready status', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Lobby chat
    socket.on('lobby_chat', async (data, callback) => {
      try {
        const { lobbyId, message } = data;
        
        if (!message || typeof message !== 'string' || message.trim() === '') {
          throw new Error('Invalid message');
        }
        
        // Add chat message
        const chatMessage = await lobbyStateManager.addChatMessage(lobbyId, id, username, message.trim());
        
        callback({ success: true, message: chatMessage });
      } catch (error) {
        logger.error('Error sending chat message', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Start game from lobby
    socket.on('start_game', async (data, callback) => {
      try {
        const { lobbyId } = data;
        
        // First verify and start in the database
        const startResult = await LobbyModel.startGame(lobbyId, gameManager);
        
        if (!startResult.success) {
          throw new Error(startResult.message);
        }
        
        // Initialize the game
        const result = await lobbyStateManager.initializeGame(lobbyId, id);
        
        callback({ success: true, gameId: result.gameId });
      } catch (error) {
        logger.error('Error starting game', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // GAME EVENTS
    
    // Game action (move, card play, etc.)
    socket.on('game_action', (data, callback) => {
      try {
        const { gameId, action } = data;
        
        const result = gameManager.processAction(gameId, id, action);
        
        // Broadcast the action to all players in the game
        io.to(`game:${gameId}`).emit('game_action_performed', {
          gameId,
          playerId: id,
          username,
          action,
          result
        });
        
        callback({ success: true, result });
      } catch (error) {
        logger.error('Error processing game action', { error: error.message, userId: id, gameId: data.gameId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Join game
    socket.on('join_game', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if user is a player in this game
        const isPlayer = game.players.some(player => player.id === id);
        
        if (!isPlayer) {
          throw new Error('You are not a player in this game');
        }
        
        // Join the game's room
        socket.join(`game:${gameId}`);
        
        // Notify other players in the game that this player has joined
        socket.to(`game:${gameId}`).emit('player_joined_game', {
          gameId,
          userId: id,
          username: username
        });
        
        // Update last activity time for the game
        gameManager.updateGameActivity(gameId);
        
        logger.info(`User ${username} (${id}) joined game: ${gameId}`);
        
        callback({ 
          success: true,
          game: {
            id: game.id,
            players: game.players,
            currentTurn: game.currentTurn,
            state: game.state,
            spectators: game.spectators || [],
            chatHistory: game.chatHistory || [],
            turnHistory: game.turnHistory || []
          }
        });
      } catch (error) {
        logger.error('Error joining game', { error: error.message, userId: id, gameId: data?.gameId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Spectate a game (non-players)
    socket.on('spectate_game', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if this is a public game that can be spectated
        if (game.isPrivate) {
          throw new Error('This game is private and cannot be spectated');
        }
        
        // Add user as spectator
        gameManager.addSpectator(gameId, { id, username });
        
        // Join the game's spectator room
        socket.join(`game:${gameId}:spectators`);
        socket.join(`game:${gameId}`);
        
        // Notify players that someone is spectating
        io.to(`game:${gameId}`).emit('spectator_joined', {
          gameId,
          userId: id,
          username: username
        });
        
        logger.info(`User ${username} (${id}) spectating game: ${gameId}`);
        
        callback({ 
          success: true,
          game: {
            id: game.id,
            players: game.players,
            currentTurn: game.currentTurn,
            state: game.state,
            spectators: game.spectators || []
          }
        });
      } catch (error) {
        logger.error('Error spectating game', { error: error.message, userId: id, gameId: data?.gameId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Make a move in a game
    socket.on('game_move', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId, move } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        if (!move) {
          throw new Error('Move data is required');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if the game is still active
        if (game.state.status !== 'active') {
          throw new Error('Game is not active');
        }
        
        // Check if it's this player's turn
        if (game.currentTurn !== id) {
          throw new Error('Not your turn');
        }
        
        // Apply the move to the game - this may throw validation errors
        gameManager.applyMove(gameId, id, move);
        
        // Get updated game state
        const updatedGame = gameManager.getGame(gameId);
        
        // Update last activity time for the game
        gameManager.updateGameActivity(gameId);
        
        // Notify all players and spectators in the game
        io.to(`game:${gameId}`).emit('game_move', {
          gameId,
          playerId: id,
          playerName: username,
          move: move,
          currentTurn: updatedGame.currentTurn,
          state: updatedGame.state,
          timestamp: Date.now()
        });
        
        // Check if the game is over
        if (updatedGame.state.status === 'completed') {
          io.to(`game:${gameId}`).emit('game_over', {
            gameId,
            winner: updatedGame.state.winner,
            state: updatedGame.state,
            timestamp: Date.now()
          });
          
          // Log game completion
          logger.info(`Game completed: ${gameId}, winner: ${updatedGame.state.winner?.username || 'Draw'}`);
        }
        
        callback({ 
          success: true,
          currentTurn: updatedGame.currentTurn,
          state: updatedGame.state 
        });
      } catch (error) {
        logger.error('Error making game move', { 
          error: error.message, 
          userId: id, 
          gameId: data?.gameId,
          move: data?.move 
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Game chat
    socket.on('game_chat', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId, message } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        if (!message || message.trim() === '') {
          throw new Error('Message cannot be empty');
        }
        
        if (message.length > 500) {
          throw new Error('Message is too long (max 500 characters)');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if user is a player or spectator in this game
        const isPlayer = game.players.some(player => player.id === id);
        const isSpectator = game.spectators && game.spectators.some(spectator => spectator.id === id);
        
        if (!isPlayer && !isSpectator) {
          throw new Error('You are not a participant in this game');
        }
        
        // Create chat message
        const chatMessage = {
          senderId: id,
          senderName: username,
          message: message,
          timestamp: Date.now(),
          isSpectator: !isPlayer
        };
        
        // Add to game chat history
        gameManager.addChatMessage(gameId, chatMessage);
        
        // Send to all players and spectators
        io.to(`game:${gameId}`).emit('game_chat_message', {
          gameId,
          ...chatMessage
        });
        
        callback({ success: true });
      } catch (error) {
        logger.error('Error sending game chat', { 
          error: error.message, 
          userId: id, 
          gameId: data?.gameId 
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Forfeit a game
    socket.on('forfeit_game', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId, reason } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if the game is still active
        if (game.state.status !== 'active') {
          throw new Error('Game is not active');
        }
        
        // Check if user is a player in this game
        const isPlayer = game.players.some(player => player.id === id);
        
        if (!isPlayer) {
          throw new Error('You are not a player in this game');
        }
        
        // Forfeit the game
        gameManager.forfeitGame(gameId, id);
        
        // Get updated game state
        const updatedGame = gameManager.getGame(gameId);
        
        // Notify all players in the game
        io.to(`game:${gameId}`).emit('game_forfeited', {
          gameId,
          playerId: id,
          playerName: username,
          reason: reason || 'Player forfeited',
          state: updatedGame.state,
          timestamp: Date.now()
        });
        
        // Log forfeit
        logger.info(`Game forfeited: ${gameId} by user ${username} (${id}), reason: ${reason || 'Player forfeited'}`);
        
        callback({ success: true });
      } catch (error) {
        logger.error('Error forfeiting game', { 
          error: error.message, 
          userId: id, 
          gameId: data?.gameId 
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Request game state (for reconnection)
    socket.on('request_game_state', (data, callback) => {
      try {
        // Track activity
        connectionTracker.updateActivity(id);
        
        const { gameId } = data;
        
        if (!gameId) {
          throw new Error('Game ID is required');
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
          throw new Error('Game not found');
        }
        
        // Check if user is a player or spectator in this game
        const isPlayer = game.players.some(player => player.id === id);
        const isSpectator = game.spectators && game.spectators.some(spectator => spectator.id === id);
        
        if (!isPlayer && !isSpectator) {
          throw new Error('You are not a participant in this game');
        }
        
        callback({ 
          success: true,
          game: {
            id: game.id,
            players: game.players,
            spectators: game.spectators || [],
            currentTurn: game.currentTurn,
            state: game.state,
            chatHistory: game.chatHistory || [],
            turnHistory: game.turnHistory || [],
            lastUpdateTime: game.lastUpdateTime || Date.now()
          }
        });
      } catch (error) {
        logger.error('Error requesting game state', { 
          error: error.message, 
          userId: id, 
          gameId: data?.gameId 
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Send game invitation
    socket.on('send_invitation', (data, callback) => {
      try {
        const { targetUserId } = data;
        const targetSocketId = lobbyManager.getSocketId(targetUserId);
        
        if (!targetSocketId) {
          throw new Error('User is not online');
        }
        
        const invitationId = lobbyManager.createInvitation(id, username, targetUserId);
        
        // Send invitation to target user
        io.to(`user:${targetUserId}`).emit('game_invitation', {
          invitationId,
          fromUserId: id,
          fromUsername: username
        });
        
        callback({ success: true, invitationId });
      } catch (error) {
        logger.error('Error sending invitation', { error: error.message, userId: id, targetUserId: data.targetUserId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Respond to game invitation
    socket.on('respond_to_invitation', (data, callback) => {
      try {
        const { invitationId, accept } = data;
        const invitation = lobbyManager.getInvitation(invitationId);
        
        if (!invitation) {
          throw new Error('Invitation not found or expired');
        }
        
        if (invitation.targetUserId !== id) {
          throw new Error('This invitation is not for you');
        }
        
        // If declined, just notify the sender
        if (!accept) {
          lobbyManager.removeInvitation(invitationId);
          io.to(`user:${invitation.fromUserId}`).emit('invitation_declined', {
            invitationId,
            byUserId: id,
            byUsername: username
          });
          
          callback({ success: true });
          return;
        }
        
        // If accepted, create a game
        const players = [
          { id: invitation.fromUserId, username: invitation.fromUsername },
          { id, username }
        ];
        
        const game = gameManager.createGame(players);
        
        // Add players to game room
        players.forEach(player => {
          const playerSocketId = lobbyManager.getSocketId(player.id);
          if (playerSocketId) {
            const playerSocket = io.sockets.sockets.get(playerSocketId);
            if (playerSocket) {
              playerSocket.join(`game:${game.id}`);
            }
          }
        });
        
        // Notify both players
        io.to(`game:${game.id}`).emit('game_started', {
          gameId: game.id,
          players: game.players,
          currentTurn: game.currentTurn,
          state: game.state
        });
        
        // Remove the invitation
        lobbyManager.removeInvitation(invitationId);
        
        callback({ success: true, gameId: game.id });
      } catch (error) {
        logger.error('Error responding to invitation', { error: error.message, userId: id, invitationId: data.invitationId });
        callback({ success: false, error: error.message });
      }
    });
  });

  // Start turn timer checks
  const checkTurnTimers = () => {
    const expiredTurns = gameManager.checkTurnTimers();
    
    // For each expired turn, advance the game and notify players
    expiredTurns.forEach(({ gameId, nextTurn }) => {
      io.to(`game:${gameId}`).emit('turn_expired', {
        gameId,
        nextTurn
      });
      
      // Update game state for all players
      const game = gameManager.getGame(gameId);
      io.to(`game:${gameId}`).emit('game_updated', {
        gameId,
        state: game.state,
        currentTurn: game.currentTurn
      });
    });
  };
  
  // Check turn timers every 5 seconds
  setInterval(checkTurnTimers, 5000);

  // Store instances for use elsewhere if needed
  configureWebSockets.io = io;
  configureWebSockets.lobbyStateManager = lobbyStateManager;
  configureWebSockets.matchmakingHandler = matchmakingHandler;
  
  return io;
};

export { configureWebSockets };