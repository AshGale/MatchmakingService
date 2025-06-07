/**
 * Database Transaction Management
 * 
 * Implements transaction handling with automatic rollback on errors
 * and support for nested transactions through savepoints.
 */

const { getConnection } = require('./pool');
const { DatabaseError } = require('./errors');

/**
 * Transaction wrapper function that handles commits and rollbacks automatically
 * 
 * @param {Function} callback - Function to execute within the transaction
 * @param {Object} options - Transaction options
 * @param {Object} options.client - Optional existing database client (for nested transactions)
 * @param {boolean} options.readOnly - Whether transaction is read-only (default: false)
 * @returns {Promise<*>} - Result of the callback function
 */
async function withTransaction(callback, options = {}) {
  const { client: existingClient, readOnly = false } = options;
  
  // Track if this is an outer transaction (we manage the client)
  const isOuterTransaction = !existingClient;
  
  // Get or use existing client
  const client = existingClient || await getConnection();
  
  // Check if we're in a transaction already (for nested transaction support)
  let isNested = false;
  
  try {
    if (isOuterTransaction) {
      // Start a new transaction
      const isolationLevel = readOnly ? 'SERIALIZABLE' : 'READ COMMITTED';
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB] Transaction started with isolation level: ${isolationLevel}`);
      }
    } else {
      // We're in a nested transaction, use a savepoint
      isNested = true;
      const savepointName = `sp_${Date.now()}`;
      await client.query(`SAVEPOINT ${savepointName}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB] Created savepoint: ${savepointName}`);
      }
      
      // Make savepoint name available to the callback
      client.currentSavepoint = savepointName;
    }
    
    // Execute the callback with the client
    const result = await callback(client);
    
    // Commit if this is the outer transaction
    if (isOuterTransaction) {
      await client.query('COMMIT');
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB] Transaction committed successfully');
      }
    } else if (isNested) {
      // Release the savepoint for nested transaction
      await client.query(`RELEASE SAVEPOINT ${client.currentSavepoint}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB] Released savepoint: ${client.currentSavepoint}`);
      }
    }
    
    return result;
  } catch (error) {
    // Rollback the transaction or savepoint
    try {
      if (isOuterTransaction) {
        await client.query('ROLLBACK');
        if (process.env.NODE_ENV === 'development') {
          console.error('[DB] Transaction rolled back due to error:', error.message);
        }
      } else if (isNested && client.currentSavepoint) {
        await client.query(`ROLLBACK TO SAVEPOINT ${client.currentSavepoint}`);
        if (process.env.NODE_ENV === 'development') {
          console.error(`[DB] Rolled back to savepoint ${client.currentSavepoint} due to error:`, error.message);
        }
      }
    } catch (rollbackError) {
      console.error('[DB] Error during transaction rollback:', rollbackError);
      // We still want to throw the original error
    }
    
    // Enhance the error with transaction context if needed
    if (!(error instanceof DatabaseError)) {
      error = new DatabaseError(
        'Transaction failed',
        { cause: error, originalError: error }
      );
    }
    
    throw error;
  } finally {
    // Clean up only if we created the client
    if (isOuterTransaction && client) {
      client.release();
      if (process.env.NODE_ENV === 'development') {
        console.log('[DB] Client released to pool');
      }
    }
  }
}

/**
 * Execute a series of queries in a transaction
 * 
 * @param {Array<Object|Function>} queries - Array of query objects or functions returning query objects
 * @param {Object} options - Transaction options
 * @returns {Promise<Array>} - Results of all queries
 */
async function executeTransactionQueries(queries, options = {}) {
  return withTransaction(async (client) => {
    const results = [];
    
    for (const query of queries) {
      // If query is a function, execute it with the client and previous results
      const queryObj = typeof query === 'function' 
        ? query(client, results) 
        : query;
        
      // Skip null/undefined queries (allows conditional query execution)
      if (!queryObj) continue;
      
      // Execute the query
      const result = await client.query(queryObj);
      results.push(result);
    }
    
    return results;
  }, options);
}

module.exports = {
  withTransaction,
  executeTransactionQueries
};
