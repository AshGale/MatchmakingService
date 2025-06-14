/**
 * LobbyManager Class
 * 
 * Provides business logic for lobby management operations, including creating lobbies,
 * adding players, checking status transitions, and retrieving lobby information.
 * 
 * This class implements validation logic and serves as an abstraction layer between
 * the API routes and the database operations.
 */

const {
  createLobby,
  addPlayerToLobby,
  updateLobbyStatus,
  getLobbyDetails,
  getLobbiesByStatus
} = require('../utils/database/operations');

const { ValidationError } = require('../middleware/error.middleware');

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
      getLobbiesByStatus
    };
    
    // Valid lobby status transitions
    this.validTransitions = {
      'waiting': ['active'],
      'active': ['finished']
    };
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
    
    // Create the lobby
    const lobbyId = await this.dbOps.createLobby(maxPlayers, options);
    
    // If a player ID is provided, add them to the lobby
    if (playerId) {
      await this.dbOps.addPlayerToLobby(lobbyId, playerId, options);
    }
    
    // Return the newly created lobby details
    return this.getLobbyInfo(lobbyId, options);
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
    
    // Get lobby details first to check if it can be joined
    const lobby = await this.getLobbyInfo(lobbyId, options);
    
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
    
    // Add the player to the lobby
    await this.dbOps.addPlayerToLobby(lobbyId, playerId, options);
    
    // Return updated lobby info
    return this.getLobbyInfo(lobbyId, options);
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
      // Remove player from the lobby
      const removed = await this.dbOps.removePlayerFromLobby(lobbyId, playerId, options);
      
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
      if (error.code === 'NOT_FOUND') {
        throw new ValidationError(error.message, {
          code: 'NOT_FOUND',
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
    
    return this.dbOps.getLobbyDetails(lobbyId, options);
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
    return this.dbOps.getLobbiesByStatus(status, options);
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
    
    // Update the status
    const success = await this.dbOps.updateLobbyStatus(lobbyId, newStatus, options);
    
    if (!success) {
      throw new ValidationError('Failed to update lobby status', {
        code: 'UPDATE_FAILED',
        details: { lobbyId, newStatus }
      });
    }
    
    // Return updated lobby info
    return this.getLobbyInfo(lobbyId, options);
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

module.exports = LobbyManager;
