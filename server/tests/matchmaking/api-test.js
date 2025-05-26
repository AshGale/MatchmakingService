// server/tests/matchmaking/api-test.js
import assert from 'assert';
import supertest from 'supertest';
import app from '../../src/app.js';

const request = supertest(app);

export default async function runMatchmakingApiTests() {
  console.log('\n\x1b[36mMatchmaking API Tests\x1b[0m');
  let testResults = { passed: 0, failed: 0, errors: [] };
  
  // Test: Get matchmaking stats
  try {
    const response = await request.get('/api/matchmaking/stats');
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert(response.body.stats);
    assert.strictEqual(typeof response.body.stats.playersInQueue, 'number');
    assert(typeof response.body.stats.eloDistribution === 'object');
    
    console.log('  \x1b[32m✓ should return matchmaking queue statistics\x1b[0m');
    testResults.passed++;
  } catch (error) {
    console.log('  \x1b[31m✗ should return matchmaking queue statistics\x1b[0m');
    console.log(`    ${error.message}`);
    testResults.failed++;
    testResults.errors.push(error);
  }
  
  // Print test summary
  console.log(`\n\x1b[36mAPI Test Results: ${testResults.passed} passed, ${testResults.failed} failed\x1b[0m`);
  return testResults;
}
