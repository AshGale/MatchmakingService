/**
 * LobbyManager Class
 * 
 * Provides business logic for lobby management operations, including creating lobbies,
 * adding players, checking status transitions, and retrieving lobby information.
 * 
 * This class implements validation logic and serves as an abstraction layer between
 * the API routes and the database operations.
 * 
 * All operations use PostgreSQL database for persistent data storage.
 */

const {
  createLobby,
  addPlayerToLobby,
  updateLobbyStatus,
  getLobbyDetails,
  getLobbiesByStatus,
  removePlayerFromLobby
} = require('../utils/database/operations');

const { ValidationError } = require('../middleware/error.middleware');
const { DatabaseError, withRetry } = require('../utils/database/errors');
const { checkDatabaseStatus } = require('../utils/database/pool');
const dbConfig = require('../config/database');

/**
 * LobbyManager class responsible for managing player lobbies
 */
class LobbyManager {
  /**
   * Creates a new LobbyManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.dbOperations - Database operations to use (for dependency injection)
   */
  constructor(options = {}) {
    // Use provided database operations or default to imported ones for better testability
    this.dbOps = options.dbOperations || {
      createLobby,
      addPlayerToLobby,
      updateLobbyStatus,
      getLobbyDetails,
      getLobbiesByStatus,
      removePlayerFromLobby
    };
    
    // Valid lobby status transitions
    this.validTransitions = {
      'waiting': ['active'],
      'active': ['finished']
    };
    
    // Database connection status (initialized in checkConnectionStatus)
    this.dbStatus = null;
    
    // Check database connection immediately upon initialization
    this.checkConnectionStatus();
    
    // Set up periodic connection monitoring if enabled
    if (options.monitorConnection !== false) {
      this.connectionMonitorInterval = setInterval(
        () => this.checkConnectionStatus(),
        options.monitorIntervalMs || 60000 // Default: check every minute
      );
    }
  }

  /**
   * Creates a new lobby with the specified player as host
   * 
   * @param {string} playerId - ID of the player creating the lobby
   * @param {Object} settings - Lobby settings
   * @param {number} settings.maxPlayers - Maximum number of players (2-4)
   * @param {Object} options - Additional options for database operations
   * @returns {Promise<Object>} - The newly created lobby info
   * @throws {ValidationError} - If validation fails
   */
  async createLobby(playerId, settings, options = {}) {
    // Validate settings
    const { maxPlayers } = settings;
    
    if (!maxPlayers) {
      throw new ValidationError('Maximum players must be specified', { 
        code: 'INVALID_INPUT',
        details: { settings }
      });
    }
    
    try {
      // Create the lobby with retry capability for better resilience
      const lobbyId = await withRetry(async () => {
        return await this.dbOps.createLobby(maxPlayers, options);
      }, {
        maxRetries: 3,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
      
      // If a player ID is provided, add them to the lobby
      if (playerId) {
        await withRetry(async () => {
          return await this.dbOps.addPlayerToLobby(lobbyId, playerId, options);
        }, {
          maxRetries: 2,
          shouldRetry: (err) => err instanceof DatabaseError && err.retryable
        });
      }
      
      // Return the newly created lobby details
      return this.getLobbyInfo(lobbyId, options);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw new ValidationError(`Database error while creating lobby: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { maxPlayers }
        });
      }
      throw error;
    }
  }
  
  /**
   * Adds a player to an existing lobby
   * 
   * @param {string} playerId - ID of the player (session ID)
   * @param {string} lobbyId - ID of the lobby to join
   * @param {Object} options - Additional options for database operations
   * @returns {Promise<Object>} - Updated lobby info with players
   * @throws {ValidationError} - If validation fails
   */
  async joinLobby(playerId, lobbyId, options = {}) {
    // Validate inputs
    if (!playerId) {
      throw new ValidationError('Player ID is required', {
        code: 'INVALID_INPUT',
        details: { playerId }
      });
    }
    
    if (!lobbyId) {
      throw new ValidationError('Lobby ID is required', {
        code: 'INVALID_INPUT',
        details: { lobbyId }
      });
    }
    
    try {
      // Get lobby details first to check if it can be joined
      const lobby = await withRetry(async () => {
        return await this.getLobbyInfo(lobbyId, options);
      }, {
        maxRetries: 2,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
      
      // Check if lobby is in waiting state
      if (lobby.status !== 'waiting') {
        throw new ValidationError(`Cannot join lobby in '${lobby.status}' state`, {
          code: 'INVALID_STATE',
          details: { lobbyId, status: lobby.status }
        });
      }
      
      // Check if lobby is at capacity
      if (lobby.player_count >= lobby.max_players) {
        throw new ValidationError('Lobby is at capacity', {
          code: 'LOBBY_FULL',
          details: { lobbyId, playerCount: lobby.player_count, maxPlayers: lobby.max_players }
        });
      }
      
      // Check if player is already in the lobby
      if (lobby.players && lobby.players.some(player => player.session_id === playerId)) {
        throw new ValidationError('Player is already in the lobby', {
          code: 'PLAYER_EXISTS',
          details: { lobbyId, playerId }
        });
      }
      
      // Add player to the lobby with retry capability
      await withRetry(async () => {
        return await this.dbOps.addPlayerToLobby(lobbyId, playerId, options);
      }, {
        maxRetries: 3,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
      
      // Return updated lobby info
      return this.getLobbyInfo(lobbyId, options);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw new ValidationError(`Database error while joining lobby: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { lobbyId, playerId }
        });
      }
      throw error;
    }
  }
  
  /**
   * Removes a player from a lobby
   * 
   * @param {string} playerId - ID of the player to remove
   * @param {string} lobbyId - ID of the lobby
   * @param {Object} options - Additional options for database operations
   * @returns {Promise<Object>} - Updated lobby info without the player
   * @throws {ValidationError} - If validation fails
   */
  async leaveLobby(playerId, lobbyId, options = {}) {
    // Validate inputs
    if (!playerId) {
      throw new ValidationError('Player ID is required', {
        code: 'INVALID_INPUT',
        details: { playerId }
      });
    }
    
    if (!lobbyId) {
      throw new ValidationError('Lobby ID is required', {
        code: 'INVALID_INPUT',
        details: { lobbyId }
      });
    }
    
    try {
      // Use withRetry for better resiliency for transient errors
      const removed = await withRetry(async () => {
        return await this.dbOps.removePlayerFromLobby(lobbyId, playerId, options);
      }, { 
        maxRetries: 3,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
      
      if (!removed) {
        throw new ValidationError('Failed to remove player from lobby', {
          code: 'OPERATION_FAILED',
          details: { lobbyId, playerId }
        });
      }
      
      // Return updated lobby info
      return this.getLobbyInfo(lobbyId, options);
    } catch (error) {
      // Handle database errors and convert to validation errors
      if (error instanceof DatabaseError) {
        if (error.code === 'DB_NOT_FOUND' || error.code === 'NOT_FOUND') {
          throw new ValidationError(error.message || 'Lobby or player not found', {
            code: 'NOT_FOUND',
            details: { lobbyId, playerId }
          });
        }
        
        throw new ValidationError(`Database error: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { lobbyId, playerId }
        });
      }
      
      // Rethrow validation errors
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // For any other error, throw a validation error
      throw new ValidationError('Error removing player from lobby', {
        code: 'OPERATION_FAILED',
        cause: error,
        details: { lobbyId, playerId }
      });
    }
  }
  
  /**
   * Gets detailed information about a specific lobby
   * 
   * @param {string} lobbyId - ID of the lobby
   * @param {Object} options - Additional options for database operations
   * @returns {Promise<Object>} - Lobby details including players
   */
  async getLobbyInfo(lobbyId, options = {}) {
    if (!lobbyId) {
      throw new ValidationError('Lobby ID is required', {
        code: 'INVALID_INPUT',
        details: { lobbyId }
      });
    }
    
    try {
      return await withRetry(async () => {
        return await this.dbOps.getLobbyDetails(lobbyId, options);
      }, {
        maxRetries: 3,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.code === 'DB_NOT_FOUND' || error.code === 'NOT_FOUND') {
          throw new ValidationError(`Lobby not found: ${lobbyId}`, {
            code: 'NOT_FOUND',
            details: { lobbyId }
          });
        }
        
        throw new ValidationError(`Database error retrieving lobby: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { lobbyId }
        });
      }
      throw error;
    }
  }
  
  /**
   * Gets a list of lobbies with specified status
   * 
   * @param {string} status - Status to filter by ('waiting', 'active', 'finished')
   * @param {Object} options - Additional options
   * @param {number} options.limit - Maximum results to return
   * @param {number} options.offset - Results to skip (pagination)
   * @returns {Promise<Array>} - List of lobbies
   */
  async getLobbiesByStatus(status, options = {}) {
    try {
      return await withRetry(async () => {
        return await this.dbOps.getLobbiesByStatus(status, options);
      }, {
        maxRetries: 2,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw new ValidationError(`Database error retrieving lobbies: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { status, options }
        });
      }
      throw error;
    }
  }
  
  /**
   * Updates the status of a lobby with validation
   * 
   * @param {string} lobbyId - ID of the lobby to update
   * @param {string} newStatus - New status ('waiting', 'active', 'finished')
   * @param {Object} options - Additional options for database operations
   * @returns {Promise<Object>} - Updated lobby info
   * @throws {ValidationError} - If status transition is invalid
   */
  async updateLobbyStatus(lobbyId, newStatus, options = {}) {
    try {
      // Get current lobby info to check status
      const lobby = await this.getLobbyInfo(lobbyId, options);
      
      // Validate status transition
      const currentStatus = lobby.status;
      if (!this._isValidStatusTransition(currentStatus, newStatus)) {
        throw new ValidationError(`Invalid status transition from ${currentStatus} to ${newStatus}`, {
          code: 'INVALID_TRANSITION',
          details: { lobbyId, currentStatus, newStatus }
        });
      }
      
      // Update the status with retry capability
      const success = await withRetry(async () => {
        return await this.dbOps.updateLobbyStatus(lobbyId, newStatus, options);
      }, {
        maxRetries: 3,
        shouldRetry: (err) => err instanceof DatabaseError && err.retryable
      });
      
      if (!success) {
        throw new ValidationError('Failed to update lobby status', {
          code: 'UPDATE_FAILED',
          details: { lobbyId, newStatus }
        });
      }
      
      // Return updated lobby info
      return this.getLobbyInfo(lobbyId, options);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw new ValidationError(`Database error updating lobby status: ${error.message}`, {
          code: 'DB_ERROR',
          cause: error,
          details: { lobbyId, newStatus }
        });
      }
      throw error;
    }
  }
  
  /**
   * Checks if a status transition is valid
   * 
   * @private
   * @param {string} currentStatus - Current lobby status
   * @param {string} newStatus - Proposed new status
   * @returns {boolean} - Whether the transition is valid
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    // If statuses are the same, it's valid (no change)
    if (currentStatus === newStatus) {
      return true;
    }
    
    // Check if the current status can transition to the new status
    const allowedTransitions = this.validTransitions[currentStatus];
    return allowedTransitions && allowedTransitions.includes(newStatus);
  }
}

// Cleanup resources when the object is destroyed
LobbyManager.prototype.dispose = function() {
  this.stopConnectionMonitoring();
};

module.exports = LobbyManager;
