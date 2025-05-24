/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema
    .createTable('games', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('lobby_id').references('id').inTable('lobbies').onDelete('SET NULL');
      table.enum('status', ['waiting', 'in_progress', 'completed', 'cancelled']).notNullable().defaultTo('waiting');
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.uuid('turn_player_id').references('id').inTable('users');
      table.timestamp('turn_started_at');
      table.jsonb('game_state').defaultTo('{}');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      
      // Indices
      table.index('lobby_id');
      table.index('status');
      table.index('turn_player_id');
    })
    .createTable('game_players', function(table) {
      table.uuid('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('initial_elo').notNullable();
      table.integer('final_elo');
      table.enum('result', ['win', 'loss', 'draw', 'forfeit', 'in_progress']).notNullable().defaultTo('in_progress');
      table.integer('position').notNullable();
      table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
      
      // Primary key
      table.primary(['game_id', 'user_id']);
      
      // Indices
      table.index('user_id');
    })
    .createTable('game_history', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE');
      table.integer('turn_number').notNullable();
      table.uuid('player_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('move_data').notNullable();
      table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
      
      // Indices
      table.index(['game_id', 'turn_number']);
      table.index('player_id');
    })
    .raw(`
      -- Create trigger for games.updated_at
      CREATE TRIGGER update_games_updated_at
      BEFORE UPDATE ON games
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
      
      -- Add comments
      COMMENT ON TABLE games IS 'Stores active and completed games';
      COMMENT ON TABLE game_players IS 'Stores player information for each game';
      COMMENT ON TABLE game_history IS 'Stores move history for each game';
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema
    .dropTableIfExists('game_history')
    .dropTableIfExists('game_players')
    .dropTableIfExists('games');
};
