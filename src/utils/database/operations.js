/**
 * Database Operations Module
 * 
 * Provides high-level database operation functions for managing
 * lobbies, players, and game sessions in the matchmaking service.
 * 
 * These operations handle input validation, transaction management,
 * and error handling for common matchmaking service operations.
 */

const { withTransaction, executeTransactionQueries } = require('./transaction');
const { DatabaseError } = require('./errors');

/**
 * Creates a new lobby with the specified maximum player count
 * 
 * @param {number} maxPlayers - Maximum number of players (2-4)
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<string>} - The UUID of the newly created lobby
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function createLobby(maxPlayers, options = {}) {
  // Input validation
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    throw new DatabaseError('Max players must be between 2 and 4', {
      code: 'INVALID_INPUT',
      details: { maxPlayers }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      const result = await client.query(
        'SELECT create_lobby($1) AS lobby_id',
        [maxPlayers]
      );
      
      return result.rows[0].lobby_id;
    } catch (error) {
      throw new DatabaseError('Failed to create lobby', {
        cause: error,
        originalError: error,
        details: { maxPlayers }
      });
    }
  }, { client: options.client });
}

/**
 * Adds a player to an existing lobby
 * 
 * @param {string} lobbyId - UUID of the lobby to join
 * @param {string} sessionId - Player's session identifier
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<string>} - The UUID of the newly created player
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function addPlayerToLobby(lobbyId, sessionId, options = {}) {
  // Input validation
  if (!lobbyId) {
    throw new DatabaseError('Lobby ID is required', {
      code: 'INVALID_INPUT',
      details: { lobbyId }
    });
  }
  
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new DatabaseError('Valid session ID is required', {
      code: 'INVALID_INPUT',
      details: { sessionId }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      const result = await client.query(
        'SELECT add_player_to_lobby($1, $2) AS player_id',
        [lobbyId, sessionId]
      );
      
      return result.rows[0].player_id;
    } catch (error) {
      // Check for specific error conditions and provide better error messages
      if (error.message.includes('Lobby not found')) {
        throw new DatabaseError('Lobby not found', {
          code: 'NOT_FOUND',
          cause: error,
          details: { lobbyId }
        });
      } else if (error.message.includes('Lobby is full')) {
        throw new DatabaseError('Lobby is full', {
          code: 'LOBBY_FULL',
          cause: error,
          details: { lobbyId }
        });
      } else if (error.message.includes('Cannot join a lobby')) {
        throw new DatabaseError('Cannot join lobby in current state', {
          code: 'INVALID_STATE',
          cause: error,
          details: { lobbyId }
        });
      }
      
      throw new DatabaseError('Failed to add player to lobby', {
        cause: error,
        originalError: error,
        details: { lobbyId, sessionId }
      });
    }
  }, { client: options.client });
}

/**
 * Updates the status of a lobby
 * 
 * @param {string} lobbyId - UUID of the lobby to update
 * @param {string} newStatus - New status ('waiting', 'active', 'finished')
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<boolean>} - Whether the update was successful
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function updateLobbyStatus(lobbyId, newStatus, options = {}) {
  // Input validation
  if (!lobbyId) {
    throw new DatabaseError('Lobby ID is required', {
      code: 'INVALID_INPUT',
      details: { lobbyId }
    });
  }
  
  const validStatuses = ['waiting', 'active', 'finished'];
  if (!validStatuses.includes(newStatus)) {
    throw new DatabaseError('Invalid lobby status', {
      code: 'INVALID_INPUT',
      details: { newStatus, validStatuses }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      const result = await client.query(
        'SELECT update_lobby_status($1, $2::lobby_status) AS success',
        [lobbyId, newStatus]
      );
      
      return result.rows[0].success;
    } catch (error) {
      throw new DatabaseError('Failed to update lobby status', {
        cause: error,
        originalError: error,
        details: { lobbyId, newStatus }
      });
    }
  }, { client: options.client });
}

/**
 * Gets detailed information about a lobby, including its players
 * 
 * @param {string} lobbyId - UUID of the lobby to retrieve
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<Object>} - Lobby details including players
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function getLobbyDetails(lobbyId, options = {}) {
  // Input validation
  if (!lobbyId) {
    throw new DatabaseError('Lobby ID is required', {
      code: 'INVALID_INPUT',
      details: { lobbyId }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      // Get lobby information
      const lobbyResult = await client.query(
        `SELECT 
          id, player_count, max_players, status, 
          created_at, updated_at
        FROM lobbies
        WHERE id = $1`,
        [lobbyId]
      );
      
      if (lobbyResult.rows.length === 0) {
        throw new DatabaseError('Lobby not found', {
          code: 'NOT_FOUND',
          details: { lobbyId }
        });
      }
      
      const lobby = lobbyResult.rows[0];
      
      // Get players in this lobby
      const playersResult = await client.query(
        `SELECT 
          id, session_id, join_order, joined_at
        FROM players
        WHERE lobby_id = $1
        ORDER BY join_order`,
        [lobbyId]
      );
      
      // Return combined results
      return {
        ...lobby,
        players: playersResult.rows
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to get lobby details', {
        cause: error,
        originalError: error,
        details: { lobbyId }
      });
    }
  }, { client: options.client, readOnly: true });
}

/**
 * Gets a list of lobbies with the specified status
 * 
 * @param {string} status - Status to filter by ('waiting', 'active', 'finished')
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @param {number} options.limit - Maximum number of results to return (default: 50)
 * @param {number} options.offset - Number of results to skip (for pagination)
 * @returns {Promise<Array>} - Array of lobbies matching the status
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function getLobbiesByStatus(status, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  // Input validation
  const validStatuses = ['waiting', 'active', 'finished'];
  if (!validStatuses.includes(status)) {
    throw new DatabaseError('Invalid lobby status', {
      code: 'INVALID_INPUT',
      details: { status, validStatuses }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      const result = await client.query(
        `SELECT * FROM get_lobbies_by_status($1::lobby_status)
        LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to get lobbies by status', {
        cause: error,
        originalError: error,
        details: { status, limit, offset }
      });
    }
  }, { client: options.client, readOnly: true });
}

/**
 * Cleans up expired sessions older than the specified timeout
 * 
 * @param {number} timeoutMinutes - Timeout in minutes for inactive lobbies
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<number>} - Number of sessions cleaned up
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function cleanupExpiredSessions(timeoutMinutes, options = {}) {
  // Input validation
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes <= 0) {
    throw new DatabaseError('Timeout minutes must be a positive integer', {
      code: 'INVALID_INPUT',
      details: { timeoutMinutes }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      const result = await client.query(
        'SELECT cleanup_expired_sessions($1) AS count',
        [timeoutMinutes]
      );
      
      return result.rows[0].count;
    } catch (error) {
      throw new DatabaseError('Failed to cleanup expired sessions', {
        cause: error,
        originalError: error,
        details: { timeoutMinutes }
      });
    }
  }, { client: options.client });
}

/**
 * Removes a player from a lobby
 * 
 * @param {string} lobbyId - UUID of the lobby
 * @param {string} playerId - UUID of the player to remove
 * @param {Object} options - Additional options
 * @param {Object} options.client - Optional database client for transaction control
 * @returns {Promise<boolean>} - Whether the player was successfully removed
 * @throws {DatabaseError} - If validation fails or database operation errors
 */
async function removePlayerFromLobby(lobbyId, playerId, options = {}) {
  // Input validation
  if (!lobbyId) {
    throw new DatabaseError('Lobby ID is required', {
      code: 'INVALID_INPUT',
      details: { lobbyId }
    });
  }
  
  if (!playerId) {
    throw new DatabaseError('Player ID is required', {
      code: 'INVALID_INPUT',
      details: { playerId }
    });
  }
  
  return withTransaction(async (client) => {
    try {
      // Check if lobby exists
      const lobbyCheck = await client.query(
        'SELECT id, status FROM lobbies WHERE id = $1', 
        [lobbyId]
      );
      
      if (lobbyCheck.rows.length === 0) {
        throw new DatabaseError('Lobby not found', {
          code: 'NOT_FOUND',
          details: { lobbyId }
        });
      }
      
      // Check if player exists in this lobby
      const playerCheck = await client.query(
        'SELECT id FROM players WHERE id = $1 AND lobby_id = $2',
        [playerId, lobbyId]
      );
      
      if (playerCheck.rows.length === 0) {
        throw new DatabaseError('Player not found in this lobby', {
          code: 'NOT_FOUND',
          details: { playerId, lobbyId }
        });
      }
      
      // Remove player
      const result = await client.query(
        'DELETE FROM players WHERE id = $1 AND lobby_id = $2 RETURNING id',
        [playerId, lobbyId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to remove player from lobby', {
        cause: error,
        originalError: error,
        details: { lobbyId, playerId }
      });
    }
  }, { client: options.client });
}

module.exports = {
  createLobby,
  addPlayerToLobby,
  updateLobbyStatus,
  getLobbyDetails,
  getLobbiesByStatus,
  cleanupExpiredSessions,
  removePlayerFromLobby
};
