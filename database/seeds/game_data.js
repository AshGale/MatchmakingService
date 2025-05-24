/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Truncate related tables to ensure clean slate
  await knex.raw('TRUNCATE TABLE game_history CASCADE');
  await knex.raw('TRUNCATE TABLE game_players CASCADE');
  await knex.raw('TRUNCATE TABLE games CASCADE');
  
  // Fetch existing users and lobbies
  const users = await knex('users').select('*');
  const lobbies = await knex('lobbies').select('*');
  
  if (users.length < 3 || lobbies.length < 2) {
    console.warn('Warning: Not enough users or lobbies for game seed data');
    return;
  }
  
  // Create test games
  const games = [
    {
      id: 'd6e81f9c-2b3a-4c7d-8e5f-1a2b3c4d5e6f',
      lobby_id: lobbies[0].id,
      status: 'in_progress',
      started_at: new Date(Date.now() - 600000), // 10 minutes ago
      completed_at: null,
      turn_player_id: users[0].id,
      turn_started_at: new Date(),
      game_state: JSON.stringify({
        board: Array(8).fill().map(() => Array(8).fill(null)),
        currentTurn: 3,
        lastMove: { player: users[1].id, position: [3, 4] }
      }),
      created_at: new Date(Date.now() - 600000), // 10 minutes ago
      updated_at: new Date()
    },
    {
      id: 'e7f92g0d-3c4d-5e6f-9g0h-2i3j4k5l6m7n',
      lobby_id: lobbies[1].id,
      status: 'completed',
      started_at: new Date(Date.now() - 7200000), // 2 hours ago
      completed_at: new Date(Date.now() - 3300000), // 55 minutes ago
      turn_player_id: null,
      turn_started_at: null,
      game_state: JSON.stringify({
        board: Array(8).fill().map(() => Array(8).fill(null)),
        currentTurn: 12,
        lastMove: { player: users[1].id, position: [7, 7] }
      }),
      created_at: new Date(Date.now() - 7200000), // 2 hours ago
      updated_at: new Date(Date.now() - 3300000) // 55 minutes ago
    }
  ];
  
  await knex('games').insert(games);
  
  // Add players to games
  const gamePlayers = [
    // Players for first game (in progress)
    {
      game_id: games[0].id,
      user_id: users[0].id,
      initial_elo: users[0].rating,
      final_elo: null,
      result: 'in_progress',
      position: 0,
      joined_at: new Date(Date.now() - 600000) // 10 minutes ago
    },
    {
      game_id: games[0].id,
      user_id: users[1].id,
      initial_elo: users[1].rating,
      final_elo: null,
      result: 'in_progress',
      position: 1,
      joined_at: new Date(Date.now() - 600000) // 10 minutes ago
    },
    
    // Players for second game (completed)
    {
      game_id: games[1].id,
      user_id: users[1].id,
      initial_elo: 1000,
      final_elo: 1050,
      result: 'win',
      position: 0,
      joined_at: new Date(Date.now() - 7200000) // 2 hours ago
    },
    {
      game_id: games[1].id,
      user_id: users[2].id,
      initial_elo: 1000,
      final_elo: 950,
      result: 'loss',
      position: 1,
      joined_at: new Date(Date.now() - 7200000) // 2 hours ago
    }
  ];
  
  await knex('game_players').insert(gamePlayers);
  
  // Add game history (moves)
  const gameHistory = [
    // History for first game (in progress)
    {
      id: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
      game_id: games[0].id,
      turn_number: 1,
      player_id: users[0].id,
      move_data: JSON.stringify({ position: [3, 3], type: 'place' }),
      timestamp: new Date(Date.now() - 580000) // 9m40s ago
    },
    {
      id: 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7',
      game_id: games[0].id,
      turn_number: 2,
      player_id: users[1].id,
      move_data: JSON.stringify({ position: [4, 3], type: 'place' }),
      timestamp: new Date(Date.now() - 560000) // 9m20s ago
    },
    {
      id: 'c3d4e5f6-g7h8-i9j0-k1l2-m3n4o5p6q7r8',
      game_id: games[0].id,
      turn_number: 3,
      player_id: users[0].id,
      move_data: JSON.stringify({ position: [3, 4], type: 'place' }),
      timestamp: new Date(Date.now() - 540000) // 9m ago
    },
    
    // History for second game (completed) - just a few sample moves
    {
      id: 'd4e5f6g7-h8i9-j0k1-l2m3-n4o5p6q7r8s9',
      game_id: games[1].id,
      turn_number: 1,
      player_id: users[1].id,
      move_data: JSON.stringify({ position: [4, 4], type: 'place' }),
      timestamp: new Date(Date.now() - 7180000) // 1h59m40s ago
    },
    {
      id: 'e5f6g7h8-i9j0-k1l2-m3n4-o5p6q7r8s9t0',
      game_id: games[1].id,
      turn_number: 2,
      player_id: users[2].id,
      move_data: JSON.stringify({ position: [3, 3], type: 'place' }),
      timestamp: new Date(Date.now() - 7160000) // 1h59m20s ago
    },
    // ... more moves would follow
    {
      id: 'f6g7h8i9-j0k1-l2m3-n4o5-p6q7r8s9t0u1',
      game_id: games[1].id,
      turn_number: 12,
      player_id: users[1].id,
      move_data: JSON.stringify({ position: [7, 7], type: 'place' }),
      timestamp: new Date(Date.now() - 3360000) // 56m ago
    }
  ];
  
  await knex('game_history').insert(gameHistory);
};
