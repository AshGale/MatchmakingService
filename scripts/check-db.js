/**
 * Database Connection Check Tool
 * 
 * Quick utility to verify PostgreSQL database connection and schema.
 */

// Load environment variables
require('dotenv').config();

const { Client } = require('pg');
const path = require('path');

// Create connection config from environment variables
const config = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'matchmaking',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'pass',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000
};

console.log('=== Database Connection Check ===');
console.log(`Connecting to: ${config.database} at ${config.host}:${config.port} as user: ${config.user}`);

// Test connection to database
async function checkDatabase() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✓ Connection established successfully');
    
    // Check if required tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.length === 0) {
      console.log('✗ No tables found in database');
    } else {
      console.log(`✓ Found ${tables.length} tables in the database:`);
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
    // Test a query on one of the tables if they exist
    if (tables.some(t => t.table_name === 'lobbies')) {
      const { rows: lobbyCount } = await client.query('SELECT COUNT(*) FROM lobbies');
      console.log(`✓ Lobbies table accessible (contains ${lobbyCount[0].count} records)`);
    }
    
    console.log('Database check completed successfully');
  } catch (err) {
    console.error('✗ Database connection error:', err.message);
    if (err.message.includes('does not exist')) {
      console.log('The database may not have been created yet.');
    }
    console.log('Check your PostgreSQL installation and connection settings in .env file.');
  } finally {
    await client.end().catch(() => {});
  }
}

// Run the check
checkDatabase().catch(err => {
  console.error('Fatal error:', err);
});
