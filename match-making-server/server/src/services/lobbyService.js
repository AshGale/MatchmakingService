const db = require('../db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class LobbyService {
  /**
   * Get list of lobbies
   * 
   * @param {boolean} includePrivate Whether to include private lobbies
   * @returns {Promise<Array>} List of lobbies
   */
  async getLobbies(includePrivate = false) {
    try {
      let query = db('lobbies as l')
        .join('users as u', 'l.creator_id', 'u.id')
        .select(
          'l.id',
          'l.name',
          'l.creator_id',
          'u.username as creator_name',
          'l.max_players',
          'l.is_private',
          'l.status',
          'l.created_at'
        );
      
      if (!includePrivate) {
        query = query.where('l.is_private', false);
      }
      
      const lobbies = await query;
      
      // Get players for each lobby
      const lobbyIds = lobbies.map(lobby => lobby.id);
      
      if (lobbyIds.length > 0) {
        const lobbyPlayers = await db('lobby_players as lp')
          .whereIn('lp.lobby_id', lobbyIds)
          .join('users as u', 'lp.user_id', 'u.id')
          .select('lp.lobby_id', 'lp.user_id', 'u.username');
        
        // Group players by lobby
        const playersByLobby = lobbyPlayers.reduce((acc, player) => {
          if (!acc[player.lobby_id]) {
            acc[player.lobby_id] = [];
          }
          acc[player.lobby_id].push({
            id: player.user_id,
            username: player.username
          });
          return acc;
        }, {});
        
        // Add players to lobbies
        lobbies.forEach(lobby => {
          lobby.players = playersByLobby[lobby.id] || [];
        });
      } else {
        // No lobbies, so initialize empty players arrays
        lobbies.forEach(lobby => {
          lobby.players = [];
        });
      }
      
      return lobbies;
    } catch (error) {
      logger.error('Error fetching lobbies', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get lobby by ID
   * 
   * @param {string} lobbyId Lobby ID
   * @returns {Promise<object|null>} Lobby object or null if not found
   */
  async getLobbyById(lobbyId) {
    try {
      const lobby = await db('lobbies as l')
        .where('l.id', lobbyId)
        .join('users as u', 'l.creator_id', 'u.id')
        .select(
          'l.id',
          'l.name',
          'l.creator_id',
          'u.username as creator_name',
          'l.max_players',
          'l.is_private',
          'l.status',
          'l.created_at'
        )
        .first();
      
      if (!lobby) {
        return null;
      }
      
      // Get players
      const players = await db('lobby_players as lp')
        .where('lp.lobby_id', lobbyId)
        .join('users as u', 'lp.user_id', 'u.id')
        .select('lp.user_id', 'u.username');
      
      lobby.players = players.map(player => ({
        id: player.user_id,
        username: player.username
      }));
      
      // Get invited players for private lobbies
      if (lobby.is_private) {
        const invitedUsers = await db('lobby_invitations')
          .where('lobby_id', lobbyId)
          .select('user_id');
        
        lobby.invitedPlayers = invitedUsers.map(invite => invite.user_id);
      }
      
      return lobby;
    } catch (error) {
      logger.error('Error fetching lobby', { error: error.message, lobbyId });
      throw error;
    }
  }
  
  /**
   * Create a new lobby
   * 
   * @param {object} lobbyData Lobby data
   * @returns {Promise<object>} Created lobby
   */
  async createLobby(lobbyData) {
    try {
      const { name, creatorId, creatorName, maxPlayers = 2, isPrivate = false } = lobbyData;
      
      // Create lobby
      const [lobby] = await db('lobbies')
        .insert({
          id: uuidv4(),
          name,
          creator_id: creatorId,
          max_players: maxPlayers,
          is_private: isPrivate,
          status: 'waiting',
          created_at: new Date()
        })
        .returning('*');
      
      // Add creator as a player
      await db('lobby_players')
        .insert({
          lobby_id: lobby.id,
          user_id: creatorId,
          joined_at: new Date()
        });
      
      // Return formatted lobby
      return {
        id: lobby.id,
        name: lobby.name,
        creatorId: lobby.creator_id,
        creatorName,
        maxPlayers: lobby.max_players,
        isPrivate: lobby.is_private,
        status: lobby.status,
        createdAt: lobby.created_at,
        players: [
          { id: creatorId, username: creatorName }
        ]
      };
    } catch (error) {
      logger.error('Error creating lobby', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Join a lobby
   * 
   * @param {string} lobbyId Lobby ID
   * @param {string} userId User ID
   * @param {string} username Username
   * @returns {Promise<object>} Updated lobby
   */
  async joinLobby(lobbyId, userId, username) {
    try {
      // Get lobby
      const lobby = await this.getLobbyById(lobbyId);
      
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      
      // Check if lobby is full
      if (lobby.players.length >= lobby.maxPlayers) {
        throw new Error('Lobby is full');
      }
      
      // Check if lobby is accepting players
      if (lobby.status !== 'waiting') {
        throw new Error('Lobby is not accepting new players');
      }
      
      // Check if user is already in the lobby
      const existingPlayer = lobby.players.find(p => p.id === userId);
      if (existingPlayer) {
        throw new Error('You are already in this lobby');
      }
      
      // For private lobbies, check if user is invited
      if (lobby.isPrivate && lobby.creatorId !== userId) {
        const isInvited = await db('lobby_invitations')
          .where({
            lobby_id: lobbyId,
            user_id: userId
          })
          .first();
        
        if (!isInvited) {
          throw new Error('This is a private lobby');
        }
      }
      
      // Add player to lobby
      await db('lobby_players')
        .insert({
          lobby_id: lobbyId,
          user_id: userId,
          joined_at: new Date()
        });
      
      // Get updated lobby
      return this.getLobbyById(lobbyId);
    } catch (error) {
      logger.error('Error joining lobby', { error: error.message, lobbyId, userId });
      throw error;
    }
  }
  
  /**
   * Leave a lobby
   * 
   * @param {string} lobbyId Lobby ID
   * @param {string} userId User ID
   * @returns {Promise<object>} Result
   */
  async leaveLobby(lobbyId, userId) {
    try {
      // Get lobby
      const lobby = await this.getLobbyById(lobbyId);
      
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      
      // Check if user is in the lobby
      const playerIndex = lobby.players.findIndex(p => p.id === userId);
      if (playerIndex === -1) {
        throw new Error('You are not in this lobby');
      }
      
      // Remove player from lobby
      await db('lobby_players')
        .where({
          lobby_id: lobbyId,
          user_id: userId
        })
        .delete();
      
      const result = {
        lobbyDeleted: false,
        newOwner: null
      };
      
      // If user is the creator, check if there are other players
      if (userId === lobby.creatorId && lobby.players.length > 1) {
        // Assign a new creator
        const newCreator = lobby.players.find(p => p.id !== userId);
        
        if (newCreator) {
          await db('lobbies')
            .where('id', lobbyId)
            .update({
              creator_id: newCreator.id
            });
          
          result.newOwner = newCreator;
        }
      }
      
      // If lobby is now empty or user was the only one, delete the lobby
      if (lobby.players.length <= 1) {
        await db('lobbies')
          .where('id', lobbyId)
          .delete();
        
        result.lobbyDeleted = true;
      } else {
        // Get updated lobby
        result.lobby = await this.getLobbyById(lobbyId);
      }
      
      return result;
    } catch (error) {
      logger.error('Error leaving lobby', { error: error.message, lobbyId, userId });
      throw error;
    }
  }
  
  /**
   * Start a game from a lobby
   * 
   * @param {string} lobbyId Lobby ID
   * @param {string} userId User ID initiating start
   * @returns {Promise<object>} Created game info
   */
  async startGame(lobbyId, userId) {
    try {
      // Get lobby
      const lobby = await this.getLobbyById(lobbyId);
      
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      
      // Check if user is the creator
      if (lobby.creatorId !== userId) {
        throw new Error('Only the lobby creator can start the game');
      }
      
      // Check player count
      if (lobby.players.length < 2) {
        throw new Error('Not enough players to start');
      }
      
      if (lobby.players.length > lobby.maxPlayers) {
        throw new Error('Too many players to start');
      }
      
      // Update lobby status
      await db('lobbies')
        .where('id', lobbyId)
        .update({
          status: 'in_game'
        });
      
      // Create game using GameService
      const GameService = require('./gameService');
      const gameService = new GameService();
      
      const game = await gameService.createGameFromLobby(lobby);
      
      return {
        gameId: game.id,
        message: 'Game started successfully'
      };
    } catch (error) {
      logger.error('Error starting game', { error: error.message, lobbyId, userId });
      throw error;
    }
  }
  
  /**
   * Invite a player to a private lobby
   * 
   * @param {string} lobbyId Lobby ID
   * @param {string} creatorId Creator ID
   * @param {string} targetUserId Target user ID
   * @returns {Promise<object>} Result
   */
  async inviteToLobby(lobbyId, creatorId, targetUserId) {
    try {
      // Get lobby
      const lobby = await this.getLobbyById(lobbyId);
      
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      
      // Check if user is the creator
      if (lobby.creatorId !== creatorId) {
        throw new Error('Only the lobby creator can send invitations');
      }
      
      // Cannot invite yourself
      if (creatorId === targetUserId) {
        throw new Error('Cannot invite yourself');
      }
      
      // Check if target user exists
      const targetUser = await db('users')
        .where('id', targetUserId)
        .first();
      
      if (!targetUser) {
        throw new Error('User not found');
      }
      
      // Check if already invited
      const existingInvite = await db('lobby_invitations')
        .where({
          lobby_id: lobbyId,
          user_id: targetUserId
        })
        .first();
      
      if (existingInvite) {
        throw new Error('User already invited');
      }
      
      // Create invitation
      await db('lobby_invitations')
        .insert({
          id: uuidv4(),
          lobby_id: lobbyId,
          user_id: targetUserId,
          invited_by: creatorId,
          invited_at: new Date(),
          expires_at: new Date(Date.now() + 3600000) // 1 hour expiration
        });
      
      return {
        message: 'Invitation sent successfully',
        targetUser: {
          id: targetUser.id,
          username: targetUser.username
        }
      };
    } catch (error) {
      logger.error('Error inviting to lobby', { error: error.message, lobbyId, creatorId, targetUserId });
      throw error;
    }
  }
}

module.exports = LobbyService;