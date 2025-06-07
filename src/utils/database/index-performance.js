/**
 * Database Index Performance Testing Utility
 * 
 * This module provides functions to test and report on database index performance
 * using EXPLAIN ANALYZE to verify index usage and query performance.
 */

const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('./index');

/**
 * Execute a query and return its execution plan
 * 
 * @param {Object} client - Database client
 * @param {string} query - SQL query to analyze
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Execution plan result
 */
async function explainAnalyze(client, query, params = []) {
  const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
  const result = await client.query(explainQuery, params);
  return result.rows[0]['QUERY PLAN'][0];
}

/**
 * Check if a specific index is used in the execution plan
 * 
 * @param {Object} plan - Execution plan from EXPLAIN ANALYZE
 * @param {string} indexName - Index name to check for
 * @returns {boolean} Whether index was used
 */
function isIndexUsed(plan, indexName) {
  // Check current node for index scan
  let indexUsed = false;
  
  // If this node has an Index Scan or Index Only Scan
  if (
    (plan['Node Type'] === 'Index Scan' || plan['Node Type'] === 'Index Only Scan' || plan['Node Type'] === 'Bitmap Index Scan') &&
    plan['Index Name'] === indexName
  ) {
    return true;
  }
  
  // Recurse into child plans
  if (plan.Plans) {
    for (const childPlan of plan.Plans) {
      if (isIndexUsed(childPlan, indexName)) {
        indexUsed = true;
        break;
      }
    }
  }
  
  return indexUsed;
}

/**
 * Run a test for a specific index
 * 
 * @param {Object} client - Database client
 * @param {Object} test - Test configuration
 * @param {string} test.name - Test name
 * @param {string} test.query - SQL query to test
 * @param {Array} test.params - Query parameters
 * @param {string} test.indexName - Expected index name
 * @returns {Promise<Object>} Test result
 */
async function runIndexTest(client, test) {
  const startTime = Date.now();
  
  try {
    // Get execution plan
    const plan = await explainAnalyze(client, test.query, test.params);
    
    // Check if index was used
    const indexUsed = isIndexUsed(plan, test.indexName);
    
    // Get actual execution time from plan
    const executionTime = plan['Execution Time'];
    
    // Get total rows
    const totalRows = plan['Plan Rows'];
    
    return {
      name: test.name,
      query: test.query,
      indexName: test.indexName,
      success: indexUsed,
      executionTime,
      totalRows,
      plan
    };
  } catch (error) {
    return {
      name: test.name,
      query: test.query,
      indexName: test.indexName,
      success: false,
      error: error.message
    };
  } finally {
    const elapsedTime = Date.now() - startTime;
    console.log(`Test "${test.name}" completed in ${elapsedTime}ms`);
  }
}

/**
 * Run a complete test suite for all indexes
 * 
 * @returns {Promise<Object>} Test results for all indexes
 */
async function testAllIndexes() {
  const results = {};
  
  await withTransaction(async (client) => {
    // Define the tests for each index
    const tests = [
      {
        name: "Lobbies Status Index",
        indexName: "idx_lobbies_status",
        query: "SELECT * FROM lobbies WHERE status = $1 ORDER BY created_at DESC LIMIT 100",
        params: ['waiting']
      },
      {
        name: "Players Session ID Index",
        indexName: "idx_players_session_id",
        query: "SELECT * FROM players WHERE session_id = $1 LIMIT 1",
        params: ['test-session-123']
      },
      {
        name: "Players Lobby Join Index",
        indexName: "idx_players_lobby_join",
        query: "SELECT * FROM players WHERE lobby_id = $1 ORDER BY join_order ASC",
        params: ['00000000-0000-0000-0000-000000000001']
      },
      {
        name: "Games Status Index",
        indexName: "idx_games_status",
        query: "SELECT * FROM games WHERE status = $1 LIMIT 100",
        params: ['active']
      }
    ];
    
    // Run each test
    for (const test of tests) {
      results[test.name] = await runIndexTest(client, test);
    }
    
    return results;
  }, { readOnly: true });
  
  return results;
}

/**
 * Format and print test results
 * 
 * @param {Object} results - Test results object
 * @param {string} outputPath - Optional path to save results as JSON
 */
function reportIndexTestResults(results, outputPath) {
  console.log('\n===== DATABASE INDEX PERFORMANCE TEST RESULTS =====\n');
  
  // Loop through each test result
  for (const [testName, result] of Object.entries(results)) {
    console.log(`\n--- ${testName} ---`);
    console.log(`Index: ${result.indexName}`);
    console.log(`Success: ${result.success ? 'YES' : 'NO'}`);
    
    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else {
      console.log(`Execution time: ${result.executionTime.toFixed(3)} ms`);
      console.log(`Rows returned: ${result.totalRows}`);
    }
  }
  
  console.log('\n=================================================\n');
  
  // Save results to file if path provided
  if (outputPath) {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log(`Results saved to ${outputPath}`);
  }
}

/**
 * Main function to run all index tests
 */
async function main() {
  try {
    console.log('Starting database index performance tests...');
    const results = await testAllIndexes();
    
    const outputPath = path.join(__dirname, '..', '..', '..', 'logs', 'index_test_results.json');
    reportIndexTestResults(results, outputPath);
    
    console.log('Tests completed successfully');
  } catch (error) {
    console.error('Error running index tests:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testAllIndexes,
  reportIndexTestResults,
  explainAnalyze,
  isIndexUsed
};
