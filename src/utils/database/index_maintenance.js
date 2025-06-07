/**
 * Database Index Maintenance Utility
 * 
 * This module provides functions for maintaining database indexes,
 * including reindexing, analyzing, and monitoring index statistics.
 */

const { pool, withTransaction } = require('./index');
const fs = require('fs');
const path = require('path');

/**
 * Get index statistics from the database
 * 
 * @param {Object} client - Database client
 * @returns {Promise<Array>} Array of index statistics
 */
async function getIndexStatistics(client) {
  const query = `
    SELECT
      schemaname AS schema,
      relname AS table_name,
      indexrelname AS index_name,
      idx_scan AS scan_count,
      idx_tup_read AS tuples_read,
      idx_tup_fetch AS tuples_fetched,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      pg_relation_size(indexrelid) AS index_size_bytes
    FROM
      pg_stat_user_indexes
    ORDER BY
      schema,
      table_name,
      index_name;
  `;
  
  const result = await client.query(query);
  return result.rows;
}

/**
 * Get table statistics from the database
 * 
 * @param {Object} client - Database client
 * @returns {Promise<Array>} Array of table statistics
 */
async function getTableStatistics(client) {
  const query = `
    SELECT
      schemaname AS schema,
      relname AS table_name,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch,
      n_tup_ins AS tuples_inserted,
      n_tup_upd AS tuples_updated,
      n_tup_del AS tuples_deleted,
      pg_size_pretty(pg_relation_size(relid)) AS table_size
    FROM
      pg_stat_user_tables
    ORDER BY
      schema,
      table_name;
  `;
  
  const result = await client.query(query);
  return result.rows;
}

/**
 * Identify unused or rarely used indexes
 * 
 * @param {Array} indexStats - Index statistics from getIndexStatistics
 * @param {number} minScanThreshold - Minimum scan count to consider index as used
 * @returns {Array} Array of potentially unused indexes
 */
function identifyUnusedIndexes(indexStats, minScanThreshold = 10) {
  return indexStats.filter(index => {
    // Skip primary key indexes and unique constraints
    if (index.index_name.includes('_pkey') || index.index_name.includes('_unq_')) {
      return false;
    }
    
    // Identify indexes with scan count below threshold
    return index.scan_count < minScanThreshold;
  });
}

/**
 * Generate maintenance SQL for an index
 * 
 * @param {string} schema - Schema name
 * @param {string} indexName - Index name
 * @returns {string} SQL command for reindexing
 */
function generateReindexSQL(schema, indexName) {
  return `REINDEX INDEX ${schema}.${indexName};`;
}

/**
 * Analyze all tables to update statistics
 * 
 * @param {Object} client - Database client
 * @returns {Promise<void>}
 */
async function analyzeAllTables(client) {
  console.log('Analyzing all tables...');
  await client.query('ANALYZE;');
  console.log('Table analysis complete');
}

/**
 * Reindex a specific index
 * 
 * @param {Object} client - Database client
 * @param {string} schema - Schema name
 * @param {string} indexName - Index name
 * @returns {Promise<void>}
 */
async function reindexSpecific(client, schema, indexName) {
  console.log(`Reindexing ${schema}.${indexName}...`);
  await client.query(`REINDEX INDEX ${schema}.${indexName};`);
  console.log(`Reindexed ${schema}.${indexName}`);
}

/**
 * Perform full index maintenance
 * 
 * @param {Object} options - Maintenance options
 * @param {boolean} options.reindex - Whether to reindex all indexes
 * @param {boolean} options.analyze - Whether to analyze tables
 * @param {boolean} options.reportOnly - Only generate report without changes
 * @returns {Promise<Object>} Maintenance report
 */
async function performIndexMaintenance(options = {}) {
  const { reindex = false, analyze = true, reportOnly = false } = options;
  const report = {
    timestamp: new Date().toISOString(),
    tables: [],
    indexes: [],
    unusedIndexes: [],
    actions: []
  };
  
  await withTransaction(async (client) => {
    // Get current statistics
    report.indexes = await getIndexStatistics(client);
    report.tables = await getTableStatistics(client);
    report.unusedIndexes = identifyUnusedIndexes(report.indexes);
    
    // Only analyze tables if requested
    if (analyze && !reportOnly) {
      await analyzeAllTables(client);
      report.actions.push('Analyzed all tables');
    }
    
    // Only reindex if requested
    if (reindex && !reportOnly) {
      for (const index of report.indexes) {
        await reindexSpecific(client, index.schema, index.index_name);
        report.actions.push(`Reindexed ${index.schema}.${index.index_name}`);
      }
    }
  }, { readOnly: reportOnly });
  
  return report;
}

/**
 * Generate an index maintenance report and optionally save to file
 * 
 * @param {Object} maintenanceReport - Report from performIndexMaintenance
 * @param {string} outputPath - Optional file path to save report
 * @returns {void}
 */
function generateMaintenanceReport(maintenanceReport, outputPath) {
  const { indexes, unusedIndexes, actions, timestamp } = maintenanceReport;
  
  console.log('\n===== DATABASE INDEX MAINTENANCE REPORT =====');
  console.log(`Generated at: ${timestamp}\n`);
  
  // Summary
  console.log(`Total Indexes: ${indexes.length}`);
  console.log(`Potentially Unused Indexes: ${unusedIndexes.length}`);
  console.log(`Maintenance Actions: ${actions.length}`);
  
  // Unused indexes
  if (unusedIndexes.length > 0) {
    console.log('\n--- POTENTIALLY UNUSED INDEXES ---');
    for (const index of unusedIndexes) {
      console.log(`${index.schema}.${index.index_name} (Scans: ${index.scan_count}, Size: ${index.index_size})`);
    }
  }
  
  // Maintenance actions
  if (actions.length > 0) {
    console.log('\n--- MAINTENANCE ACTIONS PERFORMED ---');
    for (const action of actions) {
      console.log(`- ${action}`);
    }
  }
  
  console.log('\n===========================================');
  
  // Save report to file if path provided
  if (outputPath) {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(maintenanceReport, null, 2),
      'utf8'
    );
    console.log(`\nDetailed report saved to ${outputPath}`);
  }
}

/**
 * Generate SQL deployment scripts for indexes
 * 
 * @param {string} outputFile - Path to save the SQL deployment script
 */
function generateIndexDeploymentScript(outputFile) {
  const sql = `-- Database Indexes Deployment Script
-- Generated: ${new Date().toISOString()}

-- Lobbies Table
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies (status);

-- Players Table
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players (session_id);
CREATE INDEX IF NOT EXISTS idx_players_lobby_join ON players (lobby_id, join_order);

-- Games Table
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);

-- Verify indexes were created
SELECT
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS index_definition
FROM
    pg_indexes
WHERE
    schemaname = 'public' AND
    (indexname = 'idx_lobbies_status' OR
     indexname = 'idx_players_session_id' OR
     indexname = 'idx_players_lobby_join' OR
     indexname = 'idx_games_status');
`;

  // Write the SQL file
  fs.writeFileSync(outputFile, sql, 'utf8');
  console.log(`Index deployment script generated at ${outputFile}`);
}

/**
 * Generate SQL rollback script for indexes
 * 
 * @param {string} outputFile - Path to save the SQL rollback script
 */
function generateIndexRollbackScript(outputFile) {
  const sql = `-- Database Indexes Rollback Script
-- Generated: ${new Date().toISOString()}
-- WARNING: Use this script only if indexes are causing performance issues

-- Drop player-related indexes
DROP INDEX IF EXISTS idx_players_session_id;
DROP INDEX IF EXISTS idx_players_lobby_join;

-- Drop game-related index
DROP INDEX IF EXISTS idx_games_status;

-- Drop lobby-related index
DROP INDEX IF EXISTS idx_lobbies_status;
`;

  // Write the SQL file
  fs.writeFileSync(outputFile, sql, 'utf8');
  console.log(`Index rollback script generated at ${outputFile}`);
}

/**
 * Main function to run index maintenance
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const outputDir = path.join(__dirname, '..', '..', '..', 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate deployment scripts
    if (args.includes('--generate-scripts')) {
      const deployScript = path.join(outputDir, 'index_deployment.sql');
      const rollbackScript = path.join(outputDir, 'index_rollback.sql');
      
      generateIndexDeploymentScript(deployScript);
      generateIndexRollbackScript(rollbackScript);
      return;
    }
    
    // Otherwise perform maintenance
    const options = {
      reindex: args.includes('--reindex'),
      analyze: !args.includes('--no-analyze'),
      reportOnly: args.includes('--report-only')
    };
    
    console.log('Starting database index maintenance...');
    const report = await performIndexMaintenance(options);
    
    const outputPath = path.join(outputDir, `index_maintenance_${new Date().toISOString().replace(/:/g, '-')}.json`);
    generateMaintenanceReport(report, outputPath);
    
    console.log('Index maintenance completed successfully');
  } catch (error) {
    console.error('Error during index maintenance:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the maintenance if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  performIndexMaintenance,
  generateMaintenanceReport,
  getIndexStatistics,
  identifyUnusedIndexes,
  generateIndexDeploymentScript,
  generateIndexRollbackScript
};
