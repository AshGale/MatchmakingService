// server/src/models/LobbyModel.js
import BaseModel from './BaseModel.js';

class LobbyModel extends BaseModel {
  constructor() {
    super('lobbies');
  }

  // Create a new lobby
  async createLobby(hostId, settings = {}) {
    try {
      const defaultSettings = {
        name: `${hostId}'s Lobby`,
        gameType: 'standard',
        maxPlayers: 2,
        isPrivate: false,
        password: null,
        ...settings
      };

      const lobby = await this.create({
        host_id: hostId,
        name: defaultSettings.name,
        game_type: defaultSettings.gameType,
        max_players: defaultSettings.maxPlayers,
        is_private: defaultSettings.isPrivate,
        password: defaultSettings.password,
        status: 'open',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Add host as first player
      await this.db('lobby_players').insert({
        lobby_id: lobby.id,
        player_id: hostId,
        joined_at: new Date(),
        is_ready: false
      });

      return lobby;
    } catch (error) {
      throw new Error(`Failed to create lobby: ${error.message}`);
    }
  }

  // Get lobby with players
  async getLobbyWithPlayers(lobbyId) {
    try {
      const lobby = await this.findById(lobbyId);
      
      if (!lobby) {
        return null;
      }

      const players = await this.db('lobby_players')
        .select([
          'lobby_players.is_ready',
          'lobby_players.joined_at',
          'users.id',
          'users.username',
          'users.elo_rating'
        ])
        .join('users', 'lobby_players.player_id', 'users.id')
        .where('lobby_players.lobby_id', lobbyId);

      return {
        ...lobby,
        players
      };
    } catch (error) {
      throw new Error(`Failed to get lobby with players: ${error.message}`);
    }
  }

  // Get all active lobbies
  async getActiveLobbies(filters = {}) {
    try {
      const { gameType, isPrivate, limit = 20, offset = 0 } = filters;
      
      let query = this.db(this.tableName)
        .select([
          `${this.tableName}.*`, 
          this.db.raw('COUNT(lobby_players.player_id) as player_count')
        ])
        .leftJoin('lobby_players', `${this.tableName}.id`, 'lobby_players.lobby_id')
        .where(`${this.tableName}.status`, 'open')
        .groupBy(`${this.tableName}.id`)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);
      
      if (gameType) {
        query = query.where('game_type', gameType);
      }
      
      if (isPrivate !== undefined) {
        query = query.where('is_private', isPrivate);
      }
      
      const lobbies = await query;
      return lobbies;
    } catch (error) {
      throw new Error(`Failed to get active lobbies: ${error.message}`);
    }
  }

  // Join a lobby
  async joinLobby(lobbyId, playerId, password = null) {
    try {
      // Get lobby to check if it's joinable
      const lobby = await this.findById(lobbyId);
      
      if (!lobby) {
        return { success: false, message: 'Lobby not found' };
      }
      
      if (lobby.status !== 'open') {
        return { success: false, message: 'Lobby is not open for joining' };
      }
      
      // Check if lobby is private and requires password
      if (lobby.is_private && lobby.password && lobby.password !== password) {
        return { success: false, message: 'Invalid lobby password' };
      }
      
      // Check if player is already in this lobby
      const existingPlayer = await this.db('lobby_players')
        .where({ lobby_id: lobbyId, player_id: playerId })
        .first();
        
      if (existingPlayer) {
        return { success: false, message: 'Player already in lobby' };
      }
      
      // Check if lobby is full
      const playerCount = await this.db('lobby_players')
        .where('lobby_id', lobbyId)
        .count('player_id as count')
        .first();
        
      if (Number(playerCount.count) >= lobby.max_players) {
        return { success: false, message: 'Lobby is full' };
      }
      
      // Add player to lobby
      await this.db('lobby_players').insert({
        lobby_id: lobbyId,
        player_id: playerId,
        joined_at: new Date(),
        is_ready: false
      });
      
      return { success: true, message: 'Successfully joined lobby' };
    } catch (error) {
      throw new Error(`Failed to join lobby: ${error.message}`);
    }
  }

  // Leave a lobby
  async leaveLobby(lobbyId, playerId) {
    try {
      // Check if player is in the lobby
      const playerInLobby = await this.db('lobby_players')
        .where({ lobby_id: lobbyId, player_id: playerId })
        .first();
        
      if (!playerInLobby) {
        return { success: false, message: 'Player not in lobby' };
      }
      
      // Get lobby to check if player is host
      const lobby = await this.findById(lobbyId);
      
      // Remove player from lobby
      await this.db('lobby_players')
        .where({ lobby_id: lobbyId, player_id: playerId })
        .del();
      
      // If player was the host, assign a new host or close the lobby
      if (lobby.host_id === playerId) {
        // Find next player to be host
        const nextPlayer = await this.db('lobby_players')
          .where('lobby_id', lobbyId)
          .first();
          
        if (nextPlayer) {
          // Assign new host
          await this.update(lobbyId, { 
            host_id: nextPlayer.player_id,
            updated_at: new Date()
          });
        } else {
          // No players left, close the lobby
          await this.update(lobbyId, { 
            status: 'closed',
            updated_at: new Date()
          });
        }
      }
      
      return { success: true, message: 'Successfully left lobby' };
    } catch (error) {
      throw new Error(`Failed to leave lobby: ${error.message}`);
    }
  }

  // Set player ready status
  async setPlayerReady(lobbyId, playerId, isReady) {
    try {
      // Update player ready status
      const updated = await this.db('lobby_players')
        .where({ lobby_id: lobbyId, player_id: playerId })
        .update({ is_ready: isReady });
        
      if (!updated) {
        return { success: false, message: 'Player not in lobby' };
      }
      
      return { success: true, message: 'Ready status updated' };
    } catch (error) {
      throw new Error(`Failed to update ready status: ${error.message}`);
    }
  }

  // Start game from lobby
  async startGame(lobbyId, gameModel) {
    try {
      // Check if lobby exists and is open
      const lobby = await this.getLobbyWithPlayers(lobbyId);
      
      if (!lobby) {
        return { success: false, message: 'Lobby not found' };
      }
      
      if (lobby.status !== 'open') {
        return { success: false, message: 'Lobby is not open' };
      }
      
      // Check if all players are ready
      const allReady = lobby.players.every(player => player.is_ready);
      
      if (!allReady) {
        return { success: false, message: 'Not all players are ready' };
      }
      
      // Check minimum player count
      if (lobby.players.length < 2) {
        return { success: false, message: 'Not enough players to start game' };
      }
      
      // Start a transaction
      const trx = await this.db.transaction();
      
      try {
        // Create game
        const game = await gameModel.createGame(lobby, trx);
        
        // Update lobby status
        await trx(this.tableName)
          .where('id', lobbyId)
          .update({ 
            status: 'in_game',
            game_id: game.id,
            updated_at: new Date()
          });
        
        // Commit transaction
        await trx.commit();
        
        return { success: true, message: 'Game started', game };
      } catch (error) {
        // Rollback transaction
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to start game: ${error.message}`);
    }
  }
}

export default new LobbyModel();
