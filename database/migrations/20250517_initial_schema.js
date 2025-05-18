/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
      .createTable('users', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('username', 30).notNullable().unique();
        table.string('password').notNullable();
        table.integer('rating').notNullable().defaultTo(1000);
        table.integer('wins').notNullable().defaultTo(0);
        table.integer('losses').notNullable().defaultTo(0);
        table.integer('draws').notNullable().defaultTo(0);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        
        // Indices
        table.index('username');
        table.index('rating');
      })
      .createTable('refresh_tokens', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.text('token').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('expires_at').notNullable();
        
        // Indices
        table.index('token');
        table.index('user_id');
        table.index('expires_at');
      })
      .createTable('games', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('player1_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('player2_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('winner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.enum('status', ['active', 'completed', 'abandoned', 'forfeited']).notNullable().defaultTo('active');
        table.jsonb('state').notNullable();
        table.uuid('current_turn_player_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('current_turn_started_at').notNullable();
        table.timestamp('current_turn_expires_at').notNullable();
        table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('ended_at').nullable();
        table.uuid('forfeited_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        
        // Indices
        table.index('player1_id');
        table.index('player2_id');
        table.index('status');
        table.index('started_at');
      })
      .createTable('game_moves', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE');
        table.uuid('player_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.jsonb('move').notNullable();
        table.integer('turn_number').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        
        // Indices
        table.index('game_id');
        table.index(['game_id', 'turn_number']);
      })
      .createTable('rating_history', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE');
        table.integer('old_rating').notNullable();
        table.integer('new_rating').notNullable();
        table.integer('change').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        
        // Indices
        table.index('user_id');
        table.index('game_id');
      });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema
      .dropTableIfExists('rating_history')
      .dropTableIfExists('game_moves')
      .dropTableIfExists('games')
      .dropTableIfExists('refresh_tokens')
      .dropTableIfExists('users');
  };