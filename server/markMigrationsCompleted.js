// markMigrationsCompleted.js
import knex from 'knex';
import knexConfig from './knexfile.js';

const db = knex(knexConfig.development);

async function markMigrationsCompleted() {
  try {
    // Check if knex_migrations table exists
    const hasTable = await db.schema.hasTable('knex_migrations');
    
    if (!hasTable) {
      console.log('Creating knex_migrations table...');
      await db.schema.createTable('knex_migrations', table => {
        table.increments();
        table.string('name');
        table.integer('batch');
        table.timestamp('migration_time');
      });
    }
    
    // Insert migration records
    const migrations = [
      '20250517_initial_schema.js',
      '20250517_lobbies_schema.js',
      '20250524_games_schema.js'
    ];
    
    console.log('Marking migrations as completed...');
    for (const migration of migrations) {
      const exists = await db('knex_migrations')
        .where({ name: migration })
        .first();
      
      if (!exists) {
        await db('knex_migrations').insert({
          name: migration,
          batch: 1,
          migration_time: new Date()
        });
        console.log(`Marked ${migration} as completed`);
      } else {
        console.log(`${migration} already marked as completed`);
      }
    }
    
    console.log('All migrations marked as completed');
  } catch (err) {
    console.error('Error marking migrations as completed:', err);
  } finally {
    await db.destroy();
  }
}

markMigrationsCompleted();
