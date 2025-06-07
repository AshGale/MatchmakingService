/**
 * Database Operations Tests
 * 
 * This file contains comprehensive tests for the database operation
 * functions defined in the operations.js module.
 */

const {
  createLobby,
  addPlayerToLobby,
  updateLobbyStatus, 
  getLobbyDetails,
  getLobbiesByStatus,
  cleanupExpiredSessions
} = require('../../../src/utils/database/operations');

const { DatabaseError } = require('../../../src/utils/database/errors');

// Mock the transaction module
jest.mock('../../../src/utils/database/transaction', () => {
  return {
    withTransaction: jest.fn(async (callback, options = {}) => {
      // Simply execute the callback with a mock client
      const mockClient = {
        query: jest.fn()
      };
      return callback(mockClient);
    }),
    executeTransactionQueries: jest.fn()
  };
});

// Get the mocked withTransaction function for verification
const { withTransaction } = require('../../../src/utils/database/transaction');

describe('Database Operations', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('createLobby', () => {
    it('should create a lobby with valid max players', async () => {
      // Setup
      const mockLobbyId = '123e4567-e89b-12d3-a456-426614174000';
      const maxPlayers = 4;
      
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [{ lobby_id: mockLobbyId }]
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await createLobby(maxPlayers);
      
      // Verify
      expect(result).toBe(mockLobbyId);
      expect(withTransaction).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error for invalid max players (below range)', async () => {
      // Execute & Verify
      await expect(createLobby(1)).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error for invalid max players (above range)', async () => {
      // Execute & Verify
      await expect(createLobby(5)).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error for non-integer max players', async () => {
      // Execute & Verify
      await expect(createLobby(3.5)).rejects.toThrow(DatabaseError);
    });
    
    it('should handle database errors', async () => {
      // Setup
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        };
        return callback(mockClient);
      });
      
      // Execute & Verify
      await expect(createLobby(3)).rejects.toThrow(DatabaseError);
    });
  });
  
  describe('addPlayerToLobby', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const sessionId = 'session-123';
    const playerId = '223e4567-e89b-12d3-a456-426614174001';
    
    it('should add a player to a lobby with valid inputs', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [{ player_id: playerId }]
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await addPlayerToLobby(lobbyId, sessionId);
      
      // Verify
      expect(result).toBe(playerId);
      expect(withTransaction).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error for missing lobby ID', async () => {
      // Execute & Verify
      await expect(addPlayerToLobby(null, sessionId)).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error for missing session ID', async () => {
      // Execute & Verify
      await expect(addPlayerToLobby(lobbyId, '')).rejects.toThrow(DatabaseError);
    });
    
    it('should handle "Lobby not found" error', async () => {
      // Setup
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockRejectedValueOnce(new Error('Lobby not found'))
        };
        return callback(mockClient);
      });
      
      // Execute & Verify
      await expect(addPlayerToLobby(lobbyId, sessionId)).rejects.toThrow('Lobby not found');
    });
    
    it('should handle "Lobby is full" error', async () => {
      // Setup
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockRejectedValueOnce(new Error('Lobby is full'))
        };
        return callback(mockClient);
      });
      
      // Execute & Verify
      await expect(addPlayerToLobby(lobbyId, sessionId)).rejects.toThrow('Lobby is full');
    });
  });
  
  describe('updateLobbyStatus', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    
    it('should update lobby status with valid inputs', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [{ success: true }]
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await updateLobbyStatus(lobbyId, 'active');
      
      // Verify
      expect(result).toBe(true);
      expect(withTransaction).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error for missing lobby ID', async () => {
      // Execute & Verify
      await expect(updateLobbyStatus(null, 'active')).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error for invalid status', async () => {
      // Execute & Verify
      await expect(updateLobbyStatus(lobbyId, 'invalid')).rejects.toThrow(DatabaseError);
    });
    
    it('should handle failure and return false', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [{ success: false }]
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await updateLobbyStatus(lobbyId, 'active');
      
      // Verify
      expect(result).toBe(false);
    });
  });
  
  describe('getLobbyDetails', () => {
    const lobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const mockLobby = {
      id: lobbyId,
      player_count: 2,
      max_players: 4,
      status: 'waiting',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const mockPlayers = [
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        session_id: 'session-1',
        join_order: 1,
        joined_at: new Date().toISOString()
      },
      {
        id: '323e4567-e89b-12d3-a456-426614174002',
        session_id: 'session-2',
        join_order: 2,
        joined_at: new Date().toISOString()
      }
    ];
    
    it('should get lobby details with valid lobby ID', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockLobby] })
            .mockResolvedValueOnce({ rows: mockPlayers })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await getLobbyDetails(lobbyId);
      
      // Verify
      expect(result).toEqual({
        ...mockLobby,
        players: mockPlayers
      });
      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(withTransaction.mock.calls[0][1]).toHaveProperty('readOnly', true);
    });
    
    it('should throw an error for missing lobby ID', async () => {
      // Execute & Verify
      await expect(getLobbyDetails(null)).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error when lobby not found', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: [] })
        };
        return callback(mockClient);
      });
      
      // Execute & Verify
      await expect(getLobbyDetails(lobbyId)).rejects.toThrow('Lobby not found');
    });
  });
  
  describe('getLobbiesByStatus', () => {
    const mockLobbies = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        player_count: 2,
        max_players: 4,
        status: 'waiting'
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        player_count: 1,
        max_players: 2,
        status: 'waiting'
      }
    ];
    
    it('should get lobbies by valid status', async () => {
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: mockLobbies })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await getLobbiesByStatus('waiting');
      
      // Verify
      expect(result).toEqual(mockLobbies);
      expect(withTransaction).toHaveBeenCalledTimes(1);
      expect(withTransaction.mock.calls[0][1]).toHaveProperty('readOnly', true);
    });
    
    it('should throw an error for invalid status', async () => {
      // Execute & Verify
      await expect(getLobbiesByStatus('invalid')).rejects.toThrow(DatabaseError);
    });
    
    it('should use limit and offset parameters', async () => {
      // Configure mock response with parameter checking
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn((...args) => {
            // Verify that limit and offset are being passed to the query
            expect(args[1][1]).toBe(10); // limit
            expect(args[1][2]).toBe(5);  // offset
            return Promise.resolve({ rows: mockLobbies });
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      await getLobbiesByStatus('waiting', { limit: 10, offset: 5 });
    });
  });
  
  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions with valid timeout', async () => {
      const cleanupCount = 5;
      
      // Configure mock response
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [{ count: cleanupCount }]
          })
        };
        return callback(mockClient);
      });
      
      // Execute
      const result = await cleanupExpiredSessions(30);
      
      // Verify
      expect(result).toBe(cleanupCount);
      expect(withTransaction).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error for non-positive timeout', async () => {
      // Execute & Verify
      await expect(cleanupExpiredSessions(0)).rejects.toThrow(DatabaseError);
    });
    
    it('should throw an error for non-integer timeout', async () => {
      // Execute & Verify
      await expect(cleanupExpiredSessions(10.5)).rejects.toThrow(DatabaseError);
    });
  });
});
