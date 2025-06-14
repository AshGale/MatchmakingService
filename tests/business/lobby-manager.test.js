/**
 * LobbyManager Tests
 * 
 * This file contains unit tests for the LobbyManager business logic class.
 * Tests cover all public methods, validation, and error conditions.
 */

const LobbyManager = require('../../src/business/lobby-manager');
const { ValidationError } = require('../../src/middleware/error.middleware');

// Create mock database operations for testing
const mockDbOps = {
  createLobby: jest.fn(),
  addPlayerToLobby: jest.fn(),
  updateLobbyStatus: jest.fn(),
  getLobbyDetails: jest.fn(),
  getLobbiesByStatus: jest.fn()
};

describe('LobbyManager', () => {
  let lobbyManager;
  
  beforeEach(() => {
    // Create a new LobbyManager instance with mock DB operations
    lobbyManager = new LobbyManager({ dbOperations: mockDbOps });
    
    // Reset all mocks before each test
    jest.resetAllMocks();
  });
  
  describe('createLobby', () => {
    it('should create a lobby with valid settings', async () => {
      // Setup
      const playerId = 'session-123';
      const settings = { maxPlayers: 4 };
      const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 1,
        max_players: 4,
        players: []
      };
      
      // Configure mock responses
      mockDbOps.createLobby.mockResolvedValueOnce(lobbyId);
      mockDbOps.addPlayerToLobby.mockResolvedValueOnce('player-123');
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute
      const result = await lobbyManager.createLobby(playerId, settings);
      
      // Verify
      expect(mockDbOps.createLobby).toHaveBeenCalledWith(4, {});
      expect(mockDbOps.addPlayerToLobby).toHaveBeenCalledWith(lobbyId, playerId, {});
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledWith(lobbyId, {});
      expect(result).toEqual(mockLobby);
    });
    
    it('should create a lobby without adding player if playerId is not provided', async () => {
      // Setup
      const settings = { maxPlayers: 3 };
      const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 0,
        max_players: 3,
        players: []
      };
      
      // Configure mock responses
      mockDbOps.createLobby.mockResolvedValueOnce(lobbyId);
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute
      const result = await lobbyManager.createLobby(null, settings);
      
      // Verify
      expect(mockDbOps.createLobby).toHaveBeenCalledWith(3, {});
      expect(mockDbOps.addPlayerToLobby).not.toHaveBeenCalled();
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledWith(lobbyId, {});
      expect(result).toEqual(mockLobby);
    });
    
    it('should throw ValidationError if maxPlayers is missing', async () => {
      // Setup
      const playerId = 'session-123';
      const settings = {}; // Missing maxPlayers
      
      // Execute & Verify
      await expect(lobbyManager.createLobby(playerId, settings))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('joinLobby', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const playerId = 'session-123';
    
    it('should add a player to a valid lobby', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 1,
        max_players: 4,
        players: [
          { id: 'player-456', session_id: 'session-456' }
        ]
      };
      
      const mockUpdatedLobby = {
        ...mockLobby,
        player_count: 2,
        players: [
          ...mockLobby.players,
          { id: 'player-123', session_id: playerId }
        ]
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby)
                               .mockResolvedValueOnce(mockUpdatedLobby);
      mockDbOps.addPlayerToLobby.mockResolvedValueOnce('player-123');
      
      // Execute
      const result = await lobbyManager.joinLobby(playerId, lobbyId);
      
      // Verify
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledTimes(2);
      expect(mockDbOps.addPlayerToLobby).toHaveBeenCalledWith(lobbyId, playerId, {});
      expect(result).toEqual(mockUpdatedLobby);
    });
    
    it('should throw ValidationError if lobby is not in waiting state', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'active', // Not in waiting state
        player_count: 2,
        max_players: 4,
        players: []
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute & Verify
      await expect(lobbyManager.joinLobby(playerId, lobbyId))
        .rejects.toThrow(ValidationError);
      expect(mockDbOps.addPlayerToLobby).not.toHaveBeenCalled();
    });
    
    it('should throw ValidationError if lobby is at capacity', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 4,
        max_players: 4, // At capacity
        players: []
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute & Verify
      await expect(lobbyManager.joinLobby(playerId, lobbyId))
        .rejects.toThrow(ValidationError);
      expect(mockDbOps.addPlayerToLobby).not.toHaveBeenCalled();
    });
    
    it('should throw ValidationError if player is already in the lobby', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 2,
        max_players: 4,
        players: [
          { id: 'player-123', session_id: playerId } // Player already exists
        ]
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute & Verify
      await expect(lobbyManager.joinLobby(playerId, lobbyId))
        .rejects.toThrow(ValidationError);
      expect(mockDbOps.addPlayerToLobby).not.toHaveBeenCalled();
    });
    
    it('should throw ValidationError if playerId is missing', async () => {
      // Execute & Verify
      await expect(lobbyManager.joinLobby(null, lobbyId))
        .rejects.toThrow(ValidationError);
    });
    
    it('should throw ValidationError if lobbyId is missing', async () => {
      // Execute & Verify
      await expect(lobbyManager.joinLobby(playerId, null))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('getLobbyInfo', () => {
    it('should return lobby details for valid lobbyId', async () => {
      // Setup
      const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 2,
        max_players: 4,
        players: [
          { id: 'player-123', session_id: 'session-123' },
          { id: 'player-456', session_id: 'session-456' }
        ]
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute
      const result = await lobbyManager.getLobbyInfo(lobbyId);
      
      // Verify
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledWith(lobbyId, {});
      expect(result).toEqual(mockLobby);
    });
    
    it('should throw ValidationError if lobbyId is missing', async () => {
      // Execute & Verify
      await expect(lobbyManager.getLobbyInfo(null))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('getLobbiesByStatus', () => {
    it('should return lobbies with the specified status', async () => {
      // Setup
      const status = 'waiting';
      const mockLobbies = [
        { id: 'lobby-1', status: 'waiting', player_count: 1, max_players: 4 },
        { id: 'lobby-2', status: 'waiting', player_count: 2, max_players: 3 }
      ];
      
      // Configure mock responses
      mockDbOps.getLobbiesByStatus.mockResolvedValueOnce(mockLobbies);
      
      // Execute
      const result = await lobbyManager.getLobbiesByStatus(status);
      
      // Verify
      expect(mockDbOps.getLobbiesByStatus).toHaveBeenCalledWith(status, {});
      expect(result).toEqual(mockLobbies);
    });
    
    it('should pass pagination options to database operation', async () => {
      // Setup
      const status = 'waiting';
      const options = { limit: 10, offset: 5 };
      const mockLobbies = [
        { id: 'lobby-1', status: 'waiting', player_count: 1, max_players: 4 }
      ];
      
      // Configure mock responses
      mockDbOps.getLobbiesByStatus.mockResolvedValueOnce(mockLobbies);
      
      // Execute
      const result = await lobbyManager.getLobbiesByStatus(status, options);
      
      // Verify
      expect(mockDbOps.getLobbiesByStatus).toHaveBeenCalledWith(status, options);
      expect(result).toEqual(mockLobbies);
    });
  });
  
  describe('updateLobbyStatus', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    
    it('should update status for valid transitions', async () => {
      // Setup
      const currentStatus = 'waiting';
      const newStatus = 'active';
      
      const mockLobby = {
        id: lobbyId,
        status: currentStatus,
        player_count: 2,
        max_players: 4
      };
      
      const mockUpdatedLobby = {
        ...mockLobby,
        status: newStatus
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby)
                               .mockResolvedValueOnce(mockUpdatedLobby);
      mockDbOps.updateLobbyStatus.mockResolvedValueOnce(true);
      
      // Execute
      const result = await lobbyManager.updateLobbyStatus(lobbyId, newStatus);
      
      // Verify
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledTimes(2);
      expect(mockDbOps.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, newStatus, {});
      expect(result).toEqual(mockUpdatedLobby);
    });
    
    it('should allow updating to the same status', async () => {
      // Setup
      const status = 'waiting';
      
      const mockLobby = {
        id: lobbyId,
        status: status,
        player_count: 1,
        max_players: 4
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby)
                               .mockResolvedValueOnce(mockLobby);
      mockDbOps.updateLobbyStatus.mockResolvedValueOnce(true);
      
      // Execute
      const result = await lobbyManager.updateLobbyStatus(lobbyId, status);
      
      // Verify
      expect(mockDbOps.getLobbyDetails).toHaveBeenCalledTimes(2);
      expect(mockDbOps.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, status, {});
      expect(result).toEqual(mockLobby);
    });
    
    it('should throw ValidationError for invalid status transitions', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'active',
        player_count: 2,
        max_players: 4
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      
      // Execute & Verify - Cannot go from active to waiting
      await expect(lobbyManager.updateLobbyStatus(lobbyId, 'waiting'))
        .rejects.toThrow(ValidationError);
      expect(mockDbOps.updateLobbyStatus).not.toHaveBeenCalled();
    });
    
    it('should throw ValidationError if update fails', async () => {
      // Setup
      const mockLobby = {
        id: lobbyId,
        status: 'waiting',
        player_count: 2,
        max_players: 4
      };
      
      // Configure mock responses
      mockDbOps.getLobbyDetails.mockResolvedValueOnce(mockLobby);
      mockDbOps.updateLobbyStatus.mockResolvedValueOnce(false); // Update fails
      
      // Execute & Verify
      await expect(lobbyManager.updateLobbyStatus(lobbyId, 'active'))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('_isValidStatusTransition (private method)', () => {
    it('should return true for valid transitions', () => {
      expect(lobbyManager._isValidStatusTransition('waiting', 'active')).toBe(true);
      expect(lobbyManager._isValidStatusTransition('active', 'finished')).toBe(true);
    });
    
    it('should return true for same status (no change)', () => {
      expect(lobbyManager._isValidStatusTransition('waiting', 'waiting')).toBe(true);
      expect(lobbyManager._isValidStatusTransition('active', 'active')).toBe(true);
      expect(lobbyManager._isValidStatusTransition('finished', 'finished')).toBe(true);
    });
    
    it('should return false for invalid transitions', () => {
      expect(lobbyManager._isValidStatusTransition('waiting', 'finished')).toBe(false);
      expect(lobbyManager._isValidStatusTransition('active', 'waiting')).toBe(false);
      expect(lobbyManager._isValidStatusTransition('finished', 'waiting')).toBe(false);
      expect(lobbyManager._isValidStatusTransition('finished', 'active')).toBe(false);
    });
  });
  
  describe('leaveLobby', () => {
    it('should throw Error as the feature is not implemented yet', async () => {
      const playerId = 'session-123';
      const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
      
      await expect(lobbyManager.leaveLobby(playerId, lobbyId))
        .rejects.toThrow('Not implemented');
    });
  });
});
