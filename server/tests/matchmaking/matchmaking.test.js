// server/tests/matchmaking/matchmaking.test.js
import assert from 'assert';
import sinon from 'sinon';
import MatchmakingService from '../../src/services/matchmakingService.js';

// Mock dependencies
class MockGameService {
  async createGame(gameData) {
    return { id: 'game-123', ...gameData };
  }
}

// Custom test runner
const tests = [];

function describe(name, fn) {
  console.log(`\n\x1b[36m${name}\x1b[0m`);
  fn();
}

function it(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  \x1b[32m✓ ${test.name}\x1b[0m`);
      passed++;
    } catch (error) {
      console.log(`  \x1b[31m✗ ${test.name}\x1b[0m`);
      console.log(`    ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n\x1b[36mResults: ${passed} passed, ${failed} failed\x1b[0m`);
  if (failed > 0) process.exit(1);
}

// Start tests
describe('MatchmakingService', () => {
  let matchmakingService;
  let mockGameService;
  let clock;

  beforeEach(() => {
    // Use fake timers
    clock = sinon.useFakeTimers();
    mockGameService = new MockGameService();
    sinon.spy(mockGameService, 'createGame');
    matchmakingService = new MatchmakingService(mockGameService);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('Player Queue Management', () => {
    it('should add a player to the queue', () => {
      const result = matchmakingService.addToQueue('user1', 1200);
      assert(result).to.equal(true);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(1);
      assert(matchmakingService.waitingPlayers[0].userId).to.equal('user1');
      assert(matchmakingService.waitingPlayers[0].eloRating).to.equal(1200);
    });

    it('should not add the same player twice', () => {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user1', 1200);
      assert(result).to.equal(false);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(1);
    });

    it('should remove a player from the queue', () => {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.removeFromQueue('user1');
      assert(result).to.equal(true);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(0);
    });

    it('should return false when removing a player not in the queue', () => {
      const result = matchmakingService.removeFromQueue('nonexistent');
      assert(result).to.equal(false);
    });
  });

  describe('Elo-Based Matching Logic', () => {
    it('should match players with similar Elo ratings', async () => {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1250);
      
      // Should return a match object since ratings are close
      assert(result).to.be.an('object');
      assert(result).to.have.property('gameId');
      assert(['user1', 'user2']).to.include(result.whitePlayerId);
      assert(['user1', 'user2']).to.include(result.blackPlayerId);
      assert(result.whitePlayerId).to.not.equal(result.blackPlayerId);
      
      // Queue should be empty after match
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(0);
    });

    it('should not match players with Elo differences outside the range', () => {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1500); // 300 difference > default 200 range
      
      // Should not match immediately
      assert(result).to.equal(true);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(2);
    });

    it('should process the queue and find matches', () => {
      // Add several players with various ratings
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1300);
      matchmakingService.addToQueue('user3', 1600);
      matchmakingService.addToQueue('user4', 1650);
      
      // Process queue
      const matches = matchmakingService.processQueue();
      
      // Should create 2 matches (user1-user2 and user3-user4)
      assert(matches).to.have.lengthOf(2);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(0);
    });
  });

  describe('Time-Based Range Expansion', () => {
    it('should expand the acceptable range over time', () => {
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1500); // Outside initial range
      
      // Fast forward 30 seconds
      clock.tick(30000);
      
      // Expand ranges
      matchmakingService.expandRanges();
      
      // Process queue after expansion
      const matches = matchmakingService.processQueue();
      
      // Range should be expanded and match should be found
      assert(matches).to.have.lengthOf(1);
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(0);
    });

    it('should have increasing range multipliers over time', () => {
      matchmakingService.addToQueue('user1', 1200);
      
      // Initial multiplier should be 1.0
      assert(matchmakingService.waitingPlayers[0].rangeMultiplier).to.equal(1.0);
      
      // Fast forward 2 minutes
      clock.tick(120000);
      
      // Expand ranges
      matchmakingService.expandRanges();
      
      // Multiplier should be increased
      // 1.0 + (120 / 60) * 0.2 = 1.4
      assert(matchmakingService.waitingPlayers[0].rangeMultiplier).to.be.closeTo(1.4, 0.01);
    });
  });

  describe('Match Creation and Player Notification', () => {
    it('should create a match with correct player assignments', async () => {
      // Add two players
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1250);
      
      // A match should have been created
      assert(mockGameService.createGame.calledOnce).to.be.true;
      
      const gameData = mockGameService.createGame.firstCall.args[0];
      assert(['user1', 'user2']).to.include(gameData.whitePlayerId);
      assert(['user1', 'user2']).to.include(gameData.blackPlayerId);
      assert(gameData.whitePlayerId).to.not.equal(gameData.blackPlayerId);
      assert(gameData.rated).to.be.true;
    });
    
    it('should handle errors in match creation', async () => {
      // Make createGame throw an error
      mockGameService.createGame = sinon.stub().throws(new Error('Game creation failed'));
      
      // Add two players
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1250);
      
      // Should return null on error
      assert(result).to.be.null;
      
      // Players should be added back to queue
      assert(matchmakingService.waitingPlayers).to.have.lengthOf(2);
    });
  });

  describe('Service Management', () => {
    it('should start and stop the matchmaking service', () => {
      // Start the service
      matchmakingService.start();
      assert(matchmakingService.matchmakingInterval).to.not.be.null;
      
      // Stop the service
      matchmakingService.stop();
      assert(matchmakingService.matchmakingInterval).to.be.null;
    });
    
    it('should provide queue statistics', () => {
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1800);
      
      const stats = matchmakingService.getQueueStats();
      assert(stats.playersInQueue).to.equal(2);
      assert(stats.averageWaitTime).to.equal(0); // 0 because we're using fake timers
      assert(stats.eloDistribution).to.be.an('object');
      assert(stats.eloDistribution['1200-1400']).to.equal(1);
      assert(stats.eloDistribution['1800-2000']).to.equal(1);
    });
  });
});
