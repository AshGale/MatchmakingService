// server/src/models/TransactionManager.js
import db from '../db.js';

class TransactionManager {
  constructor() {
    this.db = db;
  }

  // Begin a new transaction
  async beginTransaction() {
    return await this.db.transaction();
  }

  // Execute a function within a transaction
  async withTransaction(callback) {
    const trx = await this.beginTransaction();
    
    try {
      // Execute the callback, passing the transaction
      const result = await callback(trx);
      
      // If we get here, commit the transaction
      await trx.commit();
      
      return result;
    } catch (error) {
      // If an error occurs, rollback the transaction
      await trx.rollback();
      throw error;
    }
  }

  // Game initialization with participants
  async initializeGame(gameData, playerIds) {
    return this.withTransaction(async (trx) => {
      try {
        // Create game record
        const [game] = await trx('games').insert({
          game_type: gameData.gameType,
          status: 'active',
          started_at: new Date(),
          updated_at: new Date(),
          settings: JSON.stringify(gameData.settings || {})
        }).returning('*');

        // Add players to game
        const gamePlayers = playerIds.map(playerId => ({
          game_id: game.id,
          player_id: playerId,
          joined_at: new Date()
        }));

        await trx('game_players').insert(gamePlayers);

        // Initialize game state
        await trx('game_states').insert({
          game_id: game.id,
          state: JSON.stringify(gameData.initialState || {}),
          turn_number: 1,
          active_player_id: gameData.initialState?.activePlayerId || playerIds[0],
          created_at: new Date()
        });

        return game;
      } catch (error) {
        throw new Error(`Game initialization failed: ${error.message}`);
      }
    });
  }

  // Game completion with ELO updates
  async completeGame(gameId, winnerId, resultDetails = {}) {
    return this.withTransaction(async (trx) => {
      try {
        // Update game status
        await trx('games')
          .where('id', gameId)
          .update({
            status: 'completed',
            winner_id: winnerId,
            ended_at: new Date(),
            updated_at: new Date(),
            result_message: resultDetails.message || `Game completed, winner: ${winnerId}`
          });

        // Get players in game with their current ELO
        const players = await trx('game_players')
          .join('users', 'game_players.player_id', 'users.id')
          .where('game_players.game_id', gameId)
          .select([
            'game_players.player_id',
            'users.elo_rating as current_elo'
          ]);

        // If there's a winner, update ELO ratings
        if (winnerId && players.length > 1) {
          const winner = players.find(p => p.player_id === winnerId);
          const losers = players.filter(p => p.player_id !== winnerId);

          if (winner && losers.length > 0) {
            // Calculate and apply ELO changes
            const kFactor = 32;

            for (const loser of losers) {
              // Calculate expected outcome based on ELO difference
              const expectedWinner = 1 / (1 + Math.pow(10, (loser.current_elo - winner.current_elo) / 400));
              const expectedLoser = 1 - expectedWinner;

              // Calculate new ratings
              const newWinnerElo = Math.round(winner.current_elo + kFactor * (1 - expectedWinner));
              const newLoserElo = Math.round(loser.current_elo + kFactor * (0 - expectedLoser));

              // Update final ELO in game_players
              await trx('game_players')
                .where({ game_id: gameId, player_id: winner.player_id })
                .update({ final_elo: newWinnerElo });

              await trx('game_players')
                .where({ game_id: gameId, player_id: loser.player_id })
                .update({ final_elo: newLoserElo });

              // Update user ELO ratings
              await trx('users')
                .where('id', winner.player_id)
                .update({ 
                  elo_rating: newWinnerElo,
                  updated_at: new Date()
                });

              await trx('users')
                .where('id', loser.player_id)
                .update({ 
                  elo_rating: newLoserElo,
                  updated_at: new Date()
                });
            }
          }
        }

        // Get updated game data
        const completedGame = await trx('games')
          .where('id', gameId)
          .first();

        return completedGame;
      } catch (error) {
        throw new Error(`Game completion failed: ${error.message}`);
      }
    });
  }

  // Player joining a game with validation
  async playerJoinGame(gameId, playerId, options = {}) {
    return this.withTransaction(async (trx) => {
      try {
        // Check if game exists and is accepting players
        const game = await trx('games')
          .where('id', gameId)
          .whereIn('status', ['pending', 'waiting_for_players'])
          .first();

        if (!game) {
          throw new Error('Game is not available for joining');
        }

        // Check if player is already in game
        const existingPlayer = await trx('game_players')
          .where({ game_id: gameId, player_id: playerId })
          .first();

        if (existingPlayer) {
          throw new Error('Player is already in this game');
        }

        // Check if game is full
        const playerCount = await trx('game_players')
          .where('game_id', gameId)
          .count('player_id as count')
          .first();

        const settings = JSON.parse(game.settings);
        if (Number(playerCount.count) >= (settings.maxPlayers || 2)) {
          throw new Error('Game is full');
        }

        // Add player to game
        await trx('game_players').insert({
          game_id: gameId,
          player_id: playerId,
          joined_at: new Date(),
          team_id: options.teamId || null
        });

        // Check if game should start (all players joined)
        const updatedPlayerCount = await trx('game_players')
          .where('game_id', gameId)
          .count('player_id as count')
          .first();

        if (Number(updatedPlayerCount.count) >= (settings.minPlayers || settings.maxPlayers || 2)) {
          await trx('games')
            .where('id', gameId)
            .update({
              status: 'active',
              updated_at: new Date()
            });
        }

        return { success: true, message: 'Successfully joined game' };
      } catch (error) {
        throw new Error(`Failed to join game: ${error.message}`);
      }
    });
  }

  // User registration with profile creation
  async registerUser(userData) {
    return this.withTransaction(async (trx) => {
      try {
        // Check if username or email already exists
        const existingUser = await trx('users')
          .where('username', userData.username)
          .orWhere('email', userData.email)
          .first();

        if (existingUser) {
          throw new Error('Username or email already exists');
        }

        // Insert user record
        const [user] = await trx('users')
          .insert({
            username: userData.username,
            email: userData.email,
            password_hash: userData.passwordHash,
            elo_rating: 1000, // Default ELO
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning(['id', 'username', 'email', 'elo_rating', 'created_at']);

        // Create user profile record
        await trx('user_profiles').insert({
          user_id: user.id,
          display_name: userData.displayName || userData.username,
          avatar_url: userData.avatarUrl || null,
          bio: userData.bio || null,
          created_at: new Date(),
          updated_at: new Date()
        });

        // Create user preferences
        await trx('user_preferences').insert({
          user_id: user.id,
          notifications_enabled: true,
          theme: 'light',
          created_at: new Date(),
          updated_at: new Date()
        });

        return user;
      } catch (error) {
        throw new Error(`User registration failed: ${error.message}`);
      }
    });
  }

  // Match creation with validation
  async createMatch(playerIds, matchType, options = {}) {
    return this.withTransaction(async (trx) => {
      try {
        // Validate players exist
        const players = await trx('users')
          .whereIn('id', playerIds)
          .select(['id', 'username', 'elo_rating']);

        if (players.length !== playerIds.length) {
          throw new Error('One or more players do not exist');
        }

        // Create match record
        const [match] = await trx('matches').insert({
          match_type: matchType,
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
          settings: JSON.stringify(options.settings || {})
        }).returning('*');

        // Add players to match
        const matchPlayers = players.map(player => ({
          match_id: match.id,
          player_id: player.id,
          initial_elo: player.elo_rating,
          team_id: options.teamAssignments?.[player.id] || null
        }));

        await trx('match_players').insert(matchPlayers);

        // Create initial game for the match if auto-start is enabled
        if (options.autoStart) {
          const [game] = await trx('games').insert({
            match_id: match.id,
            game_type: matchType,
            status: 'active',
            started_at: new Date(),
            updated_at: new Date(),
            settings: JSON.stringify(options.gameSettings || options.settings || {})
          }).returning('*');

          // Add players to game
          const gamePlayers = matchPlayers.map(mp => ({
            game_id: game.id,
            player_id: mp.player_id,
            initial_elo: mp.initial_elo,
            team_id: mp.team_id,
            joined_at: new Date()
          }));

          await trx('game_players').insert(gamePlayers);

          // Update match status
          await trx('matches')
            .where('id', match.id)
            .update({
              status: 'in_progress',
              current_game_id: game.id
            });

          match.current_game_id = game.id;
          match.status = 'in_progress';
        }

        return match;
      } catch (error) {
        throw new Error(`Match creation failed: ${error.message}`);
      }
    });
  }
}

export default new TransactionManager();
