/**
 * MatchmakingEngine Class
 * 
 * Provides business logic for matchmaking functionality, including finding matches,
 * managing queues, and implementing matchmaking algorithms.
 * 
 * This class implements player matching based on various criteria and provides
 * a quick-join algorithm for players to find suitable lobbies.
 */

const { v4: uuidv4 } = require('uuid');
const { ValidationError } = require('../middleware/error.middleware');

// This would come from the database in a real implementation
// Here using in-memory data for demonstration
let queues = {};

/**
 * MatchmakingEngine class responsible for matching players and managing queues
 */
class MatchmakingEngine {
  /**
   * Creates a new MatchmakingEngine instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.lobbyManager - LobbyManager instance for creating/managing lobbies
   * @param {Object} options.dbOperations - Optional database operations to use
   * @param {Number} options.matchTimeout - Match timeout in seconds (default: 30)
   */
  constructor(options = {}) {
    if (!options.lobbyManager) {
      throw new Error('LobbyManager is required for MatchmakingEngine');
    }
    
    this.lobbyManager = options.lobbyManager;
    this.dbOps = options.dbOperations || {};
    this.matchTimeout = options.matchTimeout || 30;
    
    // Queue processing intervals
    this.queueIntervals = {};
  }
  
  /**
   * Find a suitable match for a player based on criteria
   * 
   * @param {string} playerId - ID of the player seeking a match
   * @param {Object} criteria - Matching criteria
   * @param {Number} criteria.maxPlayers - Preferred maximum players (2-4)
   * @param {String} criteria.mode - Game mode preference
   * @returns {Promise<Object>} - Match result with lobby ID
   */
  async findMatch(playerId, criteria = {}) {
    if (!playerId) {
      throw new ValidationError('Player ID is required', {
        code: 'INVALID_INPUT',
        details: { playerId }
      });
    }
    
    // Set defaults if not provided
    const maxPlayers = criteria.maxPlayers || 4;
    
    try {
      // Try to find an available lobby based on criteria
      const availableLobbies = await this.lobbyManager.getLobbiesByStatus('waiting', {
        limit: 10,
        offset: 0
      });
      
      // Filter lobbies based on criteria
      const matchingLobbies = this._filterMatchingLobbies(availableLobbies, criteria);
      
      if (matchingLobbies.length > 0) {
        // Pick the best lobby (the one with most players to speed up filling)
        const bestLobby = this._selectBestLobby(matchingLobbies);
        
        // Join the lobby
        const updatedLobby = await this.lobbyManager.joinLobby(playerId, bestLobby.id);
        
        return {
          success: true,
          lobby_id: updatedLobby.id,
          created_new: false
        };
      }
      
      // No matching lobby found, create a new one
      const newLobby = await this.lobbyManager.createLobby(playerId, { maxPlayers });
      
      return {
        success: true,
        lobby_id: newLobby.id,
        created_new: true
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error(`Failed to find match: ${error.message}`);
    }
  }
  
  /**
   * Creates a new matchmaking queue
   * 
   * @param {string} queueType - Type of queue to create
   * @param {Object} options - Queue options
   * @param {Number} options.maxPlayers - Max players per match
   * @param {Number} options.processingInterval - How often to process queue (in seconds)
   * @returns {string} - Queue ID
   */
  createQueue(queueType, options = {}) {
    if (!queueType) {
      throw new ValidationError('Queue type is required', {
        code: 'INVALID_INPUT',
        details: { queueType }
      });
    }
    
    const queueId = uuidv4();
    const processingInterval = options.processingInterval || 5; // seconds
    
    queues[queueId] = {
      id: queueId,
      type: queueType,
      maxPlayers: options.maxPlayers || 4,
      players: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Set up interval to process this queue
    this.queueIntervals[queueId] = setInterval(() => {
      this.processQueue(queueId).catch(err => {
        console.error(`Error processing queue ${queueId}:`, err);
      });
    }, processingInterval * 1000);
    
    return queueId;
  }
  
  /**
   * Adds a player to a matchmaking queue
   * 
   * @param {string} playerId - ID of the player
   * @param {string} queueId - ID of the queue to join
   * @param {Object} playerData - Additional player data for matchmaking
   * @param {Number} playerData.skill - Player skill rating
   * @returns {boolean} - Whether the player was added successfully
   */
  addToQueue(playerId, queueId, playerData = {}) {
    if (!playerId || !queueId) {
      throw new ValidationError('Player ID and Queue ID are required', {
        code: 'INVALID_INPUT',
        details: { playerId, queueId }
      });
    }
    
    if (!queues[queueId]) {
      throw new ValidationError('Queue not found', {
        code: 'NOT_FOUND',
        details: { queueId }
      });
    }
    
    // Check if player is already in queue
    const existingPlayer = queues[queueId].players.find(p => p.id === playerId);
    if (existingPlayer) {
      throw new ValidationError('Player is already in this queue', {
        code: 'PLAYER_EXISTS',
        details: { playerId, queueId }
      });
    }
    
    // Add player to queue with timestamp and data
    queues[queueId].players.push({
      id: playerId,
      joinedAt: new Date().toISOString(),
      skill: playerData.skill || 1000, // Default skill rating
      waitTime: 0,
      ...playerData
    });
    
    queues[queueId].updatedAt = new Date().toISOString();
    return true;
  }
  
  /**
   * Removes a player from any queues they're in
   * 
   * @param {string} playerId - ID of the player to remove
   * @returns {Array<string>} - IDs of queues the player was removed from
   */
  removeFromQueue(playerId) {
    if (!playerId) {
      throw new ValidationError('Player ID is required', {
        code: 'INVALID_INPUT',
        details: { playerId }
      });
    }
    
    const removedFrom = [];
    
    Object.keys(queues).forEach(queueId => {
      const queue = queues[queueId];
      const initialCount = queue.players.length;
      
      // Remove player from this queue
      queue.players = queue.players.filter(player => player.id !== playerId);
      
      if (queue.players.length !== initialCount) {
        removedFrom.push(queueId);
        queue.updatedAt = new Date().toISOString();
      }
    });
    
    return removedFrom;
  }
  
  /**
   * Process a queue to match players and create lobbies
   * 
   * @param {string} queueId - ID of the queue to process
   * @returns {Promise<Object>} - Processing results
   */
  async processQueue(queueId) {
    if (!queueId || !queues[queueId]) {
      throw new ValidationError('Valid queue ID is required', {
        code: 'INVALID_INPUT',
        details: { queueId }
      });
    }
    
    const queue = queues[queueId];
    if (queue.players.length === 0) {
      return { matches: 0, remaining: 0 };
    }
    
    // Update wait times for all players
    queue.players.forEach(player => {
      const joinedTime = new Date(player.joinedAt).getTime();
      const currentTime = Date.now();
      player.waitTime = Math.floor((currentTime - joinedTime) / 1000);
    });
    
    // Sort players by wait time (descending) and skill
    queue.players.sort((a, b) => {
      // Prioritize wait time, but also consider skill similarity
      if (b.waitTime - a.waitTime > this.matchTimeout) {
        return 1; // b has waited much longer
      } else if (a.waitTime - b.waitTime > this.matchTimeout) {
        return -1; // a has waited much longer
      }
      
      // Similar wait times, match by skill
      return Math.abs(a.skill - 1000) - Math.abs(b.skill - 1000);
    });
    
    let matches = 0;
    const matchedPlayers = new Set();
    const maxPlayersPerMatch = queue.maxPlayers;
    
    // Create matches until we can't form any more complete groups
    while (queue.players.length - matchedPlayers.size >= maxPlayersPerMatch) {
      const matchPlayers = [];
      
      // Find players for this match who haven't been matched yet
      for (const player of queue.players) {
        if (!matchedPlayers.has(player.id) && matchPlayers.length < maxPlayersPerMatch) {
          matchPlayers.push(player);
          matchedPlayers.add(player.id);
        }
        
        if (matchPlayers.length === maxPlayersPerMatch) {
          break;
        }
      }
      
      if (matchPlayers.length === maxPlayersPerMatch) {
        // We have enough players for a match
        try {
          // Create a lobby for this match
          const lobby = await this.lobbyManager.createLobby(matchPlayers[0].id, { 
            maxPlayers: maxPlayersPerMatch 
          });
          
          // Add remaining players to the lobby
          for (let i = 1; i < matchPlayers.length; i++) {
            await this.lobbyManager.joinLobby(matchPlayers[i].id, lobby.id);
          }
          
          matches++;
        } catch (error) {
          console.error('Error creating match:', error);
          // Remove these players from the matched set if we failed
          matchPlayers.forEach(p => matchedPlayers.delete(p.id));
        }
      }
    }
    
    // Remove matched players from the queue
    queue.players = queue.players.filter(player => !matchedPlayers.has(player.id));
    queue.updatedAt = new Date().toISOString();
    
    return {
      matches,
      remaining: queue.players.length
    };
  }
  
  /**
   * Filter lobbies based on matching criteria
   * 
   * @private
   * @param {Array} lobbies - Available lobbies
   * @param {Object} criteria - Matching criteria
   * @returns {Array} - Filtered list of matching lobbies
   */
  _filterMatchingLobbies(lobbies, criteria = {}) {
    return lobbies.filter(lobby => {
      // Must be in waiting status
      if (lobby.status !== 'waiting') {
        return false;
      }
      
      // Must not be full
      if (lobby.player_count >= lobby.max_players) {
        return false;
      }
      
      // If max players specified, must match
      if (criteria.maxPlayers && lobby.max_players !== criteria.maxPlayers) {
        return false;
      }
      
      // If game mode specified, must match
      if (criteria.mode && lobby.mode !== criteria.mode) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Select the best lobby from a list of candidates
   * 
   * @private
   * @param {Array} lobbies - List of candidate lobbies
   * @returns {Object} - Best lobby based on filling strategy
   */
  _selectBestLobby(lobbies) {
    if (lobbies.length === 0) {
      throw new Error('No lobbies available to select from');
    }
    
    // Strategy: pick the fullest lobby to maximize chances of starting games quickly
    return lobbies.sort((a, b) => b.player_count - a.player_count)[0];
  }
  
  /**
   * Clean up queue processing intervals
   */
  cleanup() {
    Object.values(this.queueIntervals).forEach(interval => {
      clearInterval(interval);
    });
    
    this.queueIntervals = {};
  }
}

module.exports = MatchmakingEngine;
