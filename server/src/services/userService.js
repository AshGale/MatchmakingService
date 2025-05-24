import db from '../db.js';
import logger from '../utils/logger.js';

class UserService {
  /**
   * Find user by ID
   * 
   * @param {string} id User ID
   * @returns {Promise<object|null>} User object or null if not found
   */
  async findById(id) {
    try {
      const user = await db('users')
        .where({ id })
        .first();
      
      return user || null;
    } catch (error) {
      logger.error('Error finding user by ID', { error: error.message, userId: id });
      throw error;
    }
  }
  
  /**
   * Find user by username
   * 
   * @param {string} username Username
   * @returns {Promise<object|null>} User object or null if not found
   */
  async findByUsername(username) {
    try {
      const user = await db('users')
        .whereRaw('LOWER(username) = LOWER(?)', [username])
        .first();
      
      return user || null;
    } catch (error) {
      logger.error('Error finding user by username', { error: error.message, username });
      throw error;
    }
  }
  
  /**
   * Create a new user
   * 
   * @param {object} userData User data
   * @returns {Promise<object>} Created user
   */
  async createUser(userData) {
    try {
      // Check if username already exists
      const existingUser = await this.findByUsername(userData.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      
      // Add default values
      const user = {
        ...userData,
        rating: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const [newUser] = await db('users').insert(user).returning('*');
      
      return newUser;
    } catch (error) {
      logger.error('Error creating user', { error: error.message, username: userData.username });
      throw error;
    }
  }
  
  /**
   * Update user data
   * 
   * @param {string} id User ID
   * @param {object} updates Fields to update
   * @returns {Promise<object>} Updated user
   */
  async updateUser(id, updates) {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Only allow updating specific fields
      const allowedUpdates = {};
      const allowedFields = ['username', 'password', 'rating', 'wins', 'losses', 'draws'];
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          allowedUpdates[key] = updates[key];
        }
      });
      
      // Always update the updated_at timestamp
      allowedUpdates.updated_at = new Date();
      
      const [updatedUser] = await db('users')
        .where({ id })
        .update(allowedUpdates)
        .returning('*');
      
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user', { error: error.message, userId: id });
      throw error;
    }
  }
  
  /**
   * Get user profile with stats
   * 
   * @param {string} id User ID
   * @returns {Promise<object|null>} User profile or null if not found
   */
  async getUserProfile(id) {
    try {
      const user = await db('users')
        .where({ id })
        .select('id', 'username', 'rating', 'wins', 'losses', 'draws', 'created_at')
        .first();
      
      if (!user) {
        return null;
      }
      
      // Calculate win rate
      const totalGames = user.wins + user.losses + user.draws;
      const winRate = totalGames > 0 ? (user.wins / totalGames) * 100 : 0;
      
      return {
        ...user,
        totalGames,
        winRate: Math.round(winRate * 100) / 100 // Round to 2 decimal places
      };
    } catch (error) {
      logger.error('Error getting user profile', { error: error.message, userId: id });
      throw error;
    }
  }
  
  /**
   * Get user game stats
   * 
   * @param {string} id User ID
   * @returns {Promise<object|null>} User stats or null if not found
   */
  async getUserStats(id) {
    try {
      const user = await this.findById(id);
      if (!user) {
        return null;
      }
      
      // Get basic stats
      const basicStats = {
        rating: user.rating,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        totalGames: user.wins + user.losses + user.draws
      };
      
      // Calculate win rate
      basicStats.winRate = basicStats.totalGames > 0 
        ? Math.round((user.wins / basicStats.totalGames) * 100 * 100) / 100
        : 0;
      
      // Get recent games
      const recentGames = await db('games')
        .where('player1_id', id)
        .orWhere('player2_id', id)
        .orderBy('ended_at', 'desc')
        .limit(5)
        .select('id', 'player1_id', 'player2_id', 'winner_id', 'status', 'started_at', 'ended_at');
      
      // Get rating history
      const ratingHistory = await db('rating_history')
        .where('user_id', id)
        .orderBy('created_at', 'desc')
        .limit(10)
        .select('rating', 'change', 'game_id', 'created_at');
      
      return {
        ...basicStats,
        recentGames,
        ratingHistory
      };
    } catch (error) {
      logger.error('Error getting user stats', { error: error.message, userId: id });
      throw error;
    }
  }
  
  /**
   * Get user's game history
   * 
   * @param {string} userId User ID
   * @param {number} page Page number
   * @param {number} limit Items per page
   * @returns {Promise<object>} Paginated game history
   */
  async getUserGameHistory(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Count total games
      const [{ count }] = await db('games')
        .where('player1_id', userId)
        .orWhere('player2_id', userId)
        .count();
      
      const totalGames = parseInt(count, 10);
      const totalPages = Math.ceil(totalGames / limit);
      
      // Get games for current page
      const games = await db('games as g')
        .where('g.player1_id', userId)
        .orWhere('g.player2_id', userId)
        .orderBy('g.ended_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select(
          'g.id',
          'g.player1_id',
          'g.player2_id',
          'g.winner_id',
          'g.status',
          'g.started_at',
          'g.ended_at'
        )
        .join('users as u1', 'g.player1_id', 'u1.id')
        .join('users as u2', 'g.player2_id', 'u2.id')
        .select(
          'u1.username as player1_username',
          'u2.username as player2_username'
        );
      
      // Add rating changes if available
      const gameIds = games.map(game => game.id);
      
      if (gameIds.length > 0) {
        const ratingChanges = await db('rating_history')
          .whereIn('game_id', gameIds)
          .andWhere('user_id', userId)
          .select('game_id', 'change', 'old_rating', 'new_rating');
        
        // Create a map for quick lookup
        const ratingChangeMap = ratingChanges.reduce((map, change) => {
          map[change.game_id] = change;
          return map;
        }, {});
        
        // Add rating changes to games
        games.forEach(game => {
          game.ratingChange = ratingChangeMap[game.id] || null;
        });
      }
      
      return {
        games,
        pagination: {
          total: totalGames,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting user game history', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Get paginated list of users
   * 
   * @param {number} page Page number
   * @param {number} limit Items per page
   * @param {string} search Search term
   * @returns {Promise<object>} Paginated user list
   */
  async getUsers(page = 1, limit = 20, search = '') {
    try {
      const offset = (page - 1) * limit;
      
      let query = db('users')
        .select('id', 'username', 'rating', 'wins', 'losses', 'draws', 'created_at');
      
      // Apply search filter if provided
      if (search) {
        query = query.whereRaw('LOWER(username) LIKE ?', [`%${search.toLowerCase()}%`]);
      }
      
      // Count total matching users
      const [{ count }] = await query.clone().count();
      const total = parseInt(count, 10);
      const totalPages = Math.ceil(total / limit);
      
      // Get users for current page
      const users = await query
        .orderBy('rating', 'desc')
        .limit(limit)
        .offset(offset);
      
      return {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting users list', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Save refresh token for a user
   * 
   * @param {string} userId User ID
   * @param {string} token Refresh token
   * @returns {Promise<object>} Saved token record
   */
  async saveRefreshToken(userId, token) {
    try {
      const [savedToken] = await db('refresh_tokens')
        .insert({
          user_id: userId,
          token,
          created_at: new Date(),
          expires_at: new Date(Date.now() + parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || '604800') * 1000) // Default 7 days
        })
        .returning('*');
      
      return savedToken;
    } catch (error) {
      logger.error('Error saving refresh token', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Find refresh token
   * 
   * @param {string} userId User ID
   * @param {string} token Refresh token
   * @returns {Promise<object|null>} Token record or null if not found
   */
  async findRefreshToken(userId, token) {
    try {
      const tokenRecord = await db('refresh_tokens')
        .where({
          user_id: userId,
          token
        })
        .andWhere('expires_at', '>', new Date())
        .first();
      
      return tokenRecord || null;
    } catch (error) {
      logger.error('Error finding refresh token', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Replace an existing refresh token with a new one
   * 
   * @param {string} userId User ID
   * @param {string} oldToken Old refresh token
   * @param {string} newToken New refresh token
   * @returns {Promise<object>} Updated token record
   */
  async replaceRefreshToken(userId, oldToken, newToken) {
    try {
      // Delete old token
      await db('refresh_tokens')
        .where({
          user_id: userId,
          token: oldToken
        })
        .delete();
      
      // Create new token
      return this.saveRefreshToken(userId, newToken);
    } catch (error) {
      logger.error('Error replacing refresh token', { error: error.message, userId });
      throw error;
    }
  }
  
  /**
   * Delete refresh token
   * 
   * @param {string} userId User ID
   * @param {string} token Refresh token
   * @returns {Promise<boolean>} Success
   */
  async deleteRefreshToken(userId, token) {
    try {
      await db('refresh_tokens')
        .where({
          user_id: userId,
          token
        })
        .delete();
      
      return true;
    } catch (error) {
      logger.error('Error deleting refresh token', { error: error.message, userId });
      throw error;
    }
  }
}

export default UserService;