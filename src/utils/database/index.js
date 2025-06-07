/**
 * Database Utilities Module
 * 
 * Central export point for database-related utilities including
 * connection pooling, transaction management, and error handling.
 */

const { pool, getConnection, closePool } = require('./pool');
const { withTransaction } = require('./transaction');
const { DatabaseError, mapDatabaseError } = require('./errors');
const { checkDatabaseHealth } = require('./health');

module.exports = {
  // Connection Pool Management
  pool,
  getConnection,
  closePool,
  
  // Transaction Management
  withTransaction,
  
  // Error Handling
  DatabaseError,
  mapDatabaseError,
  
  // Health Checks
  checkDatabaseHealth
};
