// server/tests/caddy/setup-tests.js
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const logger = {
  info: (msg) => console.log(`${COLORS.blue}INFO:${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}SUCCESS:${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}ERROR:${COLORS.reset} ${msg}`),
  warning: (msg) => console.log(`${COLORS.yellow}WARNING:${COLORS.reset} ${msg}`)
};

// Install dependencies if needed
function setupDependencies() {
  const nodeModulesPath = resolve(__dirname, 'node_modules');
  
  if (!existsSync(nodeModulesPath)) {
    logger.info('Installing Caddy test dependencies...');
    try {
      execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
      logger.success('Dependencies installed successfully');
    } catch (error) {
      logger.error(`Failed to install dependencies: ${error.message}`);
      process.exit(1);
    }
  } else {
    logger.info('Dependencies already installed');
  }
}

// Run tests
function runTests() {
  logger.info('Running Caddy proxy tests...');
  try {
    execSync('node proxy-test.js', { cwd: __dirname, stdio: 'inherit' });
    logger.success('Caddy tests completed successfully');
  } catch (error) {
    logger.error(`Caddy tests failed: ${error.message}`);
    process.exit(1);
  }
}

// Main function
function main() {
  logger.info('Setting up Caddy proxy tests...');
  setupDependencies();
  runTests();
}

main();
