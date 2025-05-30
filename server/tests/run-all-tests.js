// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\run-all-tests.js
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { promisify } from 'util';
import { runTests, printSummary } from './esm-test-runner.js';

// Add file system promises for async file operations
const fsPromises = fs.promises;

const sleep = promisify(setTimeout);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsRootDir = __dirname;
const projectRootDir = resolve(__dirname, '../..');
const logFilePath = join(testsRootDir, 'test-results.log');

// Configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const DOCKER_STARTUP_WAIT = 30000; // 30 seconds
const testGroups = [
  { name: 'Auth API Tests', path: join(testsRootDir, 'auth', 'api-test.js') },
  { name: 'Lobby API Tests', path: join(testsRootDir, 'lobby', 'test-lobby-api.js') },
  { name: 'WebSocket Tests', path: join(testsRootDir, 'websocket', 'websocket.test.js') },
  { name: 'Matchmaking Algorithm Tests', path: join(testsRootDir, 'matchmaking', 'matchmaking.test.js') },
  { name: 'Logging Service Tests', path: join(testsRootDir, 'logging', 'logging.test.js') },
  { name: 'Data Sanitizer Tests', path: join(testsRootDir, 'logging', 'data-sanitizer.test.js') },
  { name: 'Security Monitoring Tests', path: join(testsRootDir, 'logging', 'security-monitor.test.js') },
  { name: 'Monitoring Service Tests', path: join(testsRootDir, 'logging', 'monitoring.test.js') },
  { name: 'Caddy Proxy Tests', path: join(testsRootDir, 'caddy', 'proxy-test.js') }
  // WebSocket matchmaking tests require running server, exclude for automated tests
  // { name: 'Matchmaking WebSocket Tests', path: join(testsRootDir, 'matchmaking', 'matchmaking-ws.test.js') }
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

// Create logger with console output and file logging
const logger = {
  // Initialize log file with timestamp
  async initLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const header = `MatchmakingService Test Results - ${timestamp}\n${'='.repeat(60)}\n\n`;
    await fsPromises.writeFile(logFilePath, header);
    console.log(chalk.cyan(`Test results will be logged to: ${logFilePath}`));
    return logFilePath;
  },
  
  // Log to both console and file
  async log(msg, level = 'info') {
    const logMsg = `[${level.toUpperCase()}] ${msg}`;
    await fsPromises.appendFile(logFilePath, `${logMsg}\n`);
    return logMsg;
  },
  
  // Convenience methods for different log levels
  async info(msg) {
    console.log(chalk.blue(msg));
    await this.log(msg, 'info');
  },
  
  async success(msg) {
    console.log(chalk.green(msg));
    await this.log(msg, 'success');
  },
  
  async error(msg) {
    console.log(chalk.red(msg));
    await this.log(msg, 'error');
  },
  
  async warning(msg) {
    console.log(chalk.yellow(msg));
    await this.log(msg, 'warning');
  },
  
  async header(msg) {
    const formattedMsg = `\n${msg}\n${'-'.repeat(msg.length)}`;
    console.log(chalk.bold.cyan(formattedMsg));
    await fsPromises.appendFile(logFilePath, `\n${msg}\n${'-'.repeat(msg.length)}\n`);
  },
  
  // Log test output with detailed results
  async logTestOutput(testName, output) {
    const separator = '\n' + '='.repeat(80) + '\n';
    const formattedOutput = `${separator}TEST OUTPUT: ${testName}${separator}\n${output}\n`;
    await fsPromises.appendFile(logFilePath, formattedOutput);
  }
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
  
  // Initialize log file
  await logger.initLogFile();
  
  await logger.header('Starting MatchmakingService Test Suite');
  
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
    
  // Log detailed test outputs to the log file
  for (const result of testResults) {
    await logger.logTestOutput(
      result.name,
      `Status: ${result.success ? 'PASSED' : 'FAILED'}\n` +
      `Duration: ${result.duration}ms\n` +
      `Output:\n${result.output || 'No output'}\n` +
      (result.error ? `Error:\n${result.error}\n` : '')
    );
  }
  
  // Find and run any security tests separately
  await logger.header('Running Security Tests');
  
  try {
    // Find security test files
    const securityTestDir = join(testsRootDir, 'security');
    const securityTestFiles = fs.existsSync(securityTestDir) ? 
      fs.readdirSync(securityTestDir)
        .filter(file => file.endsWith('.test.js'))
        .map(file => join(securityTestDir, file)) : 
      [];
      
    if (securityTestFiles.length > 0) {
      await logger.info(`Found ${securityTestFiles.length} security test files`);
      
      // Run each security test
      for (const testFile of securityTestFiles) {
        const testName = testFile.split('/').pop();
        await logger.info(`Running security test: ${testName}`);
        
        const testResult = spawnSync('node', [testFile], {
          cwd: testsRootDir,
          encoding: 'utf-8',
          env: { ...process.env, NODE_ENV: 'test' }
        });
        
        // Log the complete test output to the log file
        await logger.logTestOutput(
          testName,
          `Exit code: ${testResult.status}\n` +
          `Output:\n${testResult.stdout || 'No output'}\n` +
          (testResult.stderr ? `Error:\n${testResult.stderr}\n` : '')
        );
        
        // Show a short summary in the console
        if (testResult.status === 0) {
          await logger.success(`✅ ${testName} passed`);
        } else {
          await logger.error(`❌ ${testName} failed - see log file for details`);
        }
      }
    } else {
      await logger.warning('No security tests found');
    }
  } catch (error) {
    await logger.error(`Error running security tests: ${error.message}`);
  }
  
  // Stop Docker containers if we started them
  if (dockerStarted) {
    await logger.info('Tests completed. Stopping Docker containers...');
    stopDockerContainers();
  }
  
  // Calculate duration
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;
  
  // Add Docker status to summary
  await logger.info(`Docker containers were ${dockerWasRunning ? 'already running' : dockerStarted ? 'started for testing' : 'not available'}`)
  
  // Print summary using our custom formatter
  await logger.header('Test Summary');
  await logger.info(`Total test suites: ${results.total}`);
  await logger.success(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    await logger.error(`Failed: ${results.failed}`);
    await logger.error('Failed tests:');
    for (const test of results.failedTests) {
      await logger.error(`  - ${test}`);
    }
  } else {
    await logger.success('All tests passed! 🎉');
  }
  
  if (results.skipped > 0) {
    await logger.warning(`Skipped: ${results.skipped}`);
  }
  
  // Add note about checking the log file for complete results
  await logger.info(`\nComplete test results have been written to: ${logFilePath}`);
  await logger.info('Check this file for any truncated output or detailed test information.');
  
  await logger.info(`Duration: ${duration.toFixed(2)} seconds`);
  
  console.log(chalk.cyan.bold(`\n📝 Complete test results saved to: ${logFilePath}`));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
