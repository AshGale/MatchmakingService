// Update with your config settings.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const knexConfig = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      database: process.env.DB_NAME || 'matchmaker',
      user: process.env.DB_USER || 'matchmaker',
      password: process.env.DB_PASSWORD || 'securepassword',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: '/app/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: '/app/seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      database: process.env.DB_NAME || 'matchmaker',
      user: process.env.DB_USER || 'matchmaker',
      password: process.env.DB_PASSWORD || 'securepassword',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: '/app/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: '/app/seeds'
    }
  }
};

export default knexConfig;
