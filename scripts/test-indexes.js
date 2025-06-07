/**
 * Database Index Performance Test Runner
 * 
 * This script executes the index performance tests and generates a report.
 * It can be used from the command line to test indexes in any environment.
 */

const path = require('path');
const { testAllIndexes, reportIndexTestResults } = require('../src/utils/database/index-performance');

// Parse command line arguments
const args = process.argv.slice(2);
const outputToFile = args.includes('--file') || args.includes('-f');
const verbose = args.includes('--verbose') || args.includes('-v');

async function runTests() {
  try {
    console.log('Starting database index performance tests...');
    const startTime = Date.now();
    
    // Run all index tests
    const results = await testAllIndexes();
    
    // Determine output path
    const outputPath = outputToFile 
      ? path.join(__dirname, '..', 'logs', `index_test_${new Date().toISOString().replace(/:/g, '-')}.json`)
      : null;
    
    // Generate report
    reportIndexTestResults(results, outputPath);
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`Tests completed in ${elapsedTime.toFixed(2)} seconds`);
    
    // Analyze the results
    const successfulTests = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\nSummary: ${successfulTests} of ${totalTests} indexes are being used effectively`);
    
    if (successfulTests < totalTests) {
      console.warn('\nWARNING: Some indexes are not being utilized effectively!');
      console.warn('Review the detailed report for more information.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running index tests:', error);
    process.exit(1);
  }
}

// Execute tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
