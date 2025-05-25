// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\run-all-tests.js
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsRootDir = __dirname;
const projectRootDir = resolve(__dirname, '../..');

// Configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const DOCKER_STARTUP_WAIT = 30000; // 30 seconds
const testGroups = [
  { name: 'Auth Tests', path: join(testsRootDir, 'auth', 'auth.test.js') },
  { name: 'Auth API Tests', path: join(testsRootDir, 'auth', 'api-test.js') },
  { name: 'Lobby API Tests', path: join(testsRootDir, 'lobby', 'test-lobby-api.js') },
  { name: 'Sentry Tests', path: join(testsRootDir, 'sentry', 'test-sentry.js') }
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

// Helper to run a test file
async function runTest(testName, testPath) {
  logger.header(`Running: ${testName}`);
  
  // Check if file exists
  if (!fs.existsSync(testPath)) {
    logger.error(`Test file not found: ${testPath}`);
    results.skipped++;
    return false;
  }
  
  try {
    // Run the test with Node.js
    const process = spawnSync('node', [testPath], {
      stdio: 'inherit',
      timeout: TEST_TIMEOUT,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    if (process.status === 0) {
      logger.success(`✅ ${testName} completed successfully`);
      results.passed++;
      return true;
    } else {
      logger.error(`❌ ${testName} failed with exit code ${process.status}`);
      results.failed++;
      results.failedTests.push(testName);
      return false;
    }
  } catch (error) {
    logger.error(`❌ ${testName} error: ${error.message}`);
    results.failed++;
    results.failedTests.push(testName);
    return false;
  }
}

// Check if Docker containers are running
function checkDockerRunning() {
  try {
    logger.info('Checking if Docker containers are running...');
    
    // Check for running containers matching our service
    const result = spawnSync('docker', ['ps', '--filter', 'name=matchmaking', '--format', '{{.Names}}'], {
      encoding: 'utf-8'
    });
    
    if (result.status !== 0) {
      logger.error(`Failed to check Docker status: ${result.stderr}`);
      return false;
    }
    
    const runningContainers = result.stdout.trim().split('\n').filter(Boolean);
    return runningContainers.length > 0;
  } catch (error) {
    logger.error(`Error checking Docker status: ${error.message}`);
    return false;
  }
}

// Start Docker containers
function startDockerContainers() {
  try {
    logger.info('Starting Docker containers...');
    
    // Change to project root where docker-compose.yml is located
    const result = spawnSync('docker-compose', ['up', '-d'], {
      cwd: projectRootDir,
      stdio: 'inherit'
    });
    
    if (result.status !== 0) {
      logger.error('Failed to start Docker containers');
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
  logger.info(`Waiting ${DOCKER_STARTUP_WAIT/1000} seconds for services to be ready...`);
  await sleep(DOCKER_STARTUP_WAIT);
  logger.success('Services should be ready now');
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
  
  results.total = testGroups.length;
  
  // Run each test sequentially
  for (const test of testGroups) {
    try {
      await runTest(test.name, test.path);
    } catch (error) {
      logger.error(`Error executing test ${test.name}: ${error.message}`);
      results.failed++;
      results.failedTests.push(test.name);
    }
  }
  
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
  
  // Print summary
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
