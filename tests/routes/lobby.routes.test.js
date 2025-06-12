const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const lobbyRoutes = require('../../src/routes/lobby.routes');
const { errorHandler } = require('../../src/middleware/error.middleware');

// Mock UUID generation for consistent test results
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

describe('Lobby Routes', () => {
  let app;
  const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/lobbies', lobbyRoutes);
    app.use(errorHandler);
    
    // Reset and set up mocks
    uuidv4.mockReset();
    uuidv4.mockReturnValue(mockUUID);
    
    // Reset Math.random mock
    jest.spyOn(global.Math, 'random').mockRestore();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/lobbies/:id/join', () => {
    const validLobbyId = '123e4567-e89b-12d3-a456-426614174000';
    const validSessionId = 'valid-session-123';
    
    test('should successfully join a lobby with valid data', async () => {
      // Mock Math.random to ensure lobby exists
      jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
      
      const response = await request(app)
        .post(`/api/lobbies/${validLobbyId}/join`)
        .send({ session_id: validSessionId })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('player_id', mockUUID);
      expect(response.body).toHaveProperty('lobby');
      expect(response.body.lobby).toHaveProperty('player_count', 3); // Increased by 1
    });
    
    test('should return 404 if lobby does not exist', async () => {
      // Mock Math.random to ensure lobby does not exist (< 0.3)
      jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
      
      const response = await request(app)
        .post(`/api/lobbies/${validLobbyId}/join`)
        .send({ session_id: validSessionId })
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
    
    test('should return 409 if player with session already exists in lobby', async () => {
      // Mock Math.random to ensure lobby exists
      jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
      
      const response = await request(app)
        .post(`/api/lobbies/${validLobbyId}/join`)
        .send({ session_id: 'existing-session' }) // This session already exists in our mock
        .expect(409);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
    
    test('should return 400 if session_id format is invalid', async () => {
      const response = await request(app)
        .post(`/api/lobbies/${validLobbyId}/join`)
        .send({ session_id: 'inv@lid' }) // Contains invalid character
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
    
    test('should return 400 if session_id is missing', async () => {
      const response = await request(app)
        .post(`/api/lobbies/${validLobbyId}/join`)
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });
});
