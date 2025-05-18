class EloService {
    /**
     * Calculate new Elo rating based on match outcome
     * 
     * @param {number} currentRating - Player's current rating
     * @param {number} opponentRating - Opponent's rating
     * @param {number} result - 1 for win, 0.5 for draw, 0 for loss
     * @param {number} kFactor - Determines maximum possible adjustment
     * @returns {object} New rating and rating change
     */
    calculateNewRating(currentRating, opponentRating, result, kFactor = 32) {
      // Calculate expected score
      const expectedScore = this.getExpectedScore(currentRating, opponentRating);
      
      // Calculate rating change
      const ratingChange = Math.round(kFactor * (result - expectedScore));
      
      // Calculate new rating
      const newRating = currentRating + ratingChange;
      
      return {
        newRating,
        ratingChange
      };
    }
    
    /**
     * Calculate expected score based on ratings
     * 
     * @param {number} rating - Player's rating
     * @param {number} opponentRating - Opponent's rating
     * @returns {number} Expected score (between 0 and 1)
     */
    getExpectedScore(rating, opponentRating) {
      return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
    }
    
    /**
     * Determine dynamic K-factor based on player's rating
     * Higher K-factor for newer players, lower for established players
     * 
     * @param {number} rating - Player's current rating
     * @param {number} gameCount - Number of games played
     * @returns {number} Appropriate K-factor
     */
    getDynamicKFactor(rating, gameCount) {
      if (gameCount < 30) {
        return 40; // New player, more volatile rating
      } else if (rating < 2100) {
        return 32; // Normal player
      } else {
        return 24; // Expert player, more stable rating
      }
    }
    
    /**
     * Calculate provisional rating for new players
     * 
     * @param {Array} results - Array of results against rated players
     * @returns {number} Provisional rating
     */
    calculateProvisionalRating(results) {
      if (!results || results.length === 0) {
        return 1000; // Default starting rating
      }
      
      // Calculate average performance
      let totalPerformance = 0;
      let totalGames = 0;
      
      results.forEach(result => {
        const { opponentRating, outcome } = result;
        let performance;
        
        if (outcome === 1) { // Win
          performance = opponentRating + 400;
        } else if (outcome === 0.5) { // Draw
          performance = opponentRating;
        } else { // Loss
          performance = opponentRating - 400;
        }
        
        totalPerformance += performance;
        totalGames++;
      });
      
      return Math.round(totalPerformance / totalGames);
    }
  }
  
  module.exports = EloService;