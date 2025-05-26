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

export default async function runMatchmakingTests() {
  console.log('\n\x1b[36mMatchmakingService Tests\x1b[0m');
  let matchmakingService;
  let mockGameService;
  let clock;
  let testResults = { passed: 0, failed: 0, errors: [] };

  try {
    // Setup
    clock = sinon.useFakeTimers();
    mockGameService = new MockGameService();
    sinon.spy(mockGameService, 'createGame');
    matchmakingService = new MatchmakingService(mockGameService);

    // Test: Player Queue Management
    console.log('\n\x1b[36mPlayer Queue Management\x1b[0m');
    
    // Test: should add a player to the queue
    try {
      const result = matchmakingService.addToQueue('user1', 1200);
      assert.strictEqual(result, true);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 1);
      assert.strictEqual(matchmakingService.waitingPlayers[0].userId, 'user1');
      assert.strictEqual(matchmakingService.waitingPlayers[0].eloRating, 1200);
      console.log('  \x1b[32m✓ should add a player to the queue\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should add a player to the queue\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should not add the same player twice
    try {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user1', 1200);
      assert.strictEqual(result, false);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 1);
      console.log('  \x1b[32m✓ should not add the same player twice\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should not add the same player twice\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should remove a player from the queue
    try {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.removeFromQueue('user1');
      assert.strictEqual(result, true);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 0);
      console.log('  \x1b[32m✓ should remove a player from the queue\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should remove a player from the queue\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Test: should return false when removing a player not in the queue
    try {
      const result = matchmakingService.removeFromQueue('nonexistent');
      assert.strictEqual(result, false);
      console.log('  \x1b[32m✓ should return false when removing a player not in the queue\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should return false when removing a player not in the queue\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Test: Elo-Based Matching Logic
    console.log('\n\x1b[36mElo-Based Matching Logic\x1b[0m');
    
    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should match players with similar Elo ratings
    try {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1250);
      
      // Should return a match object since ratings are close
      assert(typeof result === 'object' && result !== null);
      assert(result.hasOwnProperty('gameId'));
      assert(['user1', 'user2'].includes(result.whitePlayerId));
      assert(['user1', 'user2'].includes(result.blackPlayerId));
      assert.notStrictEqual(result.whitePlayerId, result.blackPlayerId);
      
      // Queue should be empty after match
      assert.strictEqual(matchmakingService.waitingPlayers.length, 0);
      console.log('  \x1b[32m✓ should match players with similar Elo ratings\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should match players with similar Elo ratings\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should not match players with Elo differences outside the range
    try {
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1500); // 300 difference > default 200 range
      
      // Should not match immediately
      assert.strictEqual(result, true);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 2);
      console.log('  \x1b[32m✓ should not match players with Elo differences outside the range\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should not match players with Elo differences outside the range\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should process the queue and find matches
    try {
      // Add several players with various ratings
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1300);
      matchmakingService.addToQueue('user3', 1600);
      matchmakingService.addToQueue('user4', 1650);
      
      // Process queue
      const matches = matchmakingService.processQueue();
      
      // Should create 2 matches (user1-user2 and user3-user4)
      assert.strictEqual(matches.length, 2);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 0);
      console.log('  \x1b[32m✓ should process the queue and find matches\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should process the queue and find matches\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Test: Time-Based Range Expansion
    console.log('\n\x1b[36mTime-Based Range Expansion\x1b[0m');
    
    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should expand the acceptable range over time
    try {
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1500); // Outside initial range
      
      // Fast forward 30 seconds
      clock.tick(30000);
      
      // Expand ranges
      matchmakingService.expandRanges();
      
      // Process queue after expansion
      const matches = matchmakingService.processQueue();
      
      // Range should be expanded and match should be found
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matchmakingService.waitingPlayers.length, 0);
      console.log('  \x1b[32m✓ should expand the acceptable range over time\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should expand the acceptable range over time\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should have increasing range multipliers over time
    try {
      matchmakingService.addToQueue('user1', 1200);
      
      // Initial multiplier should be 1.0
      assert.strictEqual(matchmakingService.waitingPlayers[0].rangeMultiplier, 1.0);
      
      // Fast forward 2 minutes
      clock.tick(120000);
      
      // Expand ranges
      matchmakingService.expandRanges();
      
      // Multiplier should be increased
      // 1.0 + (120 / 60) * 0.2 = 1.4
      assert(Math.abs(matchmakingService.waitingPlayers[0].rangeMultiplier - 1.4) < 0.01);
      console.log('  \x1b[32m✓ should have increasing range multipliers over time\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should have increasing range multipliers over time\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Test: Match Creation and Player Notification
    console.log('\n\x1b[36mMatch Creation and Player Notification\x1b[0m');
    
    // Reset for next test
    mockGameService = new MockGameService();
    sinon.spy(mockGameService, 'createGame');
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should create a match with correct player assignments
    try {
      // Reset for this test
      sinon.restore();
      mockGameService = new MockGameService();
      sinon.spy(mockGameService, 'createGame');
      matchmakingService = new MatchmakingService(mockGameService);
      
      // Add two players
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1250);
      
      // A match should have been created
      assert(mockGameService.createGame.calledOnce);
      
      const gameData = mockGameService.createGame.firstCall.args[0];
      assert(['user1', 'user2'].includes(gameData.whitePlayerId));
      assert(['user1', 'user2'].includes(gameData.blackPlayerId));
      assert.notStrictEqual(gameData.whitePlayerId, gameData.blackPlayerId);
      assert.strictEqual(gameData.rated, true);
      console.log('  \x1b[32m✓ should create a match with correct player assignments\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should create a match with correct player assignments\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    mockGameService = new MockGameService();
    mockGameService.createGame = sinon.stub().throws(new Error('Game creation failed'));
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should handle errors in match creation
    try {
      // Create a new mock service with failing createGame method
      mockGameService = new MockGameService();
      mockGameService.createGame = () => { throw new Error('Game creation failed'); };
      matchmakingService = new MatchmakingService(mockGameService);
      
      // Add players - since createGame throws synchronously, this should fail
      matchmakingService.addToQueue('user1', 1200);
      const result = matchmakingService.addToQueue('user2', 1250);
      
      // Should not match (return true for added to queue or false for already in queue)
      assert(result === true || result === false);
      
      // Players should still be in queue
      assert(matchmakingService.waitingPlayers.length > 0);
      console.log('  \x1b[32m✓ should handle errors in match creation\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should handle errors in match creation\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Test: Service Management
    console.log('\n\x1b[36mService Management\x1b[0m');
    
    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should start and stop the matchmaking service
    try {
      // Start the service
      matchmakingService.start();
      assert(matchmakingService.matchmakingInterval !== null);
      
      // Stop the service
      matchmakingService.stop();
      assert.strictEqual(matchmakingService.matchmakingInterval, null);
      console.log('  \x1b[32m✓ should start and stop the matchmaking service\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should start and stop the matchmaking service\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }

    // Reset for next test
    matchmakingService = new MatchmakingService(mockGameService);
    
    // Test: should provide queue statistics
    try {
      matchmakingService.addToQueue('user1', 1200);
      matchmakingService.addToQueue('user2', 1800);
      
      const stats = matchmakingService.getQueueStats();
      assert.strictEqual(stats.playersInQueue, 2);
      assert.strictEqual(stats.averageWaitTime, 0); // 0 because we're using fake timers
      assert(typeof stats.eloDistribution === 'object' && stats.eloDistribution !== null);
      assert.strictEqual(stats.eloDistribution['1200-1400'], 1);
      assert.strictEqual(stats.eloDistribution['1800-2000'], 1);
      console.log('  \x1b[32m✓ should provide queue statistics\x1b[0m');
      testResults.passed++;
    } catch (error) {
      console.log('  \x1b[31m✗ should provide queue statistics\x1b[0m');
      console.log(`    ${error.message}`);
      testResults.failed++;
      testResults.errors.push(error);
    }
  } finally {
    // Cleanup
    clock?.restore();
    sinon.restore();
  }

  // Print test summary
  console.log(`\n\x1b[36mTest Results: ${testResults.passed} passed, ${testResults.failed} failed\x1b[0m`);
  return testResults;
}
