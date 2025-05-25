// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\esm-test-runner.js
// ES Module compatible test runner utility

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a test file with proper ES module support
 * @param {string} testPath - Path to the test file
 * @param {object} options - Test options
 * @returns {Promise<object>} - Test result
 */
export async function runEsmTest(testPath, options = {}) {
  return new Promise((resolve) => {
    if (!fs.existsSync(testPath)) {
      console.error(`Test file not found: ${testPath}`);
      return resolve({ success: false, error: 'File not found' });
    }
    
    // Set default options
    const opts = {
      timeout: options.timeout || 30000,
      env: options.env || {},
      cwd: options.cwd || process.cwd(),
      ...options
    };
    
    // Combine environment variables
    const env = {
      ...process.env,
      NODE_OPTIONS: '--experimental-vm-modules',
      NODE_ENV: 'test',
      ...opts.env
    };
    
    // Spawn the test process
    const testProcess = spawn('node', ['--experimental-vm-modules', testPath], {
      env,
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    // Collect output
    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());
    });
    
    testProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(text.trim());
    });
    
    // Handle completion
    testProcess.on('close', (code) => {
      const success = code === 0;
      
      resolve({
        success,
        code,
        output,
        error: errorOutput,
        file: testPath
      });
    });
    
    // Handle timeout
    if (opts.timeout) {
      setTimeout(() => {
        testProcess.kill();
        resolve({
          success: false,
          code: -1,
          output,
          error: 'Test timed out',
          file: testPath
        });
      }, opts.timeout);
    }
  });
}

/**
 * Run a series of tests in sequence
 * @param {array} testFiles - Array of test file paths
 * @param {object} options - Test options
 * @returns {Promise<array>} - Test results
 */
export async function runTests(testFiles, options = {}) {
  const results = [];
  
  for (const file of testFiles) {
    const testName = file.split('/').pop().replace('.js', '');
    console.log(`\n--- Running test: ${testName} ---`);
    
    const result = await runEsmTest(file, options);
    results.push({
      name: testName,
      ...result
    });
    
    console.log(`--- ${result.success ? 'PASSED' : 'FAILED'}: ${testName} ---`);
  }
  
  return results;
}

/**
 * Print test summary
 * @param {array} results - Test results
 */
export function printSummary(results) {
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`- ${r.name}: ${r.error || 'Unknown error'}`);
      });
  }
  
  return failed === 0;
}
