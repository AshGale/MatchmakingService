// server/src/services/lobbyStateManager.js
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// Define lobby states
const LOBBY_STATES = {
  CREATED: 'created',      // Just created, waiting for players
  FILLING: 'filling',      // Players are joining
  READY: 'ready',          // Enough players to start a game
  IN_GAME: 'in_game',      // Game in progress
  COMPLETED: 'completed'   // Game finished
};

class LobbyStateManager {
  constructor(lobbyModel, io) {
    this.lobbyModel = lobbyModel;
    this.io = io;
    this.activeLobbies = new Map(); // In-memory cache of active lobbies
    this.lobbyTimeouts = new Map(); // Store timeout IDs for lobby expiration
    
    // Initialize by loading active lobbies from database
    this.loadActiveLobbies();
  }

  async loadActiveLobbies() {
    try {
      const lobbies = await this.lobbyModel.getActiveLobbies();
      lobbies.forEach(lobby => {
        this.activeLobbies.set(lobby.id, {
          ...lobby,
          _inMemoryState: {
            lastActivity: Date.now(),
            connectedPlayers: new Set()
          }
        });
      });
      logger.info(`Loaded ${lobbies.length} active lobbies from database`);
    } catch (error) {
      logger.error('Error loading active lobbies', { error: error.message });
    }
  }

  // State transition management
  async transitionState(lobbyId, newState) {
    const lobby = this.activeLobbies.get(lobbyId);
    
    if (!lobby) {
      logger.error(`Cannot transition state: Lobby ${lobbyId} not found in memory`);
      return false;
    }
    
    const oldState = lobby.status;
    
    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      logger.warn(`Invalid lobby state transition: ${oldState} -> ${newState}`);
      return false;
    }
    
    // Update in memory
    lobby.status = newState;
    lobby._inMemoryState.lastActivity = Date.now();
    
    // Update in database
    try {
      await this.lobbyModel.update(lobbyId, { 
        status: newState,
        updated_at: new Date()
      });
      
      // Broadcast state change to all clients in the lobby
      this.io.to(`lobby:${lobbyId}`).emit('lobby_state_changed', {
        lobbyId,
        oldState,
        newState,
        timestamp: Date.now()
      });
      
      logger.info(`Lobby ${lobbyId} state changed: ${oldState} -> ${newState}`);
      return true;
    } catch (error) {
      logger.error(`Error updating lobby state`, { error: error.message, lobbyId });
      return false;
    }
  }
  
  isValidTransition(fromState, toState) {
    // Define valid state transitions
    const validTransitions = {
      [LOBBY_STATES.CREATED]: [LOBBY_STATES.FILLING, LOBBY_STATES.COMPLETED],
      [LOBBY_STATES.FILLING]: [LOBBY_STATES.READY, LOBBY_STATES.COMPLETED],
      [LOBBY_STATES.READY]: [LOBBY_STATES.IN_GAME, LOBBY_STATES.FILLING, LOBBY_STATES.COMPLETED],
      [LOBBY_STATES.IN_GAME]: [LOBBY_STATES.COMPLETED, LOBBY_STATES.READY],
      [LOBBY_STATES.COMPLETED]: []
    };
    
    // Handle initial state for new lobbies
    if (!fromState && toState === LOBBY_STATES.CREATED) {
      return true;
    }
    
    return validTransitions[fromState]?.includes(toState) || false;
  }
  
  // Player ready status management
  async setPlayerReady(lobbyId, playerId, isReady) {
    try {
      const result = await this.lobbyModel.setPlayerReady(lobbyId, playerId, isReady);
      
      if (result.success) {
        // Check if all players are ready
        const lobby = await this.lobbyModel.getLobbyWithPlayers(lobbyId);
        
        if (lobby && lobby.players.length >= 2 && lobby.players.every(p => p.is_ready)) {
          // All players are ready, transition to READY state
          await this.transitionState(lobbyId, LOBBY_STATES.READY);
        } else if (lobby && lobby.status === LOBBY_STATES.READY && !lobby.players.every(p => p.is_ready)) {
          // Not all players are ready anymore, go back to FILLING
          await this.transitionState(lobbyId, LOBBY_STATES.FILLING);
        }
        
        // Notify all players in the lobby
        this.io.to(`lobby:${lobbyId}`).emit('player_ready_status_changed', {
          lobbyId,
          playerId,
          isReady,
          allReady: lobby.players.every(p => p.is_ready)
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error setting player ready status', { error: error.message, lobbyId, playerId });
      throw error;
    }
  }
  
  // Player connection tracking
  playerConnected(lobbyId, playerId, socketId) {
    const lobby = this.activeLobbies.get(lobbyId);
    
    if (!lobby) {
      return false;
    }
    
    // Add to connected players
    lobby._inMemoryState.connectedPlayers.add(playerId);
    
    // Clear any expiration timeout if all players are connected
    this.refreshLobbyTimeout(lobbyId);
    
    return true;
  }
  
  playerDisconnected(lobbyId, playerId) {
    const lobby = this.activeLobbies.get(lobbyId);
    
    if (!lobby) {
      return false;
    }
    
    // Remove from connected players
    lobby._inMemoryState.connectedPlayers.delete(playerId);
    
    // If nobody is connected, set an expiration timeout
    if (lobby._inMemoryState.connectedPlayers.size === 0) {
      this.setLobbyExpiration(lobbyId);
    }
    
    return true;
  }
  
  // Lobby lifecycle management
  refreshLobbyTimeout(lobbyId) {
    // Clear any existing timeout
    if (this.lobbyTimeouts.has(lobbyId)) {
      clearTimeout(this.lobbyTimeouts.get(lobbyId));
      this.lobbyTimeouts.delete(lobbyId);
    }
  }
  
  setLobbyExpiration(lobbyId) {
    // Set lobby to expire after 15 minutes of inactivity
    const timeoutId = setTimeout(async () => {
      try {
        const lobby = this.activeLobbies.get(lobbyId);
        
        if (lobby && lobby._inMemoryState.connectedPlayers.size === 0) {
          // No one has reconnected, close the lobby
          await this.transitionState(lobbyId, LOBBY_STATES.COMPLETED);
          this.activeLobbies.delete(lobbyId);
          logger.info(`Lobby ${lobbyId} auto-closed due to inactivity`);
        }
      } catch (error) {
        logger.error('Error auto-closing inactive lobby', { error: error.message, lobbyId });
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    this.lobbyTimeouts.set(lobbyId, timeoutId);
  }
  
  // Lobby chat functionality
  async addChatMessage(lobbyId, userId, username, message) {
    try {
      // Create message object
      const chatMessage = {
        id: uuidv4(),
        lobbyId,
        userId,
        username,
        message,
        timestamp: Date.now()
      };
      
      // Store in database if needed
      // await this.lobbyModel.addChatMessage(lobbyId, chatMessage);
      
      // Broadcast to all players in the lobby
      this.io.to(`lobby:${lobbyId}`).emit('lobby_chat_message', chatMessage);
      
      return chatMessage;
    } catch (error) {
      logger.error('Error adding chat message', { error: error.message, lobbyId, userId });
      throw error;
    }
  }
  
  // Game start functionality
  async initializeGame(lobbyId, userId) {
    try {
      const lobby = this.activeLobbies.get(lobbyId);
      
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      
      if (lobby.host_id !== userId) {
        throw new Error('Only the host can start the game');
      }
      
      if (lobby.status !== LOBBY_STATES.READY) {
        throw new Error('Lobby is not ready to start game');
      }
      
      // Transition to IN_GAME state
      await this.transitionState(lobbyId, LOBBY_STATES.IN_GAME);
      
      // Start the game (implementation depends on game service)
      const gameId = uuidv4(); // Replace with actual game creation
      
      // Notify all players
      this.io.to(`lobby:${lobbyId}`).emit('game_started', {
        lobbyId,
        gameId,
        timestamp: Date.now()
      });
      
      return { success: true, gameId };
    } catch (error) {
      logger.error('Error initializing game', { error: error.message, lobbyId, userId });
      throw error;
    }
  }
}

export { LobbyStateManager, LOBBY_STATES };
