/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema
      .createTable('lobbies', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name', 50).notNullable();
        table.uuid('creator_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('max_players').notNullable().defaultTo(2);
        table.boolean('is_private').notNullable().defaultTo(false);
        table.enum('status', ['waiting', 'in_game', 'closed']).notNullable().defaultTo('waiting');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        
        // Indices
        table.index('creator_id');
        table.index('status');
      })
      .createTable('lobby_players', function(table) {
        table.uuid('lobby_id').notNullable().references('id').inTable('lobbies').onDelete('CASCADE');
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
        
        // Primary key
        table.primary(['lobby_id', 'user_id']);
        
        // Indices
        table.index('user_id');
      })
      .createTable('lobby_invitations', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('lobby_id').notNullable().references('id').inTable('lobbies').onDelete('CASCADE');
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.uuid('invited_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('invited_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('expires_at').notNullable();
        
        // Indices
        table.index(['lobby_id', 'user_id']);
        table.index('user_id');
        table.index('expires_at');
      });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema
      .dropTableIfExists('lobby_invitations')
      .dropTableIfExists('lobby_players')
      .dropTableIfExists('lobbies');
  };