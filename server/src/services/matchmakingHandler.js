// server/src/services/matchmakingHandler.js
import MatchmakingService from './matchmakingService.js';
import UserService from './userService.js';
import logger from '../utils/logger.js';

/**
 * Handler for matchmaking WebSocket events
 */
class MatchmakingHandler {
  constructor(io) {
    this.io = io;
    this.matchmakingService = new MatchmakingService();
    this.userService = new UserService();
    this.playerSocketMap = new Map(); // userId -> socketId
    this.matchmakingService.start();
    
    // Setup event handler for new matches
    this.setupMatchCreationHandler();
  }
  
  /**
   * Register a socket for matchmaking events
   * @param {Object} socket - Socket.io socket
   */
  registerSocket(socket) {
    const userId = socket.user.id;
    
    this.playerSocketMap.set(userId, socket.id);
    
    // Join matchmaking queue
    socket.on('join_matchmaking_queue', async (data, callback) => {
      try {
        // Get the player's Elo rating
        const user = await this.userService.getUserById(userId);
        if (!user) {
          throw new Error('User not found');
        }
        
        const eloRating = user.eloRating || 1000; // Default to 1000 if not set
        
        // Add to queue
        const result = this.matchmakingService.addToQueue(userId, eloRating);
        
        // If result is an object, a match was found immediately
        if (result && typeof result === 'object') {
          // Handle match - already done in the setupMatchCreationHandler
          callback({ success: true, match: result });
        } else {
          // No immediate match
          socket.join('matchmaking-queue');
          callback({ success: true, inQueue: true });
          
          // Broadcast queue update to all users in matchmaking
          this.broadcastQueueStats();
        }
      } catch (error) {
        logger.error('Error joining matchmaking queue', {
          userId,
          error: error.message
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Leave matchmaking queue
    socket.on('leave_matchmaking_queue', (data, callback) => {
      try {
        const removed = this.matchmakingService.removeFromQueue(userId);
        
        if (removed) {
          socket.leave('matchmaking-queue');
          this.broadcastQueueStats();
        }
        
        callback({ success: true, removed });
      } catch (error) {
        logger.error('Error leaving matchmaking queue', {
          userId,
          error: error.message
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Get current queue stats
    socket.on('get_matchmaking_stats', (data, callback) => {
      try {
        const stats = this.matchmakingService.getQueueStats();
        callback({ success: true, stats });
      } catch (error) {
        logger.error('Error getting matchmaking stats', {
          userId,
          error: error.message
        });
        callback({ success: false, error: error.message });
      }
    });
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      // Remove from queue on disconnect
      this.matchmakingService.removeFromQueue(userId);
      this.playerSocketMap.delete(userId);
      this.broadcastQueueStats();
    });
  }
  
  /**
   * Setup handler for match creation events
   */
  setupMatchCreationHandler() {
    // Process the queue every 5 seconds
    setInterval(() => {
      const matches = this.matchmakingService.processQueue();
      
      // Notify players of matches
      matches.forEach(match => {
        this.notifyMatchCreated(match);
      });
      
      // Broadcast updated queue stats after processing
      if (matches.length > 0) {
        this.broadcastQueueStats();
      }
    }, 5000);
  }
  
  /**
   * Notify players about a created match
   * @param {Object} match - Match details
   */
  notifyMatchCreated(match) {
    const { gameId, whitePlayerId, blackPlayerId, whiteElo, blackElo } = match;
    
    // Get socket IDs for both players
    const whiteSocketId = this.playerSocketMap.get(whitePlayerId);
    const blackSocketId = this.playerSocketMap.get(blackPlayerId);
    
    if (whiteSocketId) {
      this.io.to(whiteSocketId).emit('match_found', {
        gameId,
        role: 'white',
        opponent: {
          id: blackPlayerId,
          eloRating: blackElo
        },
        yourElo: whiteElo
      });
    }
    
    if (blackSocketId) {
      this.io.to(blackSocketId).emit('match_found', {
        gameId,
        role: 'black',
        opponent: {
          id: whitePlayerId,
          eloRating: whiteElo
        },
        yourElo: blackElo
      });
    }
    
    // Create a game room for both players
    if (whiteSocketId) {
      this.io.sockets.sockets.get(whiteSocketId)?.join(`game:${gameId}`);
    }
    
    if (blackSocketId) {
      this.io.sockets.sockets.get(blackSocketId)?.join(`game:${gameId}`);
    }
    
    // Emit game_started event to the game room
    this.io.to(`game:${gameId}`).emit('game_started', {
      gameId,
      whitePlayerId,
      blackPlayerId,
      whiteElo,
      blackElo,
      startTime: Date.now()
    });
    
    logger.info('Match created and players notified', {
      gameId,
      whitePlayerId,
      blackPlayerId
    });
  }
  
  /**
   * Broadcast queue stats to all users in the matchmaking queue
   */
  broadcastQueueStats() {
    const stats = this.matchmakingService.getQueueStats();
    this.io.to('matchmaking-queue').emit('matchmaking_queue_update', stats);
  }
  
  /**
   * Stop the matchmaking service
   */
  stop() {
    this.matchmakingService.stop();
  }
}

export default MatchmakingHandler;
