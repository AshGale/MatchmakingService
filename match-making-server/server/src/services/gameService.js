const db = require('../db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { GameManager } = require('./gameManager');
const { LobbyManager } = require('./lobbyManager');

// Access the singleton managers
const gameManager = new GameManager();
const lobbyManager = new LobbyManager();

class GameService {
  /**
   * Get list of active games
   * 
   * @returns {Promise<Array>} List of active games
   */
  async getActiveGames() {
    try {
      // Get active games from database
      const dbGames = await db('games as g')
        .where('g.status', 'active')
        .join('users as u1', 'g.player1_id', 'u1.id')
        .join('users as u2', 'g.player2_id', 'u2.id')
        .select(
          'g.id',
          'g.player1_id',
          'g.player2_id',
          'g.status',
          'g.current_turn_player_id',
          'g.current_turn_started_at',
          'g.current_turn_expires_at',
          'g.started_at',
          'u1.username as player1_username',
          'u2.username as player2_username'
        );
      
      // Merge with in-memory games from the game manager
      const inMemoryGames = gameManager.getPublicGamesList();
      const inMemoryGameIds = new Set(inMemoryGames.map(g => g.id));
      
      // Add games from DB that aren't in memory
      const activeGames = [...inMemoryGames];
      
      dbGames.forEach(dbGame => {
        if (!inMemoryGameIds.has(dbGame.id)) {
          activeGames.push({
            id: dbGame.id,
            players: [
              { id: dbGame.player1_id, username: dbGame.player1_username },
              { id: dbGame.player2_id, username: dbGame.player2_username }
            ],
            currentTurn: {
              playerId: dbGame.current_turn_player_id,
              startTime: dbGame.current_turn_started_at,
              endTime: dbGame.current_turn_expires_at
            },
            startTime: dbGame.started_at,
            status: dbGame.status
          });
        }
      });
      
      return activeGames;
    } catch (error) {
      logger.error('Error fetching active games', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get game by ID
   * 
   * @param {string} gameId Game ID
   * @param {string} userId User ID (for access control)
   * @returns {Promise<object|null>} Game object or null if not found
   */
  async getGameById(gameId, userId) {
    try {
      // Try to get from memory first
      const inMemoryGame = gameManager.getGame(gameId);
      
      if (inMemoryGame) {
        // Check if user is a player in this game
        const isPlayer = inMemoryGame.players.some(p => p.id === userId);
        
        if (!isPlayer) {
          // For non-players, return limited info
          return {
            id: inMemoryGame.id,
            players: inMemoryGame.players.map(p => ({ id: p.id, username: p.username })),
            status: inMemoryGame.status,
            startTime: inMemoryGame.startTime,
            // Only include current turn info and not the full state
            currentTurn: {
              playerId: inMemoryGame.currentTurn.playerId,
              startTime: inMemoryGame.currentTurn.startTime,
              endTime: inMemoryGame.currentTurn.endTime
            }
          };
        }
        
        // For players, return full game state
        return inMemoryGame;
      }
      
      // If not in memory, get from database
      const dbGame = await db('games as g')
        .where('g.id', gameId)
        .join('users as u1', 'g.player1_id', 'u1.id')
        .join('users as u2', 'g.player2_id', 'u2.id')
        .leftJoin('users as w', 'g.winner_id', 'w.id')
        .select(
          'g.id',
          'g.player1_id',
          'g.player2_id',
          'g.winner_id',
          'g.status',
          'g.state',
          'g.current_turn_player_id',
          'g.current_turn_started_at',
          'g.current_turn_expires_at',
          'g.started_at',
          'g.ended_at',
          'g.forfeited_by',
          'u1.username as player1_username',
          'u2.username as player2_username',
          'w.username as winner_username'
        )
        .first();
      
      if (!dbGame) {
        return null;
      }
      
      // Check if user is a player
      const isPlayer = dbGame.player1_id === userId || dbGame.player2_id === userId;
      
      // Format game object
      const formattedGame = {
        id: dbGame.id,
        players: [
          { id: dbGame.player1_id, username: dbGame.player1_username },
          { id: dbGame.player2_id, username: dbGame.player2_username }
        ],
        status: dbGame.status,
        startTime: dbGame.started_at,
        endTime: dbGame.ended_at || null,
        currentTurn: dbGame.status === 'active' ? {
          playerId: dbGame.current_turn_player_id,
          startTime: dbGame.current_turn_started_at,
          endTime: dbGame.current_turn_expires_at
        } : null,
        winner: dbGame.winner_id ? {
          id: dbGame.winner_id,
          username: dbGame.winner_username
        } : null,
        forfeitedBy: dbGame.forfeited_by || null
      };
      
      // Include full state only for players
      if (isPlayer) {
        formattedGame.state = dbGame.state;
        
        // Get move history
        const moves = await db('game_moves')
          .where('game_id', gameId)
          .orderBy('turn_number', 'asc')
          .select('player_id', 'move', 'turn_number', 'created_at');
        
        formattedGame.moveHistory = moves;
      }
      
      return formattedGame;
    } catch (error) {
      logger.error('Error fetching game', { error: error.message, gameId });
      throw error;
    }
  }
  
  /**
   * Process a move in a game
   * 
   * @param {string} gameId Game ID
   * @param {string} userId User ID making the move
   * @param {object} move Move data
   * @returns {Promise<object>} Updated game state
   */
  async processMove(gameId, userId, move) {
    try {
      // Check if game is in memory
      const inMemoryGame = gameManager.getGame(gameId);
      
      if (inMemoryGame) {
        // Use game manager to process the move
        const result = gameManager.processMove(gameId, userId, move);
        
        // Save move to database
        await this.saveMoveToDatabase(gameId, userId, move, inMemoryGame.state.moveHistory.length);
        
        // If game is over, save final state to database
        if (result.gameOver) {
          await this.saveGameCompletion(gameId, result);
        } else {
          // Otherwise, update current turn info
          await this.updateGameTurn(gameId, result.currentTurn);
        }
        
        return result;
      }
      
      // If not in memory, get from database
      const dbGame = await db('games')
        .where('id', gameId)
        .first();
      
      if (!dbGame) {
        throw new Error('Game not found');
      }
      
      if (dbGame.status !== 'active') {
        throw new Error('Game is not active');
      }
      
      if (dbGame.current_turn_player_id !== userId) {
        throw new Error('Not your turn');
      }
      
      // Load game into memory
      const loadedGame = this.loadGameIntoMemory(dbGame);
      
      // Process the move
      const result = gameManager.processMove(gameId, userId, move);
      
      // Save move to database
      await this.saveMoveToDatabase(gameId, userId, move, loadedGame.state.moveHistory.length);
      
      // If game is over, save final state to database
      if (result.gameOver) {
        await this.saveGameCompletion(gameId, result);
      } else {
        // Otherwise, update current turn info
        await this.updateGameTurn(gameId, result.currentTurn);
      }
      
      return result;
    } catch (error) {
      logger.error('Error processing move', { error: error.message, gameId, userId });
      throw error;
    }
  }
  
  /**
   * Forfeit a game
   * 
   * @param {string} gameId Game ID
   * @param {string} userId User ID forfeiting
   * @returns {Promise<object>} Result with winner info
   */
  async forfeitGame(gameId, userId) {
    try {
      // Check if game is in memory
      const inMemoryGame = gameManager.getGame(gameId);
      
      if (inMemoryGame) {
        // Use game manager to forfeit
        const result = gameManager.forfeitGame(gameId, userId);
        
        // Save forfeit to database
        await this.saveGameForfeit(gameId, userId, result.winner);
        
        return result;
      }
      
      // If not in memory, get from database
      const dbGame = await db('games')
        .where('id', gameId)
        .first();
      
      if (!dbGame) {
        throw new Error('Game not found');
      }
      
      if (dbGame.status !== 'active') {
        throw new Error('Game is not active');
      }
      
      // Check if user is a player
      if (dbGame.player1_id !== userId && dbGame.player2_id !== userId) {
        throw new Error('Player not in this game');
      }
      
      // Determine winner
      const winnerId = dbGame.player1_id === userId ? dbGame.player2_id : dbGame.player1_id;
      
      // Load game into memory
      const loadedGame = this.loadGameIntoMemory(dbGame);
      
      // Use game manager to forfeit
      const result = gameManager.forfeitGame(gameId, userId);
      
      // Save forfeit to database
      await this.saveGameForfeit(gameId, userId, result.winner);
      
      return result;
    } catch (error) {
      logger.error('Error forfeiting game', { error: error.message, gameId, userId });
      throw error;
    }
  }
  
  /**
   * Request a quick match
   * 
   * @param {string} userId User ID
   * @param {string} username Username
   * @param {object} preferences Match preferences
   * @returns {Promise<object>} Result
   */
  async requestQuickMatch(userId, username, preferences = {}) {
    try {
      // Use lobby manager to create quick match request
      const result = lobbyManager.requestQuickMatch(userId, username, preferences);
      
      // If match is found, create game in database
      if (result.matchId) {
        const { playerIds, game } = gameManager.createGameFromQuickMatch(result.matchId, result.players);
        
        // Save game to database
        await this.saveNewGame(game);
      }
      
      return result;
    } catch (error) {
      logger.error('Error requesting quick match', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Cancel a quick match request
   * 
   * @param {string} userId User ID
   * @returns {Promise<boolean>} Success
   */
  async cancelQuickMatch(userId) {
    try {
      return lobbyManager.cancelQuickMatch(userId);
    } catch (error) {
      logger.error('Error canceling quick match', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Create a game invitation
   * 
   * @param {string} fromUserId User ID sending invitation
   * @param {string} fromUsername Username sending invitation
   * @param {string} targetUserId User ID receiving invitation
   * @returns {Promise<object>} Created invitation
   */
  async createInvitation(fromUserId, fromUsername, targetUserId) {
    try {
      // Check if target user exists
      const targetUser = await db('users')
        .where('id', targetUserId)
        .first();
      
      if (!targetUser) {
        throw new Error('User not found');
      }
      
      // Cannot invite yourself
      if (fromUserId === targetUserId) {
        throw new Error('Cannot invite yourself');
      }
      
      // Use lobby manager to create invitation
      const invitationId = lobbyManager.createInvitation(fromUserId, fromUsername, targetUserId);
      
      return {
        invitationId,
        message: 'Invitation sent'
      };
    } catch (error) {
      logger.error('Error creating invitation', { error: error.message, fromUserId, targetUserId });
      throw error;
    }
  }
  
  /**
   * Respond to a game invitation
   * 
   * @param {string} invitationId Invitation ID
   * @param {string} userId User ID responding
   * @param {boolean} accept Whether to accept
   * @returns {Promise<object>} Result
   */
  async respondToInvitation(invitationId, userId, accept) {
    try {
      const invitation = lobbyManager.getInvitation(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation not found or expired');
      }
      
      if (invitation.targetUserId !== userId) {
        throw new Error('This invitation is not for you');
      }
      
      // If declined, just remove invitation
      if (!accept) {
        lobbyManager.removeInvitation(invitationId);
        
        return {
          message: 'Invitation declined'
        };
      }
      
      // If accepted, create a game
      const players = [
        { id: invitation.fromUserId, username: invitation.fromUsername },
        { id: userId, username: await this.getUsernameById(userId) }
      ];
      
      const game = gameManager.createGame(players);
      
      // Save game to database
      await this.saveNewGame(game);
      
      // Remove the invitation
      lobbyManager.removeInvitation(invitationId);
      
      return {
        message: 'Invitation accepted',
        gameId: game.id
      };
    } catch (error) {
      logger.error('Error responding to invitation', { error: error.message, invitationId, userId });
      throw error;
    }
  }
  
  /**
   * Save a new game to the database
   * 
   * @param {object} game Game object
   * @returns {Promise<object>} Saved game
   */
  async saveNewGame(game) {
    try {
      // Format game data for database
      const gameData = {
        id: game.id,
        player1_id: game.players[0].id,
        player2_id: game.players[1].id,
        state: game.state,
        status: 'active',
        current_turn_player_id: game.currentTurn.playerId,
        current_turn_started_at: new Date(game.currentTurn.startTime),
        current_turn_expires_at: new Date(game.currentTurn.endTime),
        started_at: new Date(game.startTime)
      };
      
      // Insert into database
      const [savedGame] = await db('games')
        .insert(gameData)
        .returning('*');
      
      return savedGame;
    } catch (error) {
      logger.error('Error saving new game', { error: error.message, gameId: game.id });
      throw error;
    }
  }
  
  /**
   * Save a move to the database
   * 
   * @param {string} gameId Game ID
   * @param {string} playerId Player ID
   * @param {object} move Move data
   * @param {number} turnNumber Turn number
   * @returns {Promise<object>} Saved move
   */
  async saveMoveToDatabase(gameId, playerId, move, turnNumber) {
    try {
      const [savedMove] = await db('game_moves')
        .insert({
          game_id: gameId,
          player_id: playerId,
          move,
          turn_number: turnNumber
        })
        .returning('*');
      
      return savedMove;
    } catch (error) {
      logger.error('Error saving move', { error: error.message, gameId, playerId });
      throw error;
    }
  }
  
  /**
   * Update game turn information
   * 
   * @param {string} gameId Game ID
   * @param {object} turnInfo Turn information
   * @returns {Promise<boolean>} Success
   */
  async updateGameTurn(gameId, turnInfo) {
    try {
      await db('games')
        .where('id', gameId)
        .update({
          current_turn_player_id: turnInfo.playerId,
          current_turn_started_at: new Date(turnInfo.startTime),
          current_turn_expires_at: new Date(turnInfo.endTime)
        });
      
      return true;
    } catch (error) {
      logger.error('Error updating game turn', { error: error.message, gameId });
      throw error;
    }
  }
  
  /**
   * Save game completion
   * 
   * @param {string} gameId Game ID
   * @param {object} result Game result
   * @returns {Promise<boolean>} Success
   */
  async saveGameCompletion(gameId, result) {
    try {
      const updates = {
        status: 'completed',
        winner_id: result.winner ? result.winner.id : null,
        ended_at: new Date(),
        state: result.state
      };
      
      await db('games')
        .where('id', gameId)
        .update(updates);
      
      // Save rating changes if available
      if (result.ratings) {
        const ratingPromises = result.ratings.map(rating => 
          db('rating_history').insert({
            user_id: rating.userId,
            game_id: gameId,
            old_rating: rating.oldRating,
            new_rating: rating.newRating,
            change: rating.change
          })
        );
        
        await Promise.all(ratingPromises);
        
        // Update user ratings
        for (const rating of result.ratings) {
          await db('users')
            .where('id', rating.userId)
            .update({
              rating: rating.newRating,
              ...(rating.change > 0 
                ? { wins: db.raw('wins + 1') }
                : rating.change < 0
                  ? { losses: db.raw('losses + 1') }
                  : { draws: db.raw('draws + 1') })
            });
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error saving game completion', { error: error.message, gameId });
      throw error;
    }
  }
  
  /**
   * Save game forfeit
   * 
   * @param {string} gameId Game ID
   * @param {string} forfeitingUserId User ID forfeiting
   * @param {object} winner Winner info
   * @returns {Promise<boolean>} Success
   */
  async saveGameForfeit(gameId, forfeitingUserId, winner) {
    try {
      const updates = {
        status: 'forfeited',
        winner_id: winner.id,
        ended_at: new Date(),
        forfeited_by: forfeitingUserId
      };
      
      await db('games')
        .where('id', gameId)
        .update(updates);
      
      // Get the game to update Elo ratings
      const game = await db('games')
        .where('id', gameId)
        .first();
      
      // Determine players
      const playerIds = [game.player1_id, game.player2_id];
      const players = await db('users')
        .whereIn('id', playerIds)
        .select('id', 'username', 'rating');
      
      // Calculate Elo rating changes
      const player1 = players.find(p => p.id === game.player1_id);
      const player2 = players.find(p => p.id === game.player2_id);
      
      const eloService = require('./eloService');
      const elo = new eloService();
      
      const winnerId = winner.id;
      const loserId = forfeitingUserId;
      
      const winnerIsPlayer1 = winnerId === player1.id;
      const winner_rating = winnerIsPlayer1 ? player1.rating : player2.rating;
      const loser_rating = winnerIsPlayer1 ? player2.rating : player1.rating;
      
      const { newRating: newWinnerRating, ratingChange: winnerChange } = elo.calculateNewRating(
        winner_rating,
        loser_rating,
        1,
        24 // Use lower K-factor for forfeits
      );
      
      const { newRating: newLoserRating, ratingChange: loserChange } = elo.calculateNewRating(
        loser_rating,
        winner_rating,
        0,
        24
      );
      
      // Save rating changes
      await db('rating_history').insert([
        {
          user_id: winnerId,
          game_id: gameId,
          old_rating: winner_rating,
          new_rating: newWinnerRating,
          change: winnerChange
        },
        {
          user_id: loserId,
          game_id: gameId,
          old_rating: loser_rating,
          new_rating: newLoserRating,
          change: loserChange
        }
      ]);
      
      // Update user ratings
      await db('users')
        .where('id', winnerId)
        .update({
          rating: newWinnerRating,
          wins: db.raw('wins + 1')
        });
      
      await db('users')
        .where('id', loserId)
        .update({
          rating: newLoserRating,
          losses: db.raw('losses + 1')
        });
      
      return true;
    } catch (error) {
      logger.error('Error saving game forfeit', { error: error.message, gameId, forfeitingUserId });
      throw error;
    }
  }
  
  /**
   * Load a game from the database into memory
   * 
   * @param {object} dbGame Database game record
   * @returns {object} Game object in memory format
   */
  async loadGameIntoMemory(dbGame) {
    try {
      // Get player usernames
      const players = await db('users')
        .whereIn('id', [dbGame.player1_id, dbGame.player2_id])
        .select('id', 'username');
      
      const player1 = players.find(p => p.id === dbGame.player1_id);
      const player2 = players.find(p => p.id === dbGame.player2_id);
      
      // Format game for memory
      const game = {
        id: dbGame.id,
        players: [
          { id: player1.id, username: player1.username, connected: true },
          { id: player2.id, username: player2.username, connected: true }
        ],
        state: dbGame.state,
        currentTurn: {
          playerId: dbGame.current_turn_player_id,
          playerIndex: dbGame.current_turn_player_id === player1.id ? 0 : 1,
          startTime: dbGame.current_turn_started_at,
          endTime: dbGame.current_turn_expires_at
        },
        status: dbGame.status,
        startTime: dbGame.started_at,
        lastActivityTime: new Date()
      };
      
      // Add to game manager
      gameManager.addGame(game);
      
      return game;
    } catch (error) {
      logger.error('Error loading game into memory', { error: error.message, gameId: dbGame.id });
      throw error;
    }
  }
  
  /**
   * Get username by user ID
   * 
   * @param {string} userId User ID
   * @returns {Promise<string>} Username
   */
  async getUsernameById(userId) {
    try {
      const user = await db('users')
        .where('id', userId)
        .select('username')
        .first();
      
      return user ? user.username : null;
    } catch (error) {
      logger.error('Error getting username by ID', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = GameService;