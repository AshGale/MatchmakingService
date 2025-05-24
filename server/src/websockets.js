import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './utils/logger.js';
import { GameManager } from './services/gameManager.js';
import { LobbyManager } from './services/lobbyManager.js';

// Create singleton managers
const gameManager = new GameManager();
const lobbyManager = new LobbyManager();

const configureWebSockets = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 10000,
    pingInterval: 5000
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: decoded.userId,
        username: decoded.username
      };
      
      next();
    } catch (error) {
      logger.error('Socket authentication error', { error: error.message });
      next(new Error('Authentication error'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    const { id, username } = socket.user;
    logger.info(`User connected: ${username} (${id})`);

    // Update user status to online
    lobbyManager.userConnected(id, username, socket.id);
    
    // Join user's personal room for direct messages
    socket.join(`user:${id}`);
    
    // Send initial state
    socket.emit('initial_state', {
      lobbies: lobbyManager.getLobbies(),
      onlineUsers: lobbyManager.getOnlineUsers(),
      activeGames: gameManager.getPublicGamesList()
    });
    
    // Notify others that user is online
    socket.broadcast.emit('user_connected', { userId: id, username });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${username} (${id})`);
      lobbyManager.userDisconnected(id);
      
      // Notify others that user is offline
      socket.broadcast.emit('user_disconnected', { userId: id });
      
      // Handle ongoing games
      gameManager.handlePlayerDisconnect(id);
    });

    // LOBBY EVENTS
    
    // Create lobby
    socket.on('create_lobby', (data, callback) => {
      try {
        const lobby = lobbyManager.createLobby({
          name: data.name,
          creatorId: id,
          creatorName: username,
          maxPlayers: data.maxPlayers || 2,
          isPrivate: data.isPrivate || false
        });
        
        // Join the lobby's room
        socket.join(`lobby:${lobby.id}`);
        
        // Notify everyone about the new lobby
        io.emit('lobby_created', lobby);
        
        callback({ success: true, lobby });
      } catch (error) {
        logger.error('Error creating lobby', { error: error.message, userId: id });
        callback({ success: false, error: error.message });
      }
    });
    
    // Join lobby
    socket.on('join_lobby', (data, callback) => {
      try {
        const { lobbyId } = data;
        const lobby = lobbyManager.joinLobby(lobbyId, id, username);
        
        // Join the lobby's room
        socket.join(`lobby:${lobbyId}`);
        
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
    socket.on('leave_lobby', (data, callback) => {
      try {
        const { lobbyId } = data;
        const result = lobbyManager.leaveLobby(lobbyId, id);
        
        // Leave the lobby's room
        socket.leave(`lobby:${lobbyId}`);
        
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
    
    // Start game from lobby
    socket.on('start_game', (data, callback) => {
      try {
        const { lobbyId } = data;
        const lobby = lobbyManager.getLobby(lobbyId);
        
        if (!lobby) {
          throw new Error('Lobby not found');
        }
        
        if (lobby.creatorId !== id) {
          throw new Error('Only the lobby creator can start the game');
        }
        
        // Create a new game
        const game = gameManager.createGame(lobby.players);
        
        // Add players to game room
        lobby.players.forEach(player => {
          const playerSocket = io.sockets.sockets.get(lobbyManager.getSocketId(player.id));
          if (playerSocket) {
            playerSocket.join(`game:${game.id}`);
          }
        });
        
        // Notify players that the game has started
        io.to(`game:${game.id}`).emit('game_started', {
          gameId: game.id,
          players: game.players,
          currentTurn: game.currentTurn,
          state: game.state
        });
        
        // Delete the lobby
        lobbyManager.deleteLobby(lobbyId);
        io.emit('lobby_deleted', { lobbyId });
        
        callback({ success: true, gameId: game.id });
      } catch (error) {
        logger.error('Error starting game', { error: error.message, userId: id, lobbyId: data.lobbyId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Quick match request
    socket.on('quick_match', (data, callback) => {
      try {
        const result = lobbyManager.requestQuickMatch(id, username, data.preferences || {});
        callback({ success: true, message: result.message, matchId: result.matchId });
        
        // If a match is found, notify both players and start the game
        if (result.matchId) {
          const { playerIds, game } = gameManager.createGameFromQuickMatch(result.matchId, result.players);
          
          playerIds.forEach(playerId => {
            const playerSocketId = lobbyManager.getSocketId(playerId);
            const playerSocket = io.sockets.sockets.get(playerSocketId);
            if (playerSocket) {
              playerSocket.join(`game:${game.id}`);
            }
          });
          
          io.to(`game:${game.id}`).emit('game_started', {
            gameId: game.id,
            players: game.players,
            currentTurn: game.currentTurn,
            state: game.state
          });
        }
      } catch (error) {
        logger.error('Error requesting quick match', { error: error.message, userId: id });
        callback({ success: false, error: error.message });
      }
    });
    
    // Cancel quick match
    socket.on('cancel_quick_match', (_, callback) => {
      try {
        lobbyManager.cancelQuickMatch(id);
        callback({ success: true });
      } catch (error) {
        logger.error('Error canceling quick match', { error: error.message, userId: id });
        callback({ success: false, error: error.message });
      }
    });
    
    // GAME EVENTS
    
    // Submit move
    socket.on('submit_move', (data, callback) => {
      try {
        const { gameId, move } = data;
        
        // Validate it's the player's turn
        const game = gameManager.getGame(gameId);
        if (!game) {
          throw new Error('Game not found');
        }
        
        if (game.currentTurn.playerId !== id) {
          throw new Error('Not your turn');
        }
        
        // Process the move
        const result = gameManager.processMove(gameId, id, move);
        
        // Broadcast updated game state
        io.to(`game:${gameId}`).emit('game_updated', {
          gameId,
          state: result.state,
          currentTurn: result.currentTurn,
          lastMove: {
            playerId: id,
            move
          }
        });
        
        // Check if game is over
        if (result.gameOver) {
          io.to(`game:${gameId}`).emit('game_ended', {
            gameId,
            winner: result.winner,
            reason: result.reason
          });
          
          // Update Elo ratings
          if (result.ratings) {
            result.ratings.forEach(rating => {
              io.to(`user:${rating.userId}`).emit('rating_updated', {
                oldRating: rating.oldRating,
                newRating: rating.newRating,
                change: rating.change
              });
            });
          }
        }
        
        callback({ success: true });
      } catch (error) {
        logger.error('Error submitting move', { error: error.message, userId: id, gameId: data.gameId });
        callback({ success: false, error: error.message });
      }
    });
    
    // Forfeit game
    socket.on('forfeit_game', (data, callback) => {
      try {
        const { gameId } = data;
        const result = gameManager.forfeitGame(gameId, id);
        
        // Notify players
        io.to(`game:${gameId}`).emit('game_ended', {
          gameId,
          winner: result.winner,
          reason: 'forfeit'
        });
        
        // Update Elo ratings
        if (result.ratings) {
          result.ratings.forEach(rating => {
            io.to(`user:${rating.userId}`).emit('rating_updated', {
              oldRating: rating.oldRating,
              newRating: rating.newRating,
              change: rating.change
            });
          });
        }
        
        callback({ success: true });
      } catch (error) {
        logger.error('Error forfeiting game', { error: error.message, userId: id, gameId: data.gameId });
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

  // Store the io instance for use elsewhere if needed
  configureWebSockets.io = io;
  
  return io;
};

export { configureWebSockets };