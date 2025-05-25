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
const dockerCheck = spawnSync('docker-compose', ['ps', '--services', '--filter', 'status=running'], {
  encoding: 'utf-8',
  cwd: projectRootDir
});

const dockerRunning = dockerCheck.status === 0 && 
                     dockerCheck.stdout.trim().split('\n').filter(Boolean).length > 0;

console.log(`Docker containers running: ${dockerRunning ? 'YES' : 'NO'}`);

// Start Docker if needed
let dockerStarted = false;
if (!dockerRunning) {
  console.log('\nStarting Docker containers...');
  
  // First ensure containers are stopped to avoid conflicts
  console.log('Ensuring no conflicting containers are running...');
  spawnSync('docker-compose', ['down'], {
    cwd: projectRootDir,
    stdio: 'inherit'
  });
  
  // Start containers in detached mode
  console.log('Starting fresh containers...');
  const dockerStart = spawnSync('docker-compose', ['up', '-d'], {
    cwd: projectRootDir,
    stdio: 'inherit'
  });
  
  dockerStarted = dockerStart.status === 0;
  
  if (dockerStarted) {
    console.log('Docker containers started successfully');
    console.log('\nWaiting for services to initialize...');
    
    // Show countdown for better visibility
    const waitTimeSeconds = 30;
    for (let i = waitTimeSeconds; i > 0; i -= 5) {
      if (i < waitTimeSeconds) {
        console.log(`${i} seconds remaining...`);
      }
      spawnSync('powershell', ['-Command', `Start-Sleep -Seconds ${Math.min(i, 5)}`]);
    }
    
    console.log('\nVerifying container health...');
    const healthCheck = spawnSync('docker-compose', ['ps'], {
      cwd: projectRootDir,
      encoding: 'utf-8'
    });
    
    if (healthCheck.status === 0 && healthCheck.stdout.includes('(healthy)')) {
      console.log('Services are healthy and ready');
    } else {
      console.log('Services may not be fully healthy, but continuing with tests');
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
