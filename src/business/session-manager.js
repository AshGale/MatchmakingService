/**
 * SessionManager Class
 * 
 * Provides business logic for game session management, including session creation,
 * monitoring, and cleanup of inactive sessions.
 * 
 * This class implements session validation methods and serves as an abstraction layer
 * between the API routes and the database operations for session-related functionality.
 */

const { v4: uuidv4 } = require('uuid');
const { ValidationError } = require('../middleware/error.middleware');

/**
 * SessionManager class responsible for managing game sessions
 */
class SessionManager {
  /**
   * Creates a new SessionManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.lobbyManager - LobbyManager instance
   * @param {Object} options.matchmakingEngine - MatchmakingEngine instance
   * @param {Object} options.dbOperations - Database operations to use (for dependency injection)
   * @param {Number} options.sessionTimeoutMinutes - Session timeout in minutes (default: 30)
   */
  constructor(options = {}) {
    if (!options.lobbyManager) {
      throw new Error('LobbyManager is required for SessionManager');
    }
    
    this.lobbyManager = options.lobbyManager;
    this.matchmakingEngine = options.matchmakingEngine;
    
    // Use provided database operations or placeholder for testing
    this.dbOps = options.dbOperations || {
      cleanupExpiredSessions: async () => 0
    };
    
    this.sessionTimeoutMinutes = options.sessionTimeoutMinutes || 30;
    
    // In-memory session tracking (would use persistent storage in production)
    this.sessions = new Map();
    
    // Set up interval to clean up inactive sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions().catch(err => {
        console.error('Error cleaning up sessions:', err);
      });
    }, 60000); // Run cleanup every minute
  }
  
  /**
   * Creates a new game session
   * 
   * @param {Array<string>} playerIds - IDs of players in the session
   * @param {Object} settings - Game session settings
   * @param {string} settings.lobbyId - ID of the lobby this session is from
   * @param {string} settings.mode - Game mode
   * @returns {Promise<Object>} - Created session info
   */
  async createSession(playerIds, settings = {}) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      throw new ValidationError('At least one player is required to create a session', {
        code: 'INVALID_INPUT',
        details: { playerIds }
      });
    }
    
    if (!settings.lobbyId) {
      throw new ValidationError('Lobby ID is required for session creation', {
        code: 'INVALID_INPUT', 
        details: { settings }
      });
    }
    
    // Generate a unique session ID
    const sessionId = uuidv4();
    
    // Create session data
    const session = {
      id: sessionId,
      lobbyId: settings.lobbyId,
      status: 'active',
      playerIds: [...playerIds],
      playerCount: playerIds.length,
      mode: settings.mode || 'standard',
      settings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    
    // Store session in memory
    this.sessions.set(sessionId, session);
    
    // If we have a lobby manager, update the lobby status to active
    try {
      if (this.lobbyManager) {
        await this.lobbyManager.updateLobbyStatus(settings.lobbyId, 'active');
      }
    } catch (error) {
      console.warn('Failed to update lobby status on session creation:', error.message);
      // Don't fail the session creation if lobby update fails
    }
    
    return session;
  }
  
  /**
   * Ends a game session and performs cleanup
   * 
   * @param {string} sessionId - ID of the session to end
   * @param {Object} options - Additional options
   * @param {string} options.status - Final status ('completed', 'cancelled', 'error')
   * @returns {Promise<Object>} - Updated session info
   */
  async endSession(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new ValidationError(`Session with ID ${sessionId} not found`, {
        code: 'NOT_FOUND',
        details: { sessionId }
      });
    }
    
    // Update session state
    session.status = 'finished';
    session.endedAt = new Date().toISOString();
    session.outcome = options.status || 'completed';
    session.updatedAt = new Date().toISOString();
    
    // Update session in memory
    this.sessions.set(sessionId, session);
    
    // If we have a lobby manager, update the lobby status to finished
    try {
      if (this.lobbyManager) {
        await this.lobbyManager.updateLobbyStatus(session.lobbyId, 'finished');
      }
    } catch (error) {
      console.warn('Failed to update lobby status on session end:', error.message);
      // Don't fail the session ending if lobby update fails
    }
    
    return session;
  }
  
  /**
   * Gets the current status of a session
   * 
   * @param {string} sessionId - ID of the session to check
   * @returns {Promise<Object>} - Session status and details
   */
  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new ValidationError(`Session with ID ${sessionId} not found`, {
        code: 'NOT_FOUND',
        details: { sessionId }
      });
    }
    
    // Update last activity time
    session.lastActivityAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Lists all currently active sessions
   * 
   * @param {Object} options - Filter options
   * @param {string} options.status - Filter by status ('active', 'finished')
   * @returns {Promise<Array>} - List of sessions
   */
  async listActiveSessions(options = {}) {
    const { status } = options;
    
    // Convert Map to array and filter if needed
    let sessionList = Array.from(this.sessions.values());
    
    if (status) {
      sessionList = sessionList.filter(s => s.status === status);
    }
    
    return sessionList.sort((a, b) => {
      // Sort by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }
  
  /**
   * Updates the state of an ongoing session
   * 
   * @param {string} sessionId - ID of the session to update
   * @param {Object} newState - New state values
   * @returns {Promise<Object>} - Updated session
   */
  async updateSessionState(sessionId, newState) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new ValidationError(`Session with ID ${sessionId} not found`, {
        code: 'NOT_FOUND',
        details: { sessionId }
      });
    }
    
    if (session.status !== 'active') {
      throw new ValidationError(`Session is ${session.status}, cannot update state`, {
        code: 'INVALID_STATE',
        details: { sessionId, currentStatus: session.status }
      });
    }
    
    // Update allowed session properties
    const allowedUpdates = ['gameState', 'metadata', 'currentTurn'];
    
    for (const [key, value] of Object.entries(newState)) {
      if (allowedUpdates.includes(key)) {
        session[key] = value;
      }
    }
    
    // Always update these fields
    session.updatedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString();
    
    // Update session in memory
    this.sessions.set(sessionId, session);
    
    return session;
  }
  
  /**
   * Validates a session ID
   * 
   * @param {string} sessionId - Session ID to validate
   * @returns {Promise<boolean>} - Whether the session is valid
   */
  async isSessionValid(sessionId) {
    if (!sessionId) {
      return false;
    }
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Check if session is active
    if (session.status !== 'active') {
      return false;
    }
    
    // Check if session has expired
    const lastActivity = new Date(session.lastActivityAt).getTime();
    const currentTime = new Date().getTime();
    const timeoutMs = this.sessionTimeoutMinutes * 60 * 1000;
    
    if (currentTime - lastActivity > timeoutMs) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Cleans up expired/inactive sessions
   * 
   * @returns {Promise<number>} - Number of sessions cleaned up
   */
  async cleanupInactiveSessions() {
    const currentTime = new Date().getTime();
    const timeoutMs = this.sessionTimeoutMinutes * 60 * 1000;
    const expiredSessions = [];
    
    // Find expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'active') {
        const lastActivity = new Date(session.lastActivityAt).getTime();
        if (currentTime - lastActivity > timeoutMs) {
          expiredSessions.push(sessionId);
        }
      }
    }
    
    // Mark expired sessions as finished
    for (const sessionId of expiredSessions) {
      try {
        await this.endSession(sessionId, { status: 'timeout' });
      } catch (error) {
        console.error(`Error ending expired session ${sessionId}:`, error);
      }
    }
    
    // Call database cleanup if available
    try {
      if (this.dbOps.cleanupExpiredSessions) {
        await this.dbOps.cleanupExpiredSessions(this.sessionTimeoutMinutes);
      }
    } catch (error) {
      console.error('Database session cleanup failed:', error);
    }
    
    return expiredSessions.length;
  }
  
  /**
   * Clean up resources when SessionManager is no longer needed
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = SessionManager;
