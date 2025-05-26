// server/src/services/matchmakingService.js
import EloService from './eloService.js';
import GameService from './gameService.js';

class MatchmakingService {
  constructor(gameService = new GameService()) {
    this.waitingPlayers = []; // Array of {userId, eloRating, joinedAt, rangeMultiplier}
    this.eloService = new EloService();
    this.gameService = gameService;
    this.matchmakingInterval = null;
    this.baseEloRange = 200; // Base Elo range to look for opponents
    this.expansionRate = 0.2; // How much to expand range per interval
    this.expansionInterval = 10000; // 10 seconds between expansions
  }

  /**
   * Start the matchmaking service
   */
  start() {
    if (!this.matchmakingInterval) {
      // Run the matchmaking process every 5 seconds
      this.matchmakingInterval = setInterval(() => this.processQueue(), 5000);
      
      // Also run the range expansion process separately
      setInterval(() => this.expandRanges(), this.expansionInterval);
      
      console.log('Matchmaking service started');
    }
  }

  /**
   * Stop the matchmaking service
   */
  stop() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
      console.log('Matchmaking service stopped');
    }
  }

  /**
   * Add a player to the waiting queue
   * @param {string} userId - The user's ID
   * @param {number} eloRating - The user's Elo rating
   * @returns {boolean|object} - False if already in queue, match object if matched immediately, true otherwise
   */
  addToQueue(userId, eloRating) {
    // Check if player is already in queue
    const existingIndex = this.waitingPlayers.findIndex(p => p.userId === userId);
    if (existingIndex >= 0) {
      return false; // Already in queue
    }
    
    this.waitingPlayers.push({
      userId,
      eloRating,
      joinedAt: Date.now(),
      rangeMultiplier: 1.0 // Will increase over time
    });
    
    // Try to find a match immediately
    const match = this.findMatch(userId);
    return match ? match : true;
  }
  
  /**
   * Remove a player from the waiting queue
   * @param {string} userId - The user's ID
   * @returns {boolean} - Whether the player was removed
   */
  removeFromQueue(userId) {
    const index = this.waitingPlayers.findIndex(p => p.userId === userId);
    if (index >= 0) {
      this.waitingPlayers.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Find a match for a player
   * @param {string} userId - The user's ID
   * @returns {object|null} - Match object or null if no match found
   */
  findMatch(userId) {
    const playerIndex = this.waitingPlayers.findIndex(p => p.userId === userId);
    if (playerIndex < 0) return null;
    
    const player = this.waitingPlayers[playerIndex];
    const adjustedRange = this.baseEloRange * player.rangeMultiplier;
    
    // Find closest Elo match within range
    let bestMatch = null;
    let smallestEloDiff = Infinity;
    
    for (let i = 0; i < this.waitingPlayers.length; i++) {
      if (i === playerIndex) continue; // Skip self
      
      const potentialMatch = this.waitingPlayers[i];
      const eloDiff = Math.abs(player.eloRating - potentialMatch.eloRating);
      
      // Check if this player is within the acceptable range
      if (eloDiff <= adjustedRange && eloDiff < smallestEloDiff) {
        smallestEloDiff = eloDiff;
        bestMatch = potentialMatch;
      }
    }
    
    if (bestMatch) {
      // Create a match and remove both players from queue
      const matchDetails = this.createMatch(player, bestMatch);
      this.removeFromQueue(player.userId);
      this.removeFromQueue(bestMatch.userId);
      return matchDetails;
    }
    
    return null;
  }
  
  /**
   * Process the entire queue to find matches
   * @returns {Array} - Array of created matches
   */
  processQueue() {
    const matches = [];
    const playersCopy = [...this.waitingPlayers];
    
    // Sort by wait time (longest wait first)
    playersCopy.sort((a, b) => a.joinedAt - b.joinedAt);
    
    for (const player of playersCopy) {
      // Skip if player was already matched and removed
      if (!this.waitingPlayers.some(p => p.userId === player.userId)) continue;
      
      const match = this.findMatch(player.userId);
      if (match) {
        matches.push(match);
      }
    }
    
    return matches;
  }
  
  /**
   * Expand the acceptable range for all waiting players
   */
  expandRanges() {
    const now = Date.now();
    
    for (const player of this.waitingPlayers) {
      // Calculate time spent in queue in seconds
      const waitTime = (now - player.joinedAt) / 1000;
      
      // Expand range based on wait time
      // The longer they wait, the wider the acceptable range becomes
      player.rangeMultiplier = 1.0 + (waitTime / 60) * this.expansionRate;
    }
  }
  
  /**
   * Create a match between two players
   * @param {object} player1 - First player
   * @param {object} player2 - Second player
   * @returns {object} - Match details
   */
  createMatch(player1, player2) {
    // Determine which player goes first (random)
    const player1First = Math.random() >= 0.5;
    const whitePlayer = player1First ? player1.userId : player2.userId;
    const blackPlayer = player1First ? player2.userId : player1.userId;
    
    // Create a new game
    try {
      // Use synchronous approach for testing
      // In a real implementation, this would be async with await
      const gameData = this.gameService.createGame({
        whitePlayerId: whitePlayer,
        blackPlayerId: blackPlayer,
        timeControl: '10+5', // Default time control
        rated: true
      });
      
      if (gameData instanceof Promise) {
        // Handle promise for real implementation
        return gameData.then(data => ({
          gameId: data.id,
          whitePlayerId: whitePlayer,
          blackPlayerId: blackPlayer,
          whiteElo: player1First ? player1.eloRating : player2.eloRating,
          blackElo: player1First ? player2.eloRating : player1.eloRating,
          matchedAt: Date.now()
        })).catch(error => {
          console.error('Error creating match:', error);
          
          // Put players back in queue if match creation failed
          this.addToQueue(player1.userId, player1.eloRating);
          this.addToQueue(player2.userId, player2.eloRating);
          
          return null;
        });
      }
      
      // Synchronous response for tests
      return {
        gameId: gameData.id,
        whitePlayerId: whitePlayer,
        blackPlayerId: blackPlayer,
        whiteElo: player1First ? player1.eloRating : player2.eloRating,
        blackElo: player1First ? player2.eloRating : player1.eloRating,
        matchedAt: Date.now()
      };
    } catch (error) {
      console.error('Error creating match:', error);
      
      // Put players back in queue if match creation failed
      this.addToQueue(player1.userId, player1.eloRating);
      this.addToQueue(player2.userId, player2.eloRating);
      
      return null;
    }
  }
  
  /**
   * Get current queue statistics
   * @returns {object} - Queue stats
   */
  getQueueStats() {
    return {
      playersInQueue: this.waitingPlayers.length,
      averageWaitTime: this.calculateAverageWaitTime(),
      eloDistribution: this.getEloDistribution()
    };
  }
  
  /**
   * Calculate average wait time in seconds
   * @returns {number} - Average wait time
   */
  calculateAverageWaitTime() {
    if (this.waitingPlayers.length === 0) return 0;
    
    const now = Date.now();
    const totalWaitTime = this.waitingPlayers.reduce(
      (sum, player) => sum + (now - player.joinedAt), 
      0
    );
    
    return Math.round((totalWaitTime / this.waitingPlayers.length) / 1000);
  }
  
  /**
   * Get distribution of Elo ratings in queue
   * @returns {object} - Elo distribution by range
   */
  getEloDistribution() {
    const distribution = {
      '<1000': 0,
      '1000-1200': 0,
      '1200-1400': 0,
      '1400-1600': 0,
      '1600-1800': 0,
      '1800-2000': 0,
      '>2000': 0
    };
    
    for (const player of this.waitingPlayers) {
      if (player.eloRating < 1000) distribution['<1000']++;
      else if (player.eloRating < 1200) distribution['1000-1200']++;
      else if (player.eloRating < 1400) distribution['1200-1400']++;
      else if (player.eloRating < 1600) distribution['1400-1600']++;
      else if (player.eloRating < 1800) distribution['1600-1800']++;
      else if (player.eloRating < 2000) distribution['1800-2000']++;
      else distribution['>2000']++;
    }
    
    return distribution;
  }
}

export default MatchmakingService;
