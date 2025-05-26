// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\run-all-tests.js
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { promisify } from 'util';
import { runTests, printSummary } from './esm-test-runner.js';

const sleep = promisify(setTimeout);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsRootDir = __dirname;
const projectRootDir = resolve(__dirname, '../..');

// Configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const DOCKER_STARTUP_WAIT = 30000; // 30 seconds
const testGroups = [
  { name: 'Auth API Tests', path: join(testsRootDir, 'auth', 'api-test.js') },
  { name: 'Lobby API Tests', path: join(testsRootDir, 'lobby', 'test-lobby-api.js') }
  // Sentry tests excluded as requested
  // { name: 'Auth Tests', path: join(testsRootDir, 'auth', 'auth.test.js') }
];

// Results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  failedTests: []
};

// Create a simple console logger with colors
const logger = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  header: (msg) => console.log(chalk.bold.cyan(`\n${msg}\n${'-'.repeat(msg.length)}`))
};

// Get test file paths from test groups
function getTestFiles() {
  return testGroups.map(group => group.path);
}

// Check if Docker containers are running
function checkDockerRunning() {
  try {
    logger.info('Checking if Docker containers are running...');
    
    // Check for running containers matching our service
    // Using docker-compose ps instead of docker ps for more reliable container detection
    const result = spawnSync('docker-compose', ['ps', '--services', '--filter', 'status=running'], {
      encoding: 'utf-8',
      cwd: projectRootDir
    });
    
    if (result.status !== 0) {
      logger.error(`Failed to check Docker status: ${result.stderr || 'Unknown error'}`);
      return false;
    }
    
    const runningContainers = result.stdout.trim().split('\n').filter(Boolean);
    const isRunning = runningContainers.length > 0;
    
    if (isRunning) {
      logger.success(`Found ${runningContainers.length} running containers: ${runningContainers.join(', ')}`);
    } else {
      logger.warning('No running containers found');
    }
    
    return isRunning;
  } catch (error) {
    logger.error(`Error checking Docker status: ${error.message}`);
    return false;
  }
}

// Start Docker containers
function startDockerContainers() {
  try {
    logger.info('Starting Docker containers...');
    
    // First ensure containers are stopped to avoid conflicts
    logger.info('Ensuring no conflicting containers are running...');
    spawnSync('docker-compose', ['down'], {
      cwd: projectRootDir,
      stdio: 'inherit'
    });
    
    // Start containers in detached mode
    logger.info('Starting fresh containers...');
    const result = spawnSync('docker-compose', ['up', '-d'], {
      cwd: projectRootDir,
      stdio: 'inherit'
    });
    
    if (result.status !== 0) {
      logger.error(`Failed to start Docker containers: ${result.stderr || 'Unknown error'}`);
      return false;
    }
    
    // Verify containers started correctly
    const verifyResult = spawnSync('docker-compose', ['ps'], {
      cwd: projectRootDir,
      encoding: 'utf-8'
    });
    
    if (verifyResult.status !== 0 || !verifyResult.stdout.includes('Up')) {
      logger.error('Containers did not start properly');
      return false;
    }
    
    logger.success('Docker containers started successfully');
    return true;
  } catch (error) {
    logger.error(`Error starting Docker containers: ${error.message}`);
    return false;
  }
}

// Stop Docker containers
function stopDockerContainers() {
  try {
    logger.info('Stopping Docker containers...');
    
    const result = spawnSync('docker-compose', ['down'], {
      cwd: projectRootDir,
      stdio: 'inherit'
    });
    
    if (result.status !== 0) {
      logger.error('Failed to stop Docker containers');
      return false;
    }
    
    logger.success('Docker containers stopped successfully');
    return true;
  } catch (error) {
    logger.error(`Error stopping Docker containers: ${error.message}`);
    return false;
  }
}

// Wait for services to be ready
async function waitForServices() {
  const waitTimeSeconds = DOCKER_STARTUP_WAIT/1000;
  logger.info(`Waiting ${waitTimeSeconds} seconds for services to be ready...`);
  
  // Show countdown to make the wait more informative
  for (let i = waitTimeSeconds; i > 0; i -= 5) {
    if (i < waitTimeSeconds) {
      logger.info(`${i} seconds remaining...`);
    }
    await sleep(Math.min(i, 5) * 1000);
  }
  
  // Verify services are actually ready by checking health status
  const healthCheck = spawnSync('docker-compose', ['ps'], {
    cwd: projectRootDir,
    encoding: 'utf-8'
  });
  
  if (healthCheck.status === 0 && healthCheck.stdout.includes('(healthy)')) {
    logger.success('Services are healthy and ready');
  } else {
    logger.warning('Services may not be fully healthy, but continuing with tests');
  }
}

// Main function to run all tests
async function runAllTests() {
  const startTime = new Date();
  logger.header('Starting MatchmakingService Test Suite');
  
  // Check if Docker is running and handle accordingly
  const dockerWasRunning = checkDockerRunning();
  let dockerStarted = false;
  
  if (!dockerWasRunning) {
    logger.warning('Docker containers are not running');
    dockerStarted = startDockerContainers();
    
    if (dockerStarted) {
      logger.info('Waiting for services to initialize...');
      await waitForServices();
    } else {
      logger.error('Failed to start Docker containers. Tests may fail.');
    }
  } else {
    logger.success('Docker containers are already running');
  }
  
  // Get all test files from test groups
  const testFiles = getTestFiles();
  results.total = testFiles.length;
  
  // Run tests using our ES module compatible test runner
  logger.info('Running tests with ES module support...');
  const testResults = await runTests(testFiles, {
    timeout: TEST_TIMEOUT,
    env: { NODE_ENV: 'test' }
  });
  
  // Process results
  results.passed = testResults.filter(r => r.success).length;
  results.failed = testResults.filter(r => !r.success).length;
  results.failedTests = testResults
    .filter(r => !r.success)
    .map(r => r.name);
  
  // Stop Docker containers if we started them
  if (dockerStarted) {
    logger.info('Tests completed. Stopping Docker containers...');
    stopDockerContainers();
  }
  
  // Calculate duration
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;
  
  // Add Docker status to summary
  logger.info(`Docker containers were ${dockerWasRunning ? 'already running' : dockerStarted ? 'started for testing' : 'not available'}`)
  
  // Print summary using our custom formatter
  logger.header('Test Summary');
  logger.info(`Total test suites: ${results.total}`);
  logger.success(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    logger.error(`Failed: ${results.failed}`);
    logger.error('Failed tests:');
    results.failedTests.forEach(test => logger.error(`  - ${test}`));
  } else {
    logger.success('All tests passed! 🎉');
  }
  
  if (results.skipped > 0) {
    logger.warning(`Skipped: ${results.skipped}`);
  }
  
  logger.info(`Duration: ${duration.toFixed(2)} seconds`);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
