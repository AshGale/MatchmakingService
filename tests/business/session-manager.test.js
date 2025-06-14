/**
 * SessionManager Tests
 * 
 * This file contains unit tests for the SessionManager business logic class.
 * Tests cover session creation, monitoring, validation, and cleanup.
 */

const SessionManager = require('../../src/business/session-manager');
const { ValidationError } = require('../../src/middleware/error.middleware');

// Create mock dependencies for testing
const mockLobbyManager = {
  updateLobbyStatus: jest.fn()
};

// Mock database operations
const mockDbOps = {
  cleanupExpiredSessions: jest.fn()
};

describe('SessionManager', () => {
  let sessionManager;
  
  beforeEach(() => {
    // Create a new SessionManager instance with mocks
    sessionManager = new SessionManager({ 
      lobbyManager: mockLobbyManager,
      dbOperations: mockDbOps,
      sessionTimeoutMinutes: 5 // Shorter timeout for testing
    });
    
    // Reset all mocks before each test
    jest.resetAllMocks();
    
    // Mock Date for predictable testing
    jest.spyOn(global, 'Date').mockImplementation(() => ({
      toISOString: () => '2021-06-18T10:00:00.000Z',
      getTime: () => 1624000000000
    }));
  });
  
  afterEach(() => {
    // Clean up resources
    sessionManager.cleanup();
    
    // Restore original Date
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    it('should throw error if lobbyManager is not provided', () => {
      expect(() => new SessionManager()).toThrow('LobbyManager is required');
    });
    
    it('should initialize with default values', () => {
      expect(sessionManager.lobbyManager).toBe(mockLobbyManager);
      expect(sessionManager.sessionTimeoutMinutes).toBe(5);
      expect(sessionManager.sessions).toBeDefined();
      expect(sessionManager.cleanupInterval).toBeDefined();
    });
  });
  
  describe('createSession', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerIds = ['session-123', 'session-456'];
    
    it('should create a new session with valid inputs', async () => {
      // Setup
      mockLobbyManager.updateLobbyStatus.mockResolvedValueOnce({});
      
      // Execute
      const result = await sessionManager.createSession(playerIds, { lobbyId });
      
      // Verify
      expect(result.id).toBeDefined();
      expect(result.lobbyId).toBe(lobbyId);
      expect(result.playerIds).toEqual(playerIds);
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
      expect(mockLobbyManager.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, 'active');
    });
    
    it('should throw ValidationError if playerIds is not an array', async () => {
      await expect(sessionManager.createSession('not-an-array', { lobbyId }))
        .rejects.toThrow(ValidationError);
    });
    
    it('should throw ValidationError if playerIds is empty', async () => {
      await expect(sessionManager.createSession([], { lobbyId }))
        .rejects.toThrow(ValidationError);
    });
    
    it('should throw ValidationError if lobbyId is missing', async () => {
      await expect(sessionManager.createSession(playerIds, {}))
        .rejects.toThrow(ValidationError);
    });
    
    it('should still create session even if lobby update fails', async () => {
      // Setup
      mockLobbyManager.updateLobbyStatus.mockRejectedValueOnce(new Error('Failed to update lobby'));
      
      // Execute
      const result = await sessionManager.createSession(playerIds, { lobbyId });
      
      // Verify session was still created despite lobby update failure
      expect(result.id).toBeDefined();
      expect(result.status).toBe('active');
    });
  });
  
  describe('endSession', () => {
    const sessionId = 'test-session-id';
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerIds = ['session-123', 'session-456'];
    
    beforeEach(async () => {
      // Create a test session first
      await sessionManager.createSession(playerIds, { lobbyId });
      
      // Manually set the session ID for predictable tests
      const session = Array.from(sessionManager.sessions.values())[0];
      session.id = sessionId;
      sessionManager.sessions.set(sessionId, session);
      
      // Clear the mocks after setup
      jest.clearAllMocks();
    });
    
    it('should end a session with valid ID', async () => {
      // Setup
      mockLobbyManager.updateLobbyStatus.mockResolvedValueOnce({});
      
      // Execute
      const result = await sessionManager.endSession(sessionId);
      
      // Verify
      expect(result.status).toBe('finished');
      expect(result.endedAt).toBeDefined();
      expect(result.outcome).toBe('completed');
      expect(mockLobbyManager.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, 'finished');
    });
    
    it('should set custom outcome status if provided', async () => {
      // Execute
      const result = await sessionManager.endSession(sessionId, { status: 'cancelled' });
      
      // Verify
      expect(result.outcome).toBe('cancelled');
    });
    
    it('should throw ValidationError if session does not exist', async () => {
      await expect(sessionManager.endSession('non-existent'))
        .rejects.toThrow(ValidationError);
    });
    
    it('should still end session even if lobby update fails', async () => {
      // Setup
      mockLobbyManager.updateLobbyStatus.mockRejectedValueOnce(new Error('Failed to update lobby'));
      
      // Execute
      const result = await sessionManager.endSession(sessionId);
      
      // Verify session was still ended despite lobby update failure
      expect(result.status).toBe('finished');
    });
  });
  
  describe('getSessionStatus', () => {
    const sessionId = 'test-session-id';
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerIds = ['session-123', 'session-456'];
    
    beforeEach(async () => {
      // Create a test session first
      await sessionManager.createSession(playerIds, { lobbyId });
      
      // Manually set the session ID for predictable tests
      const session = Array.from(sessionManager.sessions.values())[0];
      session.id = sessionId;
      sessionManager.sessions.set(sessionId, session);
    });
    
    it('should return session status for valid ID', async () => {
      // Execute
      const result = await sessionManager.getSessionStatus(sessionId);
      
      // Verify
      expect(result.id).toBe(sessionId);
      expect(result.status).toBe('active');
      expect(result.lastActivityAt).toBeDefined();
    });
    
    it('should throw ValidationError if session does not exist', async () => {
      await expect(sessionManager.getSessionStatus('non-existent'))
        .rejects.toThrow(ValidationError);
    });
    
    it('should update lastActivityAt when checking status', async () => {
      // Setup - record initial activity time
      const initialSession = await sessionManager.getSessionStatus(sessionId);
      const initialActivity = initialSession.lastActivityAt;
      
      // Mock a time change
      jest.spyOn(global, 'Date').mockImplementation(() => ({
        toISOString: () => '2021-06-18T10:01:00.000Z',
        getTime: () => 1624000060000
      }));
      
      // Execute
      const updatedSession = await sessionManager.getSessionStatus(sessionId);
      
      // Verify
      expect(updatedSession.lastActivityAt).not.toBe(initialActivity);
    });
  });
  
  describe('listActiveSessions', () => {
    const lobbyId1 = '123e4567-e89b-12d3-a456-426614174000';
    const lobbyId2 = '223e4567-e89b-12d3-a456-426614174001';
    
    beforeEach(async () => {
      // Create a few test sessions
      await sessionManager.createSession(['player1'], { lobbyId: lobbyId1 });
      await sessionManager.createSession(['player2', 'player3'], { lobbyId: lobbyId2 });
      
      // End one session
      const sessionIds = Array.from(sessionManager.sessions.keys());
      await sessionManager.endSession(sessionIds[0]);
    });
    
    it('should list all sessions when no filter is provided', async () => {
      // Execute
      const result = await sessionManager.listActiveSessions();
      
      // Verify
      expect(result).toHaveLength(2);
    });
    
    it('should filter sessions by status', async () => {
      // Execute
      const activeSessions = await sessionManager.listActiveSessions({ status: 'active' });
      const finishedSessions = await sessionManager.listActiveSessions({ status: 'finished' });
      
      // Verify
      expect(activeSessions).toHaveLength(1);
      expect(finishedSessions).toHaveLength(1);
    });
  });
  
  describe('updateSessionState', () => {
    const sessionId = 'test-session-id';
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerIds = ['session-123', 'session-456'];
    
    beforeEach(async () => {
      // Create a test session first
      await sessionManager.createSession(playerIds, { lobbyId });
      
      // Manually set the session ID for predictable tests
      const session = Array.from(sessionManager.sessions.values())[0];
      session.id = sessionId;
      sessionManager.sessions.set(sessionId, session);
    });
    
    it('should update allowed session state properties', async () => {
      // Execute
      const result = await sessionManager.updateSessionState(sessionId, {
        gameState: { round: 2, score: [10, 5] },
        metadata: { mapName: 'Forest' },
        currentTurn: 'session-123'
      });
      
      // Verify
      expect(result.gameState).toEqual({ round: 2, score: [10, 5] });
      expect(result.metadata).toEqual({ mapName: 'Forest' });
      expect(result.currentTurn).toBe('session-123');
    });
    
    it('should ignore non-allowed properties', async () => {
      // Execute
      const result = await sessionManager.updateSessionState(sessionId, {
        status: 'hacked',
        playerIds: ['hacker'],
        notAllowed: true
      });
      
      // Verify these weren't changed
      expect(result.status).toBe('active');
      expect(result.playerIds).toEqual(playerIds);
      expect(result.notAllowed).toBeUndefined();
    });
    
    it('should throw ValidationError if session does not exist', async () => {
      await expect(sessionManager.updateSessionState('non-existent', {}))
        .rejects.toThrow(ValidationError);
    });
    
    it('should throw ValidationError if session is not active', async () => {
      // End the session first
      await sessionManager.endSession(sessionId);
      
      // Try to update it
      await expect(sessionManager.updateSessionState(sessionId, { gameState: {} }))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('isSessionValid', () => {
    const sessionId = 'test-session-id';
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerIds = ['session-123', 'session-456'];
    
    beforeEach(async () => {
      // Create a test session first
      await sessionManager.createSession(playerIds, { lobbyId });
      
      // Manually set the session ID for predictable tests
      const session = Array.from(sessionManager.sessions.values())[0];
      session.id = sessionId;
      sessionManager.sessions.set(sessionId, session);
    });
    
    it('should return true for valid active session', async () => {
      // Execute
      const result = await sessionManager.isSessionValid(sessionId);
      
      // Verify
      expect(result).toBe(true);
    });
    
    it('should return false for non-existent session', async () => {
      // Execute
      const result = await sessionManager.isSessionValid('non-existent');
      
      // Verify
      expect(result).toBe(false);
    });
    
    it('should return false for null or undefined session ID', async () => {
      // Execute & Verify
      expect(await sessionManager.isSessionValid(null)).toBe(false);
      expect(await sessionManager.isSessionValid(undefined)).toBe(false);
    });
    
    it('should return false for expired session', async () => {
      // Get the session
      const session = sessionManager.sessions.get(sessionId);
      
      // Set last activity to be older than the timeout
      const oldTimeMs = 1624000000000 - (6 * 60 * 1000); // 6 minutes ago, session timeout is 5 min
      session.lastActivityAt = new Date(oldTimeMs).toISOString();
      sessionManager.sessions.set(sessionId, session);
      
      // Execute
      const result = await sessionManager.isSessionValid(sessionId);
      
      // Verify
      expect(result).toBe(false);
    });
    
    it('should return false for finished session', async () => {
      // End the session
      await sessionManager.endSession(sessionId);
      
      // Execute
      const result = await sessionManager.isSessionValid(sessionId);
      
      // Verify
      expect(result).toBe(false);
    });
  });
  
  describe('cleanupInactiveSessions', () => {
    const sessionId1 = 'test-session-1';
    const sessionId2 = 'test-session-2';
    const sessionId3 = 'test-session-3';
    
    beforeEach(async () => {
      // Create three sessions
      for (let i = 1; i <= 3; i++) {
        const session = await sessionManager.createSession([`player${i}`], { lobbyId: `lobby${i}` });
        const sessionId = `test-session-${i}`;
        session.id = sessionId;
        sessionManager.sessions.set(sessionId, session);
      }
      
      // Session 1: Active but expired (old lastActivityAt)
      const session1 = sessionManager.sessions.get(sessionId1);
      const oldTimeMs = 1624000000000 - (10 * 60 * 1000); // 10 minutes ago
      session1.lastActivityAt = new Date(oldTimeMs).toISOString();
      sessionManager.sessions.set(sessionId1, session1);
      
      // Session 2: Already finished (should not be affected)
      await sessionManager.endSession(sessionId2);
      
      // Session 3: Active and recent (should not be affected)
      
      // Clear mocks after setup
      jest.clearAllMocks();
    });
    
    it('should clean up expired active sessions', async () => {
      // Execute
      const result = await sessionManager.cleanupInactiveSessions();
      
      // Verify
      expect(result).toBe(1); // Only one session should be cleaned up
      
      // The expired session should now be finished
      const cleanedSession = sessionManager.sessions.get(sessionId1);
      expect(cleanedSession.status).toBe('finished');
      expect(cleanedSession.outcome).toBe('timeout');
      
      // Database cleanup should be called
      expect(mockDbOps.cleanupExpiredSessions).toHaveBeenCalledWith(5);
    });
    
    it('should not affect already finished or active valid sessions', async () => {
      // Execute
      await sessionManager.cleanupInactiveSessions();
      
      // Verify - session 2 should still be finished
      const finishedSession = sessionManager.sessions.get(sessionId2);
      expect(finishedSession.status).toBe('finished');
      
      // Session 3 should still be active
      const activeSession = sessionManager.sessions.get(sessionId3);
      expect(activeSession.status).toBe('active');
    });
    
    it('should handle errors during session ending gracefully', async () => {
      // Setup - make endSession throw for the first call
      jest.spyOn(sessionManager, 'endSession').mockImplementationOnce(() => {
        throw new Error('Failed to end session');
      });
      
      // Execute - should not throw
      const result = await sessionManager.cleanupInactiveSessions();
      
      // Verify - result should still be 0 since none were successfully cleaned
      expect(result).toBe(0);
    });
  });
});
