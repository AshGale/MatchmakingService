// server/migrations/20250531_create_invitations.js
export function up(knex) {
  return knex.schema.createTable('invitations', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    table.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('recipient_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['pending', 'accepted', 'declined', 'expired', 'cancelled']).defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('responded_at').nullable();
    
    // Index for efficient lookups
    table.index(['sender_id']);
    table.index(['recipient_id']);
    table.index(['status']);
    table.index(['expires_at']);
  });
}

export function down(knex) {
  return knex.schema.dropTable('invitations');
}
