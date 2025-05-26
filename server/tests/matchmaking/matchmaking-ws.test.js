// server/tests/matchmaking/matchmaking-ws.test.js
import { expect } from 'chai';
import sinon from 'sinon';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import http from 'http';
import { configureWebSockets } from '../../src/websockets.js';
import app from '../../src/app.js';
import MatchmakingService from '../../src/services/matchmakingService.js';
import UserService from '../../src/services/userService.js';

describe('Matchmaking WebSocket Integration Tests', () => {
  let server;
  let clientSocket1;
  let clientSocket2;
  let wsServer;
  let userServiceStub;
  let originalProcessQueue;
  let matchmakingHandlerInstance;
  
  const PORT = 5001;
  const BASE_URL = `http://localhost:${PORT}`;
  
  // Create test tokens
  const createToken = (userId, username) => {
    return jwt.sign(
      { userId, username }, 
      process.env.JWT_SECRET || 'test-secret', 
      { expiresIn: '1h' }
    );
  };
  
  const user1Token = createToken('user1', 'Player1');
  const user2Token = createToken('user2', 'Player2');
  
  const connectClient = (token) => {
    return new Promise((resolve) => {
      const socket = Client(BASE_URL, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true
      });
      
      socket.on('connect', () => {
        resolve(socket);
      });
    });
  };
  
  before(async () => {
    // Create HTTP server
    server = http.createServer(app);
    
    // Configure WebSockets
    wsServer = configureWebSockets(server);
    
    // Start server
    server.listen(PORT);
    
    // Get matchmaking handler instance
    matchmakingHandlerInstance = configureWebSockets.matchmakingHandler;
    
    // Store original processQueue method
    originalProcessQueue = matchmakingHandlerInstance.matchmakingService.processQueue;
    
    // Create UserService stub
    userServiceStub = sinon.stub(UserService.prototype);
    userServiceStub.getUserById.callsFake(async (userId) => {
      if (userId === 'user1') {
        return { id: 'user1', username: 'Player1', eloRating: 1200 };
      } else if (userId === 'user2') {
        return { id: 'user2', username: 'Player2', eloRating: 1250 };
      }
      return null;
    });
  });
  
  after(() => {
    // Close server and all connections
    server.close();
    clientSocket1?.disconnect();
    clientSocket2?.disconnect();
    sinon.restore();
  });
  
  beforeEach(async () => {
    // Connect clients
    clientSocket1 = await connectClient(user1Token);
    clientSocket2 = await connectClient(user2Token);
    
    // Reset the stub method if necessary
    matchmakingHandlerInstance.matchmakingService.processQueue = originalProcessQueue;
  });
  
  afterEach(() => {
    // Disconnect clients
    clientSocket1?.disconnect();
    clientSocket2?.disconnect();
    
    // Reset matchmaking service state
    matchmakingHandlerInstance.matchmakingService.waitingPlayers = [];
  });
  
  it('should allow a player to join the matchmaking queue', (done) => {
    clientSocket1.emit('join_matchmaking_queue', {}, (response) => {
      expect(response.success).to.be.true;
      expect(response.inQueue).to.be.true;
      
      // Check if player is in queue
      const queue = matchmakingHandlerInstance.matchmakingService.waitingPlayers;
      expect(queue.length).to.equal(1);
      expect(queue[0].userId).to.equal('user1');
      expect(queue[0].eloRating).to.equal(1200);
      
      done();
    });
  });
  
  it('should allow a player to leave the matchmaking queue', (done) => {
    // First join the queue
    clientSocket1.emit('join_matchmaking_queue', {}, () => {
      // Then leave it
      clientSocket1.emit('leave_matchmaking_queue', {}, (response) => {
        expect(response.success).to.be.true;
        expect(response.removed).to.be.true;
        
        // Check queue is empty
        const queue = matchmakingHandlerInstance.matchmakingService.waitingPlayers;
        expect(queue.length).to.equal(0);
        
        done();
      });
    });
  });
  
  it('should match players with similar Elo ratings', (done) => {
    // Mock the processQueue method to simulate instant match
    matchmakingHandlerInstance.matchmakingService.processQueue = () => {
      const match = {
        gameId: 'game-123',
        whitePlayerId: 'user1',
        blackPlayerId: 'user2',
        whiteElo: 1200,
        blackElo: 1250,
        matchedAt: Date.now()
      };
      
      // Process the match through the handler
      matchmakingHandlerInstance.notifyMatchCreated(match);
      
      return [match];
    };
    
    // Setup event listener for player 1
    clientSocket1.once('match_found', (matchData) => {
      expect(matchData.gameId).to.equal('game-123');
      expect(matchData.role).to.equal('white');
      expect(matchData.opponent.id).to.equal('user2');
      expect(matchData.yourElo).to.equal(1200);
      
      // Check for game_started event
      clientSocket1.once('game_started', (gameData) => {
        expect(gameData.gameId).to.equal('game-123');
        expect(gameData.whitePlayerId).to.equal('user1');
        expect(gameData.blackPlayerId).to.equal('user2');
        done();
      });
    });
    
    // Add both players to queue
    clientSocket1.emit('join_matchmaking_queue', {}, () => {
      clientSocket2.emit('join_matchmaking_queue', {}, () => {
        // The mock processQueue will be called automatically by the interval
        // but we can trigger it manually for testing
        matchmakingHandlerInstance.matchmakingService.processQueue();
      });
    });
  });
  
  it('should broadcast queue stats updates', (done) => {
    // Setup listener for queue updates
    clientSocket1.once('matchmaking_queue_update', (stats) => {
      expect(stats).to.be.an('object');
      expect(stats.playersInQueue).to.equal(1);
      expect(stats.eloDistribution).to.be.an('object');
      expect(stats.eloDistribution['1200-1400']).to.equal(1);
      done();
    });
    
    // Join the queue to trigger an update
    clientSocket1.emit('join_matchmaking_queue', {}, () => {
      // The broadcast will be triggered by the join operation
    });
  });
  
  it('should provide queue statistics on request', (done) => {
    // Add a player to queue
    clientSocket1.emit('join_matchmaking_queue', {}, () => {
      // Request stats
      clientSocket2.emit('get_matchmaking_stats', {}, (response) => {
        expect(response.success).to.be.true;
        expect(response.stats).to.be.an('object');
        expect(response.stats.playersInQueue).to.equal(1);
        expect(response.stats.eloDistribution['1200-1400']).to.equal(1);
        done();
      });
    });
  });
  
  it('should remove player from queue on disconnect', (done) => {
    // Add a player to queue
    clientSocket1.emit('join_matchmaking_queue', {}, () => {
      // Check player is in queue
      expect(matchmakingHandlerInstance.matchmakingService.waitingPlayers.length).to.equal(1);
      
      // Disconnect
      clientSocket1.disconnect();
      
      // Give some time for the disconnect event to be processed
      setTimeout(() => {
        // Check player was removed from queue
        expect(matchmakingHandlerInstance.matchmakingService.waitingPlayers.length).to.equal(0);
        done();
      }, 100);
    });
  });
});
