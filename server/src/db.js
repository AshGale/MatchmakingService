require('dotenv').config();
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'matchmaker',
    password: process.env.DB_PASSWORD || 'securepassword',
    database: process.env.DB_NAME || 'matchmaker'
  },
  pool: {
    min: 2,
    max: 10,
    // Handle connection issues automatically
    afterCreate: (conn, done) => {
      conn.query('SELECT 1', (err) => {
        if (err) {
          // First query failed, connection is bad
          done(err, conn);
        } else {
          // Connection established successfully
          done(null, conn);
        }
      });
    }
  },
  acquireConnectionTimeout: 10000,
  migrations: {
    directory: '../database/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: '../database/seeds'
  }
});

module.exports = db;