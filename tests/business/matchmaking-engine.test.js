/**
 * MatchmakingEngine Tests
 * 
 * This file contains unit tests for the MatchmakingEngine business logic class.
 * Tests cover matchmaking algorithms, queue management, and player matching.
 */

const { ValidationError } = require('../../src/middleware/error.middleware');

// Mock uuid module before requiring the module that uses it
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-queue-id')
}));

const MatchmakingEngine = require('../../src/business/matchmaking-engine');
const uuid = require('uuid');

// Create mock LobbyManager for testing
const mockLobbyManager = {
  createLobby: jest.fn(),
  joinLobby: jest.fn(),
  getLobbyInfo: jest.fn(),
  getLobbiesByStatus: jest.fn(),
  updateLobbyStatus: jest.fn()
};

describe('MatchmakingEngine', () => {
  let matchmakingEngine;
  
  beforeEach(() => {
    // Create a new MatchmakingEngine instance with mock LobbyManager
    matchmakingEngine = new MatchmakingEngine({ 
      lobbyManager: mockLobbyManager,
      matchTimeout: 15
    });
    
    // Reset all mocks before each test
    jest.resetAllMocks();
  });
  
  afterEach(() => {
    // Clean up intervals to avoid memory leaks
    matchmakingEngine.cleanup();
  });
  
  describe('constructor', () => {
    it('should throw error if lobbyManager is not provided', () => {
      expect(() => new MatchmakingEngine()).toThrow('LobbyManager is required');
    });
    
    it('should initialize with default values', () => {
      expect(matchmakingEngine.lobbyManager).toBe(mockLobbyManager);
      expect(matchmakingEngine.matchTimeout).toBe(15);
    });
  });
  
  describe('findMatch', () => {
    const playerId = 'session-123';
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    
    it('should throw ValidationError if playerId is missing', async () => {
      await expect(matchmakingEngine.findMatch(null)).rejects.toThrow(ValidationError);
    });
    
    it('should find an existing lobby if matches criteria', async () => {
      // Setup
      const availableLobbies = [
        {
          id: lobbyId,
          status: 'waiting',
          player_count: 1,
          max_players: 4
        }
      ];
      
      const updatedLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 2,
        max_players: 4,
        players: [
          { id: 'player-456', session_id: 'session-456' },
          { id: 'player-123', session_id: playerId }
        ]
      };
      
      // Configure mock responses
      mockLobbyManager.getLobbiesByStatus.mockResolvedValueOnce(availableLobbies);
      mockLobbyManager.joinLobby.mockResolvedValueOnce(updatedLobby);
      
      // Execute
      const result = await matchmakingEngine.findMatch(playerId);
      
      // Verify
      expect(mockLobbyManager.getLobbiesByStatus).toHaveBeenCalledWith('waiting', expect.any(Object));
      expect(mockLobbyManager.joinLobby).toHaveBeenCalledWith(playerId, lobbyId);
      expect(result).toEqual({
        success: true,
        lobby_id: lobbyId,
        created_new: false
      });
    });
    
    it('should create a new lobby if no matches found', async () => {
      // Setup
      const newLobbyId = '223e4567-e89b-12d3-a456-426614174001';
      const newLobby = {
        id: newLobbyId,
        status: 'waiting',
        player_count: 1,
        max_players: 4,
        players: [{ id: 'player-123', session_id: playerId }]
      };
      
      // Configure mock responses
      mockLobbyManager.getLobbiesByStatus.mockResolvedValueOnce([]);
      mockLobbyManager.createLobby.mockResolvedValueOnce(newLobby);
      
      // Execute
      const result = await matchmakingEngine.findMatch(playerId, { maxPlayers: 4 });
      
      // Verify
      expect(mockLobbyManager.getLobbiesByStatus).toHaveBeenCalledWith('waiting', expect.any(Object));
      expect(mockLobbyManager.createLobby).toHaveBeenCalledWith(playerId, { maxPlayers: 4 });
      expect(result).toEqual({
        success: true,
        lobby_id: newLobbyId,
        created_new: true
      });
    });
    
    it('should filter lobbies based on criteria', async () => {
      // Setup
      const availableLobbies = [
        {
          id: 'lobby1',
          status: 'waiting',
          player_count: 1,
          max_players: 2,
          mode: 'casual'
        },
        {
          id: 'lobby2',
          status: 'waiting',
          player_count: 1,
          max_players: 4,
          mode: 'competitive'
        },
        {
          id: 'lobby3',
          status: 'active', // Not in waiting status
          player_count: 1,
          max_players: 4
        },
        {
          id: 'lobby4',
          status: 'waiting',
          player_count: 4, // Full
          max_players: 4
        }
      ];
      
      const updatedLobby = {
        id: 'lobby2',
        status: 'waiting',
        player_count: 2,
        max_players: 4,
        mode: 'competitive'
      };
      
      // Configure mock responses
      mockLobbyManager.getLobbiesByStatus.mockResolvedValueOnce(availableLobbies);
      mockLobbyManager.joinLobby.mockResolvedValueOnce(updatedLobby);
      
      // Execute
      const result = await matchmakingEngine.findMatch(playerId, { 
        maxPlayers: 4,
        mode: 'competitive'
      });
      
      // Verify
      expect(result).toEqual({
        success: true,
        lobby_id: 'lobby2',
        created_new: false
      });
      expect(mockLobbyManager.joinLobby).toHaveBeenCalledWith(playerId, 'lobby2');
    });
  });
  
  describe('queue management methods', () => {
    const queueId = 'test-queue-id';
    const queueType = 'casual';
    const playerId = 'test-player-id';
    
    beforeEach(() => {
      // Reset the mock for each test
      uuid.v4.mockReturnValue(queueId);
    });
    
    describe('createQueue', () => {
      it('should create a queue with default settings', () => {
        // Execute
        const result = matchmakingEngine.createQueue(queueType);
        
        // Verify
        expect(result).toBe(queueId);
        expect(matchmakingEngine.queueIntervals[queueId]).toBeDefined();
      });
      
      it('should throw ValidationError if queueType is missing', () => {
        expect(() => matchmakingEngine.createQueue()).toThrow(ValidationError);
      });
      
      it('should use provided queue options', () => {
        // Execute
        const result = matchmakingEngine.createQueue('ranked', { 
          maxPlayers: 2,
          processingInterval: 10
        });
        
        // Verify
        expect(result).toBe(queueId);
      });
    });
    
    describe('addToQueue', () => {
      beforeEach(() => {
        matchmakingEngine.createQueue('casual');
      });
      
      it('should add a player to the queue', () => {
        // Execute
        const result = matchmakingEngine.addToQueue(playerId1, queueId);
        
        // Verify
        expect(result).toBe(true);
      });
      
      it('should throw ValidationError if player is already in queue', () => {
        // Setup
        matchmakingEngine.addToQueue(playerId1, queueId);
        
        // Execute & Verify
        expect(() => matchmakingEngine.addToQueue(playerId1, queueId)).toThrow(ValidationError);
      });
      
      it('should throw ValidationError if queue does not exist', () => {
        expect(() => matchmakingEngine.addToQueue(playerId1, 'non-existent')).toThrow(ValidationError);
      });
      
      it('should store additional player data', () => {
        // Execute
        matchmakingEngine.addToQueue(playerId1, queueId, { skill: 2000 });
        
        // Verify custom skill is stored
        const queue = require('uuid').v4.mock.results[0].value;
        expect(queue).toBe(queueId);
      });
    });
    
    describe('removeFromQueue', () => {
      beforeEach(() => {
        matchmakingEngine.createQueue('casual');
        matchmakingEngine.addToQueue(playerId1, queueId);
      });
      
      it('should remove a player from all queues', () => {
        // Execute
        const result = matchmakingEngine.removeFromQueue(playerId1);
        
        // Verify
        expect(result).toContain(queueId);
      });
      
      it('should return empty array if player is not in any queue', () => {
        // Setup - First remove the player
        matchmakingEngine.removeFromQueue(playerId1);
        
        // Execute - Try to remove again
        const result = matchmakingEngine.removeFromQueue(playerId1);
        
        // Verify
        expect(result).toEqual([]);
      });
      
      it('should throw ValidationError if playerId is missing', () => {
        expect(() => matchmakingEngine.removeFromQueue()).toThrow(ValidationError);
      });
    });
    
    describe('processQueue', () => {
      beforeEach(() => {
        matchmakingEngine.createQueue('casual', { maxPlayers: 2 });
      });
      
      it('should return 0 matches if queue is empty', async () => {
        // Execute
        const result = await matchmakingEngine.processQueue(queueId);
        
        // Verify
        expect(result).toEqual({ matches: 0, remaining: 0 });
      });
      
      it('should create matches when enough players are in queue', async () => {
        // Setup - add players to queue
        matchmakingEngine.addToQueue(playerId1, queueId);
        matchmakingEngine.addToQueue(playerId2, queueId);
        
        // Configure mock responses for lobby creation
        const mockLobby = {
          id: 'new-lobby',
          status: 'waiting',
          player_count: 1,
          max_players: 2
        };
        
        mockLobbyManager.createLobby.mockResolvedValueOnce(mockLobby);
        mockLobbyManager.joinLobby.mockResolvedValueOnce({
          ...mockLobby,
          player_count: 2
        });
        
        // Execute
        const result = await matchmakingEngine.processQueue(queueId);
        
        // Verify
        expect(result).toEqual({ matches: 1, remaining: 0 });
        expect(mockLobbyManager.createLobby).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
        expect(mockLobbyManager.joinLobby).toHaveBeenCalledTimes(1);
      });
      
      it('should not create matches if not enough players', async () => {
        // Setup - add one player (need two for a match)
        matchmakingEngine.addToQueue(playerId1, queueId);
        
        // Execute
        const result = await matchmakingEngine.processQueue(queueId);
        
        // Verify
        expect(result).toEqual({ matches: 0, remaining: 1 });
        expect(mockLobbyManager.createLobby).not.toHaveBeenCalled();
      });
      
      it('should throw ValidationError if queueId is invalid', async () => {
        await expect(matchmakingEngine.processQueue('invalid')).rejects.toThrow(ValidationError);
      });
    });
  });
  
  describe('helper methods', () => {
    describe('_filterMatchingLobbies', () => {
      it('should filter lobbies based on criteria', () => {
        // Setup
        const lobbies = [
          {
            id: 'lobby1',
            status: 'waiting',
            player_count: 1,
            max_players: 2,
            mode: 'casual'
          },
          {
            id: 'lobby2',
            status: 'waiting',
            player_count: 1,
            max_players: 4,
            mode: 'competitive'
          },
          {
            id: 'lobby3',
            status: 'active',
            player_count: 1,
            max_players: 4,
            mode: 'casual'
          },
          {
            id: 'lobby4',
            status: 'waiting',
            player_count: 4,
            max_players: 4,
            mode: 'casual'
          }
        ];
        
        // Execute & Verify
        expect(matchmakingEngine._filterMatchingLobbies(lobbies, { maxPlayers: 2, mode: 'casual' })).toHaveLength(1);
        expect(matchmakingEngine._filterMatchingLobbies(lobbies, { maxPlayers: 4 })).toHaveLength(1);
        expect(matchmakingEngine._filterMatchingLobbies(lobbies, { mode: 'casual' })).toHaveLength(1);
        expect(matchmakingEngine._filterMatchingLobbies(lobbies)).toHaveLength(2);
      });
    });
    
    describe('_selectBestLobby', () => {
      it('should select lobby with most players', () => {
        // Setup
        const lobbies = [
          { id: 'lobby1', player_count: 1 },
          { id: 'lobby2', player_count: 3 },
          { id: 'lobby3', player_count: 2 }
        ];
        
        // Execute & Verify
        expect(matchmakingEngine._selectBestLobby(lobbies).id).toBe('lobby2');
      });
      
      it('should throw error if no lobbies are provided', () => {
        expect(() => matchmakingEngine._selectBestLobby([])).toThrow('No lobbies available');
      });
    });
  });
});
