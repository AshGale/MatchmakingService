/**
 * Database Connection Pool Management
 * 
 * Implements connection pooling for PostgreSQL database connections
 * with configurable parameters for pool size, connection timeouts,
 * and idle timeouts.
 */

const { Pool } = require('pg');

/**
 * Default pool configuration
 */
const DEFAULT_CONFIG = {
  // Connection pool size limits
  min: 5,                       // Minimum pool size
  max: 20,                      // Maximum pool size
  
  // Connection timeout settings
  connectionTimeoutMillis: 5000, // 5 seconds
  idleTimeoutMillis: 60000,      // 60 seconds
  
  // Connection validation
  allowExitOnIdle: false,
  
  // Default database connection string (should be overridden by env vars)
  connectionString: process.env.DATABASE_URL,
  
  // SSL configuration for production environments
  ssl: process.env.NODE_ENV === 'production' ? 
    { rejectUnauthorized: false } : 
    undefined
};

/**
 * Create and configure the connection pool
 * Custom configuration can be provided to override defaults
 */
const pool = new Pool({
  ...DEFAULT_CONFIG,
  
  // Override with environment variables if provided
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Log connection events in development
  log: process.env.NODE_ENV !== 'production' ? 
    (...messages) => console.log('[DB Pool]', ...messages) : 
    () => {}
});

/**
 * Setup event handlers for the pool
 */
pool.on('connect', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('New client connected to database');
  }
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Optionally implement client cleanup here
});

pool.on('remove', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Client removed from pool');
  }
});

/**
 * Get a connection from the pool
 * @returns {Promise<Object>} Database client
 */
async function getConnection() {
  try {
    const client = await pool.connect();
    const query = client.query;
    
    // Extend client with query timing
    client.query = (...args) => {
      const start = Date.now();
      const result = query.apply(client, args);
      
      // If the query is a promise, add timing information
      if (result && typeof result.then === 'function') {
        result.then(res => {
          const duration = Date.now() - start;
          if (process.env.NODE_ENV === 'development' && duration > 100) {
            console.log(`[DB] Slow query (${duration}ms):`, args[0]);
          }
          return res;
        });
      }
      
      return result;
    };
    
    // Add release wrapper to make client safe to use after release
    const originalRelease = client.release;
    client.release = () => {
      client.query = query;
      return originalRelease.apply(client);
    };
    
    return client;
  } catch (err) {
    console.error('Error acquiring client from pool', err);
    throw err;
  }
}

/**
 * Gracefully close the connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  try {
    console.log('Closing database connection pool...');
    await pool.end();
    console.log('Database connection pool closed successfully');
  } catch (err) {
    console.error('Error closing database connection pool', err);
    throw err;
  }
}

module.exports = {
  pool,
  getConnection,
  closePool,
  DEFAULT_CONFIG
};
