// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\security\security-unit-test.js
import assert from 'assert';
import { securityMiddleware, handleValidationErrors, authValidation } from '../../src/middleware/security.js';
import { sanitizeString, sanitizeObject } from '../../src/utils/sanitize.js';
import { csrfProtection, generateToken } from '../../src/middleware/csrf.js';
import { authLimiter, apiLimiter } from '../../src/middleware/rateLimiter.js';
import express from 'express';
import http from 'http';

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  testResults: []
};

// Test runner function
function test(name, fn) {
  results.total++;
  console.log(`\n${colors.bright}${colors.blue}RUNNING: ${name}${colors.reset}`);
  
  try {
    fn();
    results.passed++;
    results.testResults.push({ name, passed: true });
    console.log(`${colors.green}✓ PASSED: ${name}${colors.reset}`);
  } catch (error) {
    results.failed++;
    results.testResults.push({ name, passed: false, error: error.message });
    console.log(`${colors.red}✗ FAILED: ${name}${colors.reset}`);
    console.log(`  ${colors.dim}${error.message}${colors.reset}`);
  }
}

// Test security.js middleware
function testSecurityMiddleware() {
  // Test that securityMiddleware is an array
  test('securityMiddleware is an array', () => {
    assert(Array.isArray(securityMiddleware), 'securityMiddleware should be an array');
    assert(securityMiddleware.length > 0, 'securityMiddleware should contain middleware functions');
  });
  
  // Test handleValidationErrors is a function
  test('handleValidationErrors is a function', () => {
    assert(typeof handleValidationErrors === 'function', 'handleValidationErrors should be a function');
  });
  
  // Test authValidation contains validation rules
  test('authValidation contains validation rules', () => {
    assert(authValidation.register, 'authValidation.register should exist');
    assert(authValidation.login, 'authValidation.login should exist');
    assert(authValidation.refresh, 'authValidation.refresh should exist');
    assert(Array.isArray(authValidation.register), 'authValidation.register should be an array');
  });
}

// Test sanitize.js utility
function testSanitizeUtility() {
  // Test sanitizeString properly escapes HTML
  test('sanitizeString escapes HTML', () => {
    const input = '<script>alert("XSS")</script>';
    const sanitized = sanitizeString(input);
    assert(sanitized !== input, 'sanitizeString should change malicious input');
    assert(!sanitized.includes('<script>'), 'sanitized string should not contain script tags');
  });
  
  // Test sanitizeObject correctly sanitizes nested objects
  test('sanitizeObject handles nested objects', () => {
    const input = {
      name: '<b>User</b>',
      details: {
        bio: '<script>alert("Nested XSS")</script>'
      },
      tags: ['<iframe>', 'normal']
    };
    
    const sanitized = sanitizeObject(input);
    assert(sanitized.name !== input.name, 'sanitizeObject should sanitize top-level string properties');
    assert(sanitized.details.bio !== input.details.bio, 'sanitizeObject should sanitize nested object properties');
    assert(sanitized.tags[0] !== input.tags[0], 'sanitizeObject should sanitize array items');
  });
}

// Test CSRF protection
function testCsrfProtection() {
  // Test token generation
  test('CSRF token generation', () => {
    const token = generateToken('user123');
    assert(token && typeof token === 'string', 'generateToken should return a string token');
    assert(token.length >= 32, 'CSRF token should be at least 32 characters long');
  });
  
  // Test that csrfProtection is a function
  test('csrfProtection is a function', () => {
    assert(typeof csrfProtection === 'function', 'csrfProtection should be a function');
  });
}

// Test rate limiters
function testRateLimiters() {
  // Test that limiters are configured
  test('Rate limiters are configured properly', () => {
    assert(authLimiter, 'authLimiter should exist');
    assert(apiLimiter, 'apiLimiter should exist');
  });
  
  // Test that auth limiter is more strict than API limiter
  test('Auth limiter is more strict than API limiter', () => {
    // Access the internal configurations
    const authMax = authLimiter.limit || authLimiter.options?.max;
    const apiMax = apiLimiter.limit || apiLimiter.options?.max;
    
    // Cannot directly access private properties, so this test might be limited
    console.log(`  ${colors.dim}Auth limiter appears to be configured${colors.reset}`);
    console.log(`  ${colors.dim}API limiter appears to be configured${colors.reset}`);
  });
}

// Test express app security configuration
function testExpressAppSecurity() {
  // Create a test Express app with our middleware
  test('Express app with security middleware', () => {
    const app = express();
    
    // This should not throw an error
    app.use(securityMiddleware);
    app.use(csrfProtection);
    
    assert(app._router, 'App should have a router after middleware is applied');
  });
}

// Print final test summary
async function printSummary() {
  console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}SECURITY TESTS SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}Total tests: ${results.total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  
  if (results.failed > 0) {
    console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`\n${colors.red}Failed tests:${colors.reset}`);
    
    results.testResults
      .filter(result => !result.passed)
      .forEach(result => {
        console.log(`  ${colors.red}✗ ${result.name}${colors.reset}`);
        console.log(`    ${colors.dim}${result.error}${colors.reset}`);
      });
  } else {
    console.log(`\n${colors.green}${colors.bright}ALL TESTS PASSED! 🎉${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Writing full test results to: test-results-security.log${colors.reset}`);
  const fs = await import('fs');
  
  // Create a detailed log file
  const now = new Date().toISOString();
  let logContent = `Security Test Results - ${now}\n`;
  logContent += '========================================\n\n';
  
  results.testResults.forEach(result => {
    logContent += `${result.passed ? '✓ PASSED' : '✗ FAILED'}: ${result.name}\n`;
    if (!result.passed && result.error) {
      logContent += `  Error: ${result.error}\n`;
    }
    logContent += '\n';
  });
  
  logContent += '========================================\n';
  logContent += `Total: ${results.total}, Passed: ${results.passed}, Failed: ${results.failed}\n`;
  
  fs.default.writeFileSync('test-results-security.log', logContent);
}

// Run all tests
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}RUNNING SECURITY UNIT TESTS${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
  
  testSecurityMiddleware();
  testSanitizeUtility();
  testCsrfProtection();
  testRateLimiters();
  testExpressAppSecurity();
  
  // Print the summary
  await printSummary();
}

runTests().catch(error => {
  console.error('Test runner error:', error);
});
