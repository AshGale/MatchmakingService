// server/tests/matchmaking/run-matchmaking-test.js
import runMatchmakingTests from './matchmaking.test.revised.js';

console.log('Running Matchmaking Tests...');

runMatchmakingTests()
  .then(results => {
    console.log(`Tests completed: ${results.passed} passed, ${results.failed} failed`);
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
