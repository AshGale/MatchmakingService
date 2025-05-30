// server/tests/caddy/proxy-test.js
import http from 'http';
import WebSocket from 'ws';
import { strictEqual, ok } from 'assert';

const BASE_URL = 'http://matchmaker.localhost';
const WS_URL = 'ws://matchmaker.localhost/socket.io/?EIO=4&transport=websocket';

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Helper function to log messages with colors
const logger = {
  info: (msg) => console.log(`${COLORS.blue}INFO:${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}SUCCESS:${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}ERROR:${COLORS.reset} ${msg}`),
  warning: (msg) => console.log(`${COLORS.yellow}WARNING:${COLORS.reset} ${msg}`)
};

// Add hosts entry if needed
function ensureHostsEntry() {
  logger.info('Checking hosts file configuration...');
  logger.warning('Please ensure matchmaker.localhost points to 127.0.0.1 in your hosts file');
  logger.warning('On Windows: C:\\Windows\\System32\\drivers\\etc\\hosts');
  logger.warning('On Unix/Mac: /etc/hosts');
  logger.warning('Add: "127.0.0.1 matchmaker.localhost" if not already present');
}

// Test HTTP proxy functionality
async function testHttpProxy() {
  logger.info('Testing HTTP proxy...');
  
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}/health`, { method: 'GET' }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          strictEqual(response.status, 'UP', 'Health check response should be UP');
          strictEqual(res.statusCode, 200, 'Status code should be 200');
          
          // Verify proxy headers are properly set
          ok(res.headers['strict-transport-security'], 'HSTS header should be set');
          ok(res.headers['x-content-type-options'], 'X-Content-Type-Options header should be set');
          ok(res.headers['x-xss-protection'], 'X-XSS-Protection header should be set');
          ok(res.headers['x-frame-options'], 'X-Frame-Options header should be set');
          ok(res.headers['content-security-policy'], 'CSP header should be set');
          ok(!res.headers['server'], 'Server header should be removed');
          
          logger.success('HTTP proxy test passed');
          resolve();
        } catch (err) {
          logger.error(`HTTP proxy test failed: ${err.message}`);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      logger.error(`HTTP request failed: ${err.message}`);
      reject(err);
    });
    
    req.end();
  });
}

// Test WebSocket proxy functionality
async function testWebSocketProxy() {
  logger.info('Testing WebSocket proxy...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      logger.success('WebSocket connection established through proxy');
      ws.close();
      resolve();
    });
    
    ws.on('error', (err) => {
      logger.error(`WebSocket connection failed: ${err.message}`);
      reject(err);
    });
    
    // Set a timeout in case the connection hangs
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
        reject(new Error('WebSocket connection timed out'));
      }
    }, 5000);
  });
}

// Run all tests
async function runTests() {
  try {
    let failures = 0;
    
    ensureHostsEntry();
    
    try {
      await testHttpProxy();
    } catch (err) {
      failures++;
    }
    
    try {
      await testWebSocketProxy();
    } catch (err) {
      failures++;
    }
    
    if (failures === 0) {
      logger.success('All Caddy reverse proxy tests passed!');
      process.exit(0);
    } else {
      logger.error(`${failures} test(s) failed!`);
      process.exit(1);
    }
  } catch (err) {
    logger.error(`Test execution failed: ${err.message}`);
    process.exit(1);
  }
}

runTests();
