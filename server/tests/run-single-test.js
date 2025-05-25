// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\run-single-test.js
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testsRootDir = __dirname;
const projectRootDir = resolve(__dirname, '../..');

// Configure which test to run
const TEST_FILE = join(testsRootDir, 'sentry', 'test-sentry.js');
const TEST_NAME = 'Sentry Integration Test';

console.log('\n' + '='.repeat(50));
console.log(`Running single test: ${TEST_NAME}`);
console.log('='.repeat(50) + '\n');

// Check if Docker is running
console.log('Checking Docker status...');
const dockerCheck = spawnSync('docker', ['ps', '--filter', 'name=matchmaking', '--format', '{{.Names}}'], {
  encoding: 'utf-8'
});

const dockerRunning = dockerCheck.status === 0 && 
                     dockerCheck.stdout.trim().split('\n').filter(Boolean).length > 0;

console.log(`Docker containers running: ${dockerRunning ? 'YES' : 'NO'}`);

// Start Docker if needed
let dockerStarted = false;
if (!dockerRunning) {
  console.log('\nStarting Docker containers...');
  const dockerStart = spawnSync('docker-compose', ['up', '-d'], {
    cwd: projectRootDir,
    stdio: 'inherit'
  });
  
  dockerStarted = dockerStart.status === 0;
  
  if (dockerStarted) {
    console.log('Docker containers started successfully');
    console.log('\nWaiting 10 seconds for services to initialize...');
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`${i}... `);
      spawnSync('powershell', ['-Command', 'Start-Sleep -Seconds 1']);
    }
    console.log('\nContinuing with test...\n');
  } else {
    console.log('Failed to start Docker containers');
  }
}

// Run the test
console.log(`\nExecuting test: ${TEST_NAME}\n`);
const testProcess = spawnSync('node', [TEST_FILE], {
  stdio: 'inherit'
});

// Report result
console.log('\n' + '-'.repeat(50));
if (testProcess.status === 0) {
  console.log(`✅ Test passed: ${TEST_NAME}`);
} else {
  console.log(`❌ Test failed: ${TEST_NAME} with exit code ${testProcess.status}`);
}

// Stop Docker if we started it
if (dockerStarted) {
  console.log('\nStopping Docker containers...');
  spawnSync('docker-compose', ['down'], {
    cwd: projectRootDir,
    stdio: 'inherit'
  });
  console.log('Docker containers stopped');
}

console.log('-'.repeat(50));
console.log('Test run complete');
