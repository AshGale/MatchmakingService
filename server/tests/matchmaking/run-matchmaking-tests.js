// server/tests/matchmaking/run-matchmaking-tests.js
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan('=================================================='));
console.log(chalk.cyan('Running Matchmaking Tests'));
console.log(chalk.cyan('==================================================\n'));

// Define test files
const testFiles = [
  'matchmaking.test.js',
  // Comment out WebSocket tests for now as they require a running server
  // 'matchmaking-ws.test.js'
];

// Function to run tests
const runTest = (testFile) => {
  console.log(chalk.yellow(`Running test: ${testFile}`));
  
  const testPath = resolve(__dirname, testFile);
  const mochaPath = resolve(__dirname, '../../node_modules/.bin/mocha');
  
  const result = spawnSync('node', [mochaPath, testPath, '--timeout', '10000'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  
  if (result.status !== 0) {
    console.log(chalk.red(`❌ Test ${testFile} failed with status: ${result.status}`));
    return false;
  }
  
  console.log(chalk.green(`✅ Test ${testFile} passed\n`));
  return true;
};

// Run all tests
let allPassed = true;
for (const testFile of testFiles) {
  const passed = runTest(testFile);
  if (!passed) {
    allPassed = false;
  }
}

// Print summary
if (allPassed) {
  console.log(chalk.green('All matchmaking tests passed! 🎉'));
} else {
  console.log(chalk.red('Some tests failed. Please check the output above.'));
  process.exit(1);
}
