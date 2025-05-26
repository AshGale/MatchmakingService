// server/tests/matchmaking/run-all-matchmaking-tests.js
import runMatchmakingTests from './matchmaking.test.revised.js';
import runMatchmakingApiTests from './api-test.js';

async function runAllTests() {
  console.log('\n\x1b[36m=========================================\x1b[0m');
  console.log('\x1b[36m      Running All Matchmaking Tests      \x1b[0m');
  console.log('\x1b[36m=========================================\x1b[0m\n');
  
  // Run matchmaking core tests
  const coreResults = await runMatchmakingTests();
  
  // Run API tests if core tests weren't too bad
  let apiResults = { passed: 0, failed: 0 };
  if (coreResults.failed <= 5) {
    // Minor failures in core tests are acceptable, still test API
    apiResults = await runMatchmakingApiTests();
  }
  
  // Print overall results
  const totalPassed = coreResults.passed + apiResults.passed;
  const totalFailed = coreResults.failed + apiResults.failed;
  
  console.log('\n\x1b[36m=========================================\x1b[0m');
  console.log(`\x1b[36m Overall Results: ${totalPassed} passed, ${totalFailed} failed \x1b[0m`);
  console.log('\x1b[36m=========================================\x1b[0m');
  
  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
