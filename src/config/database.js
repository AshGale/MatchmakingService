/**
 * Database Configuration Module
 * 
 * Centralizes database configuration settings and provides
 * connection information for the PostgreSQL database.
 */

// Load environment variables
require('dotenv').config();

// Allow for in-memory fallback when database connection fails
let useInMemoryStorage = process.env.USE_IN_MEMORY_DB === 'true';

const config = {
  // Connection details from environment variables or defaults
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
  database: process.env.PGDATABASE || process.env.DB_NAME || 'matchmaking',
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'pass',

  // Connection pool configuration
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '60000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10)
  },

  // Default database for basic connectivity tests or creating our database
  defaultDatabase: {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
    database: 'postgres',  // Connect to default PostgreSQL database
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'pass',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  },
  
  // SSL configuration for production environments
  ssl: process.env.NODE_ENV === 'production' ? 
    { rejectUnauthorized: false } : 
    undefined,
    
  // Connection monitoring settings
  monitoringEnabled: process.env.NODE_ENV !== 'production',
  logSlowQueries: true,
  slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '100', 10), // milliseconds
  
  // Fallback settings
  fallbackToMemory: process.env.FALLBACK_TO_MEMORY !== 'false',
  maxRetries: parseInt(process.env.MAX_DB_RETRIES || '5', 10)
};

/**
 * Indicates whether the system is using in-memory storage
 * @returns {boolean} True if using in-memory storage
 */
function isUsingInMemoryStorage() {
  return useInMemoryStorage;
}

/**
 * Enable in-memory storage mode
 */
function enableInMemoryStorage() {
  console.log('[DB Config] Switching to in-memory storage mode');
  useInMemoryStorage = true;
}

/**
 * Disable in-memory storage mode
 */
function disableInMemoryStorage() {
  console.log('[DB Config] Switching to persistent storage mode');
  useInMemoryStorage = false;
}

module.exports = {
  ...config,
  enableInMemoryFallback: process.env.FALLBACK_TO_MEMORY !== 'false',
  isUsingInMemoryStorage,
  enableInMemoryStorage,
  disableInMemoryStorage,
  setUseInMemoryStorage: (value) => {
    useInMemoryStorage = Boolean(value);
  }
};
