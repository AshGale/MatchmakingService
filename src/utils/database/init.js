/**
 * Database Initialization Module
 * 
 * Handles initializing the database, including creating the database if it doesn't exist
 * and falling back to in-memory storage if database connection fails.
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const dbConfig = require('../../config/database');
const { logger } = require('../../middleware/logging.middleware');
const { enableInMemoryStorage } = require('../../config/database');
const { DatabaseError } = require('./errors');

// In-memory storage for fallback mode
const inMemoryStorage = {
  lobbies: new Map(),
  players: new Map(),
  lobbyPlayers: new Map(),
  games: new Map()
};

/**
 * Initialize the database and schema
 * @returns {Promise<boolean>} True if database is ready, false if using in-memory storage
 */
const initializeDatabase = async () => {
  // If in-memory mode is explicitly enabled, don't try to connect to the database
  if (dbConfig.isUsingInMemoryStorage()) {
    logger.info('In-memory storage mode is enabled, skipping database initialization');
    return false;
  }
  
  try {
    // First try to connect to the specific database directly
    try {
      await testDatabaseConnection();
      logger.info('Connected to database successfully');
      return true;
    } catch (err) {
      logger.warn('Could not connect directly to database:', err.message);
      logger.info('Attempting to create database and apply schema...');
    }
    
    // If we get here, we couldn't connect directly to the database
    // Create admin connection config for default database
    const adminConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.defaultDatabase,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl,
      connectionTimeoutMillis: 5000
    };
    
    logger.info(`Connecting to default database '${adminConfig.database}' to perform admin operations...`);
    const adminClient = new Client(adminConfig);
    
    try {
      await adminClient.connect();
      logger.info('Connected to default database for admin operations');
      
      // Check if our target database exists
      const { rows } = await adminClient.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbConfig.database]
      );
      
      let needToApplySchema = false;
      
      if (rows.length === 0) {
        logger.info(`Database '${dbConfig.database}' does not exist, creating...`);
        
        // Create database (cannot use parameters for DB name in CREATE DATABASE)
        const createDbQuery = `CREATE DATABASE ${dbConfig.database}`;
        await adminClient.query(createDbQuery);
        
        logger.info(`Database '${dbConfig.database}' created successfully`);
        needToApplySchema = true;
      } else {
        logger.info(`Database '${dbConfig.database}' already exists`);
      }
      
      // Always close the admin client before switching databases
      await adminClient.end();
      
      if (needToApplySchema) {
        // Apply schema to newly created database
        logger.info('Applying schema to new database...');
        const schemaSuccess = await applyDatabaseSchema();
        if (!schemaSuccess) {
          throw new Error('Failed to apply database schema');
        }
      }
      
      // Test the connection again after creating/checking the database
      await testDatabaseConnection();
      logger.info('Database initialized successfully');
      return true;
      
    } catch (error) {
      logger.error('Error during database admin operations:', error);
      try {
        await adminClient.end();
      } catch (endError) {
        logger.error('Error closing admin client:', endError);
      }
      throw error;
    }
  } catch (err) {
    logger.error('Failed to initialize database:', err);
    
    if (dbConfig.enableInMemoryFallback) {
      logger.warn('Falling back to in-memory storage');
      dbConfig.setUseInMemoryStorage(true);
      return false;
    } else {
      throw new Error('Database initialization failed and in-memory fallback is disabled');
    }
  }
};  

/**
 * Apply the schema to the database
 * @returns {Promise<boolean>} True if schema was applied successfully
 */
const applyDatabaseSchema = async () => {
  logger.info(`Applying schema to database '${dbConfig.database}'...`);
  
  // Connect to our newly created/existing database
  const client = new Client({
    ...dbConfig,
    database: dbConfig.database, // Connect to our actual database now
    connectionTimeoutMillis: 10000 // Longer timeout for schema operations
  });
  
  try {
    await client.connect();
    
    // Get schema SQL content
    const schemaPath = path.join(__dirname, '../../../schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      logger.error(`Schema file not found at path: ${schemaPath}`);
      return false;
    }
    
    logger.info(`Reading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Apply schema
    try {
      await client.query(schemaSql);
      
      // Verify schema application by checking if lobbies table exists
      const { rows } = await client.query(
        "SELECT to_regclass('public.lobbies') as table_exists"
      );
      
      if (rows[0].table_exists) {
        logger.info('Database schema applied successfully, lobbies table exists');
        return true;
      } else {
        logger.error('Schema application may have failed - lobbies table not found');
        return false;
      }
    } catch (schemaError) {
      // If error contains "already exists", it might be that the schema was already applied
      if (schemaError.message && schemaError.message.includes('already exists')) {
        logger.info('Some schema elements already exist, schema may be partially applied');
        return true;
      }
      throw schemaError;
    }
  } catch (error) {
    logger.error('Error applying database schema:', error);
    logger.error(error.stack || 'No stack trace available');
    return false;
  } finally {
    try {
      await client.end();
    } catch (endError) {
      logger.error('Error closing schema client connection:', endError);
    }
  }
};  

/**
 * Test the database connection
 * @returns {Promise<void>}
 */
const testDatabaseConnection = async () => {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end();
  }
};

/**
 * Get in-memory storage for a specific entity type
 * @param {string} entityType - The type of entity (lobbies, players, etc)
 * @returns {Map} The in-memory storage map for the entity type
 */
function getInMemoryStorage(entityType) {
  if (!inMemoryStorage[entityType]) {
    inMemoryStorage[entityType] = new Map();
  }
  return inMemoryStorage[entityType];
}

/**
 * Clear all in-memory storage (for testing)
 */
function clearInMemoryStorage() {
  Object.keys(inMemoryStorage).forEach(key => {
    inMemoryStorage[key].clear();
  });
}

module.exports = {
  initializeDatabase,
  getInMemoryStorage,
  clearInMemoryStorage
};
