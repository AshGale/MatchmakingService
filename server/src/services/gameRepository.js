// server/src/services/gameRepository.js
import db from '../db.js';

/**
 * Game repository for database operations
 */
class GameRepository {
  /**
   * Create a new game
   * @param {Object} gameData - Game data to insert
   * @returns {Promise<Object>} Created game record
   */
  async createGame(gameData) {
    const [game] = await db('games').insert(gameData).returning('*');
    return game;
  }

  /**
   * Get a game by ID
   * @param {string} id - Game ID
   * @returns {Promise<Object>} Game record
   */
  async getGameById(id) {
    return await db('games').where({ id }).first();
  }

  /**
   * Get active games with player information
   * @returns {Promise<Array>} List of active games
   */
  async getActiveGames() {
    const games = await db('games')
      .where('status', 'in_progress')
      .select('*');
      
    // Get players for each game
    for (const game of games) {
      game.players = await this.getGamePlayers(game.id);
    }
    
    return games;
  }

  /**
   * Get games by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of games
   */
  async getGamesByUserId(userId) {
    const gameIds = await db('game_players')
      .where({ user_id: userId })
      .pluck('game_id');
      
    if (gameIds.length === 0) return [];
    
    const games = await db('games')
      .whereIn('id', gameIds)
      .select('*');
      
    // Get players for each game
    for (const game of games) {
      game.players = await this.getGamePlayers(game.id);
    }
    
    return games;
  }

  /**
   * Update game status
   * @param {string} id - Game ID
   * @param {string} status - New status
   * @param {Date} completedAt - Completion timestamp (for completed games)
   * @returns {Promise<Object>} Updated game record
   */
  async updateGameStatus(id, status, completedAt = null) {
    const updateData = { status };
    if (completedAt) updateData.completed_at = completedAt;
    
    const [game] = await db('games')
      .where({ id })
      .update(updateData)
      .returning('*');
      
    return game;
  }

  /**
   * Update game turn
   * @param {string} id - Game ID
   * @param {string} turnPlayerId - User ID of the player whose turn it is
   * @returns {Promise<Object>} Updated game record
   */
  async updateGameTurn(id, turnPlayerId) {
    const [game] = await db('games')
      .where({ id })
      .update({
        turn_player_id: turnPlayerId,
        turn_started_at: db.fn.now()
      })
      .returning('*');
      
    return game;
  }

  /**
   * Update game state
   * @param {string} id - Game ID
   * @param {Object} gameState - New game state
   * @returns {Promise<Object>} Updated game record
   */
  async updateGameState(id, gameState) {
    const [game] = await db('games')
      .where({ id })
      .update({
        game_state: gameState
      })
      .returning('*');
      
    return game;
  }

  /**
   * Add a player to a game
   * @param {Object} gamePlayer - Game player data
   * @returns {Promise<Object>} Created game player record
   */
  async addGamePlayer(gamePlayer) {
    const [player] = await db('game_players').insert(gamePlayer).returning('*');
    return player;
  }

  /**
   * Get players for a game
   * @param {string} gameId - Game ID
   * @returns {Promise<Array>} List of game players with user info
   */
  async getGamePlayers(gameId) {
    return await db('game_players')
      .where({ game_id: gameId })
      .join('users', 'game_players.user_id', 'users.id')
      .select(
        'game_players.*',
        'users.username',
        'users.rating'
      );
  }

  /**
   * Update a player's result and final Elo
   * @param {string} gameId - Game ID
   * @param {string} userId - User ID
   * @param {string} result - Game result (win, loss, draw, forfeit)
   * @param {number} finalElo - Final Elo rating
   * @returns {Promise<Object>} Updated game player record
   */
  async updateGamePlayerResult(gameId, userId, result, finalElo) {
    const [player] = await db('game_players')
      .where({ game_id: gameId, user_id: userId })
      .update({
        result,
        final_elo: finalElo
      })
      .returning('*');
      
    return player;
  }

  /**
   * Add a move to game history
   * @param {Object} moveData - Move data
   * @returns {Promise<Object>} Created game history record
   */
  async addGameMove(moveData) {
    const [move] = await db('game_history').insert(moveData).returning('*');
    return move;
  }

  /**
   * Get game history
   * @param {string} gameId - Game ID
   * @returns {Promise<Array>} List of moves
   */
  async getGameHistory(gameId) {
    return await db('game_history')
      .where({ game_id: gameId })
      .orderBy('turn_number', 'asc')
      .join('users', 'game_history.player_id', 'users.id')
      .select(
        'game_history.*',
        'users.username'
      );
  }

  /**
   * Get game statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Game statistics
   */
  async getUserGameStats(userId) {
    const stats = await db('game_players')
      .where({ user_id: userId })
      .whereIn('result', ['win', 'loss', 'draw'])
      .groupBy('result')
      .select('result')
      .count('* as count');
    
    const formatted = {
      wins: 0,
      losses: 0,
      draws: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      formatted[`${stat.result}s`] = parseInt(stat.count);
      formatted.total += parseInt(stat.count);
    });
    
    return formatted;
  }
}

const gameRepository = new GameRepository();
export default gameRepository;
