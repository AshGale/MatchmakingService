const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const EloService = require('./eloService');

class GameManager {
  constructor() {
    this.games = new Map();
    this.eloService = new EloService();
    this.maxTurnTime = parseInt(process.env.MAX_TURN_TIME || 300) * 1000; // Convert to ms
  }

  createGame(players) {
    const gameId = uuidv4();
    
    // Randomly determine first player
    const firstPlayerIndex = Math.floor(Math.random() * players.length);
    
    const game = {
      id: gameId,
      players: players.map(player => ({
        ...player,
        connected: true
      })),
      state: {
        board: this.createInitialBoard(),
        moveHistory: []
      },
      currentTurn: {
        playerId: players[firstPlayerIndex].id,
        playerIndex: firstPlayerIndex,
        startTime: Date.now(),
        endTime: Date.now() + this.maxTurnTime
      },
      status: 'active',
      startTime: Date.now(),
      lastActivityTime: Date.now()
    };
    
    this.games.set(gameId, game);
    logger.info(`Game ${gameId} created with ${players.length} players`);
    
    return game;
  }

  createGameFromQuickMatch(matchId, players) {
    const game = this.createGame(players);
    
    return {
      playerIds: players.map(p => p.id),
      game
    };
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  getPublicGamesList() {
    // Return a list of active games with minimal info for display
    return Array.from(this.games.values())
      .filter(game => game.status === 'active')
      .map(game => ({
        id: game.id,
        players: game.players.map(p => ({ id: p.id, username: p.username })),
        startTime: game.startTime,
        status: game.status
      }));
  }

  processMove(gameId, playerId, move) {
    const game = this.games.get(gameId);
    
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    if (game.currentTurn.playerId !== playerId) {
      throw new Error('Not your turn');
    }
    
    // Validate move
    this.validateMove(game, move);
    
    // Apply move to game state
    this.applyMove(game, playerId, move);
    
    // Update game's last activity time
    game.lastActivityTime = Date.now();
    
    // Check if game is over after this move
    const gameOverResult = this.checkGameOver(game);
    
    if (gameOverResult.gameOver) {
      game.status = 'completed';
      game.winner = gameOverResult.winner;
      game.endTime = Date.now();
      
      logger.info(`Game ${gameId} completed with winner: ${gameOverResult.winner ? gameOverResult.winner.id : 'draw'}`);
      
      // Calculate and update Elo ratings
      const ratings = this.updateEloRatings(game);
      
      return {
        state: game.state,
        currentTurn: null,
        gameOver: true,
        winner: gameOverResult.winner,
        reason: gameOverResult.reason,
        ratings
      };
    }
    
    // Advance to next player's turn
    this.advanceTurn(game);
    
    return {
      state: game.state,
      currentTurn: game.currentTurn,
      gameOver: false
    };
  }

  validateMove(game, move) {
    // Basic validation - would be more complex in a real game
    if (!move || typeof move !== 'object') {
      throw new Error('Invalid move format');
    }
    
    // Example validation for a hypothetical board game
    if (move.type === 'place' && move.position) {
      const { x, y } = move.position;
      
      // Check if position is within board bounds
      if (x < 0 || x >= 8 || y < 0 || y >= 8) {
        throw new Error('Position out of bounds');
      }
      
      // Check if position is already occupied
      if (game.state.board[y][x] !== null) {
        throw new Error('Position already occupied');
      }
    } else {
      throw new Error('Unsupported move type');
    }
  }

  applyMove(game, playerId, move) {
    // Example implementation for a hypothetical board game
    if (move.type === 'place' && move.position) {
      const { x, y } = move.position;
      const playerIndex = game.players.findIndex(p => p.id === playerId);
      
      // Update board state
      game.state.board[y][x] = playerIndex;
      
      // Add to move history
      game.state.moveHistory.push({
        playerId,
        move,
        timestamp: Date.now()
      });
    }
  }

  advanceTurn(game) {
    const currentPlayerIndex = game.currentTurn.playerIndex;
    const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
    
    game.currentTurn = {
      playerId: game.players[nextPlayerIndex].id,
      playerIndex: nextPlayerIndex,
      startTime: Date.now(),
      endTime: Date.now() + this.maxTurnTime
    };
  }

  checkGameOver(game) {
    // Example win condition check for a hypothetical board game
    const board = game.state.board;
    
    // Check rows
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x <= 4; x++) {
        const value = board[y][x];
        if (value !== null &&
            value === board[y][x+1] &&
            value === board[y][x+2] &&
            value === board[y][x+3]) {
          return {
            gameOver: true,
            winner: game.players[value],
            reason: 'win'
          };
        }
      }
    }
    
    // Check columns
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y <= 4; y++) {
        const value = board[y][x];
        if (value !== null &&
            value === board[y+1][x] &&
            value === board[y+2][x] &&
            value === board[y+3][x]) {
          return {
            gameOver: true,
            winner: game.players[value],
            reason: 'win'
          };
        }
      }
    }
    
    // Check diagonals (top-left to bottom-right)
    for (let y = 0; y <= 4; y++) {
      for (let x = 0; x <= 4; x++) {
        const value = board[y][x];
        if (value !== null &&
            value === board[y+1][x+1] &&
            value === board[y+2][x+2] &&
            value === board[y+3][x+3]) {
          return {
            gameOver: true,
            winner: game.players[value],
            reason: 'win'
          };
        }
      }
    }
    
    // Check diagonals (bottom-left to top-right)
    for (let y = 3; y < 8; y++) {
      for (let x = 0; x <= 4; x++) {
        const value = board[y][x];
        if (value !== null &&
            value === board[y-1][x+1] &&
            value === board[y-2][x+2] &&
            value === board[y-3][x+3]) {
          return {
            gameOver: true,
            winner: game.players[value],
            reason: 'win'
          };
        }
      }
    }
    
    // Check for draw (board full)
    let isBoardFull = true;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (board[y][x] === null) {
          isBoardFull = false;
          break;
        }
      }
      if (!isBoardFull) break;
    }
    
    if (isBoardFull) {
      return {
        gameOver: true,
        winner: null,
        reason: 'draw'
      };
    }
    
    // Game is still ongoing
    return {
      gameOver: false
    };
  }

  createInitialBoard() {
    // Create an 8x8 empty board for the example game
    return Array(8).fill().map(() => Array(8).fill(null));
  }

  forfeitGame(gameId, playerId) {
    const game = this.games.get(gameId);
    
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    // Find the forfeiting player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error('Player not in this game');
    }
    
    // The other player wins
    const winnerIndex = (playerIndex + 1) % game.players.length;
    const winner = game.players[winnerIndex];
    
    // Update game status
    game.status = 'completed';
    game.winner = winner;
    game.endTime = Date.now();
    game.forfeitedBy = playerId;
    
    logger.info(`Game ${gameId} forfeited by player ${playerId}, winner: ${winner.id}`);
    
    // Calculate and update Elo ratings
    const ratings = this.updateEloRatings(game, true);
    
    return {
      winner,
      ratings
    };
  }

  handlePlayerDisconnect(userId) {
    // Find games where this player is participating
    this.games.forEach((game, gameId) => {
      if (game.status !== 'active') return;
      
      const playerIndex = game.players.findIndex(p => p.id === userId);
      if (playerIndex === -1) return;
      
      // Mark player as disconnected
      game.players[playerIndex].connected = false;
      
      // If all players are disconnected, end the game
      const allDisconnected = game.players.every(p => !p.connected);
      if (allDisconnected) {
        game.status = 'abandoned';
        logger.info(`Game ${gameId} abandoned as all players disconnected`);
      }
      
      // If it's the disconnected player's turn, start a grace period
      if (game.currentTurn.playerId === userId) {
        // Reduces turn time to 60 seconds if disconnected
        const newEndTime = Math.min(
          game.currentTurn.endTime,
          Date.now() + 60000
        );
        game.currentTurn.endTime = newEndTime;
        logger.info(`Player ${userId} disconnected during their turn, reducing turn time`);
      }
    });
  }

  checkTurnTimers() {
    const now = Date.now();
    const expiredTurns = [];
    
    this.games.forEach((game, gameId) => {
      if (game.status !== 'active') return;
      
      // Check if current turn has expired
      if (game.currentTurn.endTime <= now) {
        logger.info(`Turn expired for player ${game.currentTurn.playerId} in game ${gameId}`);
        
        // Advance to next player's turn
        this.advanceTurn(game);
        
        expiredTurns.push({
          gameId,
          nextTurn: game.currentTurn
        });
      }
    });
    
    return expiredTurns;
  }

  updateEloRatings(game, isForfeit = false) {
    if (game.players.length !== 2) {
      // Elo calculation is designed for 2 players
      return null;
    }
    
    // Get player ratings
    // This would normally come from the database, using placeholder values for now
    const playerRatings = {
      [game.players[0].id]: 1000,
      [game.players[1].id]: 1000
    };
    
    let result;
    if (game.winner === null) {
      // Draw
      result = 0.5;
    } else {
      const winnerIndex = game.players.findIndex(p => p.id === game.winner.id);
      result = winnerIndex === 0 ? 1 : 0;
    }
    
    // Apply forfeit adjustment if applicable
    const kFactor = isForfeit ? 16 : 32;
    
    // Calculate new ratings
    const player1 = game.players[0].id;
    const player2 = game.players[1].id;
    
    const { 
      newRating: newRating1, 
      ratingChange: change1 
    } = this.eloService.calculateNewRating(
      playerRatings[player1], 
      playerRatings[player2], 
      result, 
      kFactor
    );
    
    const { 
      newRating: newRating2, 
      ratingChange: change2 
    } = this.eloService.calculateNewRating(
      playerRatings[player2], 
      playerRatings[player1], 
      1 - result, 
      kFactor
    );
    
    // In a real implementation, save new ratings to the database
    const ratings = [
      {
        userId: player1,
        oldRating: playerRatings[player1],
        newRating: newRating1,
        change: change1
      },
      {
        userId: player2,
        oldRating: playerRatings[player2],
        newRating: newRating2,
        change: change2
      }
    ];
    
    logger.info(`Updated Elo ratings for game ${game.id}: ${JSON.stringify(ratings)}`);
    
    return ratings;
  }
}

module.exports = { GameManager };