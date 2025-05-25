// database/migrations/20250525_lobby_chat.js
/**
 * Migration to create lobby_chat table for persistent chat messages in lobbies
 */
export async function up(knex) {
  // Create lobby_chat table
  await knex.schema.createTable('lobby_chat', (table) => {
    table.uuid('id').primary();
    table.uuid('lobby_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('username', 50).notNullable();
    table.text('message').notNullable();
    table.timestamp('created_at').notNullable();
    
    // Add foreign key constraints
    table.foreign('lobby_id').references('id').inTable('lobbies').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Add indexes
    table.index('lobby_id');
    table.index('user_id');
    table.index('created_at');
  });
  
  // Add is_ready column to lobby_players if it doesn't exist
  const hasIsReadyColumn = await knex.schema.hasColumn('lobby_players', 'is_ready');
  if (!hasIsReadyColumn) {
    await knex.schema.alterTable('lobby_players', (table) => {
      table.boolean('is_ready').defaultTo(false);
    });
  }
  
  console.log('Created lobby_chat table and added is_ready column to lobby_players');
}

export async function down(knex) {
  // Drop lobby_chat table
  await knex.schema.dropTableIfExists('lobby_chat');
  
  // Remove is_ready column from lobby_players if it exists
  const hasIsReadyColumn = await knex.schema.hasColumn('lobby_players', 'is_ready');
  if (hasIsReadyColumn) {
    await knex.schema.alterTable('lobby_players', (table) => {
      table.dropColumn('is_ready');
    });
  }
  
  console.log('Dropped lobby_chat table and removed is_ready column from lobby_players');
}
