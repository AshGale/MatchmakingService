// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\security\security-integration-test.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Test username for security tests
const testUsername = `sectest_${Date.now()}`;
const testPassword = 'SecTest123!';

// Session storage
let accessToken = null;
let csrfToken = null;

// Helper to log test results
function logResult(testName, success, message, details = null) {
  console.log(`\n${testName}:`);
  if (success) {
    console.log(`✅ PASS - ${message}`);
  } else {
    console.log(`❌ FAIL - ${message}`);
  }
  if (details) {
    console.log('Details:', details);
  }
}

// Test rate limiting
async function testRateLimiting() {
  console.log('\n--- Testing Rate Limiting ---');
  
  try {
    // Make multiple quick requests to trigger rate limiting
    console.log('Attempting to trigger rate limiting...');
    const responses = [];
    
    // Make 10 quick requests to auth endpoint which has stricter limits
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `nonexistent_${i}`,
          password: 'wrongpassword'
        })
      });
      
      responses.push({
        status: response.status,
        headers: {
          rateLimit: response.headers.get('ratelimit-remaining'),
          rateLimitReset: response.headers.get('ratelimit-reset')
        }
      });
      
      // If we get a 429, rate limiting is working
      if (response.status === 429) {
        logResult('Rate Limiting', true, 'Rate limiting triggered correctly', 
          `Triggered after ${i + 1} requests`);
        return;
      }
    }
    
    // Check if rate limit headers are decreasing
    const firstLimit = parseInt(responses[0].headers.rateLimit);
    const lastLimit = parseInt(responses[responses.length - 1].headers.rateLimit);
    
    if (firstLimit > lastLimit) {
      logResult('Rate Limit Headers', true, 'Rate limit headers are working', 
        `Decreased from ${firstLimit} to ${lastLimit}`);
    } else {
      logResult('Rate Limit Headers', false, 'Rate limit headers not decreasing as expected');
    }
    
  } catch (error) {
    logResult('Rate Limiting', false, `Error during rate limiting test: ${error.message}`);
  }
}

// Test security headers
async function testSecurityHeaders() {
  console.log('\n--- Testing Security Headers ---');
  
  try {
    // Test security headers on any endpoint
    const response = await fetch(`${API_URL}/security-check`);
    
    // Check for security headers
    const headers = {
      contentSecurityPolicy: response.headers.get('content-security-policy'),
      xFrameOptions: response.headers.get('x-frame-options'),
      xContentTypeOptions: response.headers.get('x-content-type-options'),
      strictTransportSecurity: response.headers.get('strict-transport-security')
    };
    
    let allHeadersPresent = true;
    const missingHeaders = [];
    
    for (const [name, value] of Object.entries(headers)) {
      if (!value) {
        allHeadersPresent = false;
        missingHeaders.push(name);
      }
    }
    
    if (allHeadersPresent) {
      logResult('Security Headers', true, 'All security headers are present', headers);
    } else {
      logResult('Security Headers', false, 'Some security headers are missing', { 
        missingHeaders,
        presentHeaders: headers
      });
    }
  } catch (error) {
    logResult('Security Headers', false, `Error testing security headers: ${error.message}`);
  }
}

// Test input validation
async function testInputValidation() {
  console.log('\n--- Testing Input Validation ---');
  
  try {
    // Test with invalid registration data
    const invalidData = {
      username: 'a', // too short
      password: 'weak' // doesn't meet password requirements
    };
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });
    
    const data = await response.json();
    
    // We expect a 400 Bad Request with validation errors
    if (response.status === 400 && data.errors) {
      logResult('Input Validation', true, 'Validation correctly rejected invalid input', {
        status: response.status,
        errors: data.errors
      });
    } else {
      logResult('Input Validation', false, 'Invalid input was not properly rejected', {
        status: response.status,
        response: data
      });
    }
  } catch (error) {
    logResult('Input Validation', false, `Error testing input validation: ${error.message}`);
  }
}

// Test SQL injection prevention
async function testSqlInjectionPrevention() {
  console.log('\n--- Testing SQL Injection Prevention ---');
  
  try {
    // Attempt SQL injection in query parameter
    const injectionAttempts = [
      "' OR '1'='1",
      "; DROP TABLE users; --",
      "' UNION SELECT * FROM users --"
    ];
    
    let allPrevented = true;
    const results = [];
    
    for (const injection of injectionAttempts) {
      // Try to use injection in a query parameter
      const response = await fetch(`${API_URL}/users?search=${encodeURIComponent(injection)}`);
      
      results.push({
        injection,
        status: response.status,
      });
      
      // Expecting 403 Forbidden for detected injections
      if (response.status !== 403) {
        allPrevented = false;
      }
    }
    
    if (allPrevented) {
      logResult('SQL Injection Prevention', true, 'All SQL injection attempts were prevented', results);
    } else {
      logResult('SQL Injection Prevention', false, 'Some SQL injections were not prevented', results);
    }
  } catch (error) {
    logResult('SQL Injection Prevention', false, `Error testing SQL injection: ${error.message}`);
  }
}

// Test XSS protection through registration with malicious content
async function testXssProtection() {
  console.log('\n--- Testing XSS Protection ---');
  
  try {
    // Attempt to register with XSS in username
    const xssUsername = `<script>alert('XSS')</script>_${Date.now()}`;
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: xssUsername,
        password: 'SecurePass123!'
      })
    });
    
    const data = await response.json();
    
    // Either it should be rejected, or the script should be escaped
    if (response.status === 400) {
      logResult('XSS Protection', true, 'XSS attempt was rejected', {
        status: response.status,
        response: data
      });
    } else if (response.status === 201 && !data.user.username.includes('<script>')) {
      logResult('XSS Protection', true, 'XSS content was sanitized', {
        original: xssUsername,
        sanitized: data.user.username
      });
    } else {
      logResult('XSS Protection', false, 'XSS protection failed', {
        status: response.status,
        response: data
      });
    }
  } catch (error) {
    logResult('XSS Protection', false, `Error testing XSS protection: ${error.message}`);
  }
}

// Test registration and extract CSRF token
async function testRegistrationAndCsrf() {
  console.log('\n--- Testing Registration and CSRF Protection ---');
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    
    const data = await response.json();
    
    // Check for CSRF token in headers
    csrfToken = response.headers.get('x-csrf-token');
    
    if (response.ok) {
      accessToken = data.accessToken;
      logResult('Registration', true, 'Registration successful', {
        username: data.user.username,
        csrfToken: csrfToken ? 'Present' : 'Missing'
      });
    } else {
      logResult('Registration', false, 'Registration failed', {
        status: response.status,
        message: data.message
      });
    }
  } catch (error) {
    logResult('Registration', false, `Error during registration: ${error.message}`);
  }
}

// Test CSRF protection
async function testCsrfProtection() {
  if (!accessToken) {
    logResult('CSRF Protection', false, 'Skipped - Registration failed');
    return;
  }
  
  console.log('\n--- Testing CSRF Protection ---');
  
  try {
    // Try to update user profile without CSRF token (should be rejected)
    const withoutCsrfResponse = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ displayName: 'Updated Name' })
    });
    
    // Now try with CSRF token
    const withCsrfResponse = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-CSRF-Token': csrfToken || 'invalid-token'
      },
      body: JSON.stringify({ displayName: 'Updated With CSRF' })
    });
    
    if (withoutCsrfResponse.status === 403 && withCsrfResponse.status === 200) {
      logResult('CSRF Protection', true, 'CSRF protection working correctly', {
        withoutCsrf: withoutCsrfResponse.status,
        withCsrf: withCsrfResponse.status
      });
    } else {
      logResult('CSRF Protection', false, 'CSRF protection not working as expected', {
        withoutCsrf: withoutCsrfResponse.status,
        withCsrf: withCsrfResponse.status
      });
    }
  } catch (error) {
    logResult('CSRF Protection', false, `Error testing CSRF protection: ${error.message}`);
  }
}

// Run all tests sequentially
async function runSecurityTests() {
  console.log('======================================');
  console.log('SECURITY IMPLEMENTATION TEST SUITE');
  console.log('======================================\n');
  
  await testRateLimiting();
  await testSecurityHeaders();
  await testInputValidation();
  await testSqlInjectionPrevention();
  await testXssProtection();
  await testRegistrationAndCsrf();
  await testCsrfProtection();
  
  console.log('\n======================================');
  console.log('SECURITY TESTS COMPLETED');
  console.log('======================================');
}

// Start the tests
runSecurityTests();
