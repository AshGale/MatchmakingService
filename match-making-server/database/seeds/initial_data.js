/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
    // Truncate all tables to ensure clean slate
    await knex.raw('TRUNCATE TABLE rating_history CASCADE');
    await knex.raw('TRUNCATE TABLE game_moves CASCADE');
    await knex.raw('TRUNCATE TABLE games CASCADE');
    await knex.raw('TRUNCATE TABLE lobby_invitations CASCADE');
    await knex.raw('TRUNCATE TABLE lobby_players CASCADE');
    await knex.raw('TRUNCATE TABLE lobbies CASCADE');
    await knex.raw('TRUNCATE TABLE refresh_tokens CASCADE');
    await knex.raw('TRUNCATE TABLE users CASCADE');
    
    // Create test users
    const users = [
      {
        id: 'e63dcf64-9538-4ea3-a122-efd9d234e881',
        username: 'player1',
        // Password: Player1Password
        password: '$argon2id$v=19$m=16,t=2,p=1$YURrdXFQRDgzU2FrelhFcg$LTFNnZV+P0QJvXOYGgGyOw',
        rating: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'f15d5f2e-1f18-4d9d-a20c-9ef8e8c48c55',
        username: 'player2',
        // Password: Player2Password
        password: '$argon2id$v=19$m=16,t=2,p=1$YURrdXFQRDgzU2FrelhFcg$u9dD5O0tF2QCUq0GZ71tCA',
        rating: 1050,
        wins: 1,
        losses: 0,
        draws: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '88ca85ed-2c97-4de3-ae28-adc80fd3b4a6',
        username: 'player3',
        // Password: Player3Password
        password: '$argon2id$v=19$m=16,t=2,p=1$YURrdXFQRDgzU2FrelhFcg$dO2pu2YM8SFthtZXzXlNsQ',
        rating: 950,
        wins: 0,
        losses: 1,
        draws: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    await knex('users').insert(users);
    
    // Create test lobbies
    const lobbies = [
      {
        id: 'a7e31f3d-23c5-45b7-8cdc-62c59e3a5c7d',
        name: 'Public Game Lobby',
        creator_id: users[0].id,
        max_players: 2,
        is_private: false,
        status: 'waiting',
        created_at: new Date()
      },
      {
        id: 'b8c59d4e-6a1f-4d3b-b2e7-5f91c3a8d70b',
        name: 'Private Game Lobby',
        creator_id: users[1].id,
        max_players: 2,
        is_private: true,
        status: 'waiting',
        created_at: new Date()
      }
    ];
    
    await knex('lobbies').insert(lobbies);
    
    // Add players to lobbies
    const lobbyPlayers = [
      {
        lobby_id: lobbies[0].id,
        user_id: users[0].id,
        joined_at: new Date()
      },
      {
        lobby_id: lobbies[1].id,
        user_id: users[1].id,
        joined_at: new Date()
      }
    ];
    
    await knex('lobby_players').insert(lobbyPlayers);
    
    // Create a private lobby invitation
    const lobbyInvitations = [
      {
        id: 'c7d21e5f-3a4c-4b5d-9c6e-8d7f9a0b1c2d',
        lobby_id: lobbies[1].id,
        user_id: users[2].id,
        invited_by: users[1].id,
        invited_at: new Date(),
        expires_at: new Date(Date.now() + 3600000) // 1 hour from now
      }
    ];
    
    await knex('lobby_invitations').insert(lobbyInvitations);
    
    // Create a test game in progress
    const games = [
      {
        id: 'd6e81f9c-2b3a-4c7d-8e5f-1a2b3c4d5e6f',
        player1_id: users[1].id,
        player2_id: users[2].id,
        winner_id: null,
        status: 'active',
        state: {
          board: Array(8).fill().map(() => Array(8).fill(null)),
          moveHistory: []
        },
        current_turn_player_id: users[1].id,
        current_turn_started_at: new Date(),
        current_turn_expires_at: new Date(Date.now() + 300000), // 5 minutes from now
        started_at: new Date(Date.now() - 600000), // 10 minutes ago
        ended_at: null,
        forfeited_by: null
      }
    ];
    
    await knex('games').insert(games);
    
    // Create completed game with rating history
    const completedGame = {
      id: 'e7f92g0d-3c4d-5e6f-9g0h-2i3j4k5l6m7n',
      player1_id: users[1].id,
      player2_id: users[2].id,
      winner_id: users[1].id,
      status: 'completed',
      state: {
        board: Array(8).fill().map(() => Array(8).fill(null)),
        moveHistory: []
      },
      current_turn_player_id: users[1].id,
      current_turn_started_at: new Date(Date.now() - 3600000), // 1 hour ago
      current_turn_expires_at: new Date(Date.now() - 3300000), // 55 minutes ago
      started_at: new Date(Date.now() - 7200000), // 2 hours ago
      ended_at: new Date(Date.now() - 3300000), // 55 minutes ago
      forfeited_by: null
    };
    
    await knex('games').insert(completedGame);
    
    // Add rating history for completed game
    const ratingHistory = [
      {
        id: 'f8g01h2i-4j5k-6l7m-8n9o-3p4q5r6s7t8u',
        user_id: users[1].id,
        game_id: completedGame.id,
        old_rating: 1000,
        new_rating: 1050,
        change: 50,
        created_at: new Date(Date.now() - 3300000) // 55 minutes ago
      },
      {
        id: 'g9h12i3j-5k6l-7m8n-9o0p-4q5r6s7t8u9v',
        user_id: users[2].id,
        game_id: completedGame.id,
        old_rating: 1000,
        new_rating: 950,
        change: -50,
        created_at: new Date(Date.now() - 3300000) // 55 minutes ago
      }
    ];
    
    await knex('rating_history').insert(ratingHistory);
  };