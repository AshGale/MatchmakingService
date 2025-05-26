// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\run-clean-tests.js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up test files to run - excluding Sentry as requested
const testFiles = [
  join(__dirname, 'auth', 'api-test.js'),
  join(__dirname, 'lobby', 'test-lobby-api.js')
];

/**
 * Run a single test file with clear output
 */
function runTest(testFile) {
  console.log(chalk.cyan(`\n=== Running test: ${testFile.split(/[\\/]/).pop()} ===\n`));
  
  const result = spawnSync('node', [testFile], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  const success = result.status === 0;
  console.log(chalk.cyan(`\n=== ${success ? chalk.green('PASSED') : chalk.red('FAILED')}: ${testFile.split(/[\\/]/).pop()} ===\n`));
  
  return {
    file: testFile,
    success,
    status: result.status
  };
}

/**
 * Verify Docker containers are running
 */
function checkDockerRunning() {
  console.log(chalk.blue('Checking Docker containers...'));
  
  try {
    const result = spawnSync('docker-compose', ['ps'], {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    if (result.status !== 0) {
      console.log(chalk.yellow('Docker check failed. Containers may not be running.'));
      return false;
    }
    
    const output = result.stdout;
    const containersRunning = output.includes('Up') && !output.includes('Exit');
    
    if (containersRunning) {
      console.log(chalk.green('Docker containers are running'));
    } else {
      console.log(chalk.yellow('Docker containers are not running'));
    }
    
    return containersRunning;
  } catch (error) {
    console.log(chalk.red(`Error checking Docker: ${error.message}`));
    return false;
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log(chalk.bold.blue('\n=== MatchmakingService Test Runner ===\n'));
  
  // Check Docker status
  const dockerRunning = checkDockerRunning();
  if (!dockerRunning) {
    console.log(chalk.yellow('\nPlease start Docker containers before running tests:'));
    console.log('cd ' + join(__dirname, '..', '..'));
    console.log('docker-compose up -d');
    console.log('\nWait for containers to initialize, then run this script again.\n');
    process.exit(1);
  }
  
  // Run tests
  console.log(chalk.blue('\nRunning tests...\n'));
  const results = [];
  
  for (const testFile of testFiles) {
    results.push(runTest(testFile));
  }
  
  // Show summary
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  
  console.log(chalk.bold.blue('\n=== Test Summary ===\n'));
  console.log(`Total tests: ${results.length}`);
  console.log(`${chalk.green('Passed')}: ${passed}`);
  console.log(`${chalk.red('Failed')}: ${failed}`);
  
  if (failed > 0) {
    console.log(chalk.red('\nFailed tests:'));
    results
      .filter(r => !r.success)
      .forEach(r => console.log(chalk.red(`- ${r.file.split(/[\\/]/).pop()}`)));
  }
  
  process.exit(failed ? 1 : 0);
}

// Run the tests
main().catch(error => {
  console.error(chalk.red(`Error running tests: ${error.message}`));
  process.exit(1);
});
