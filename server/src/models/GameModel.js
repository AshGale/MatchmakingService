// server/src/models/GameModel.js
import BaseModel from './BaseModel.js';

class GameModel extends BaseModel {
  constructor() {
    super('games');
  }

  // Create a new game (called from LobbyModel.startGame)
  async createGame(lobby, trx = null) {
    const db = trx || this.db;
    
    try {
      // Create game record
      const game = await db(this.tableName)
        .insert({
          game_type: lobby.game_type,
          status: 'active',
          started_at: new Date(),
          updated_at: new Date(),
          settings: JSON.stringify({
            maxPlayers: lobby.max_players,
            customRules: lobby.custom_rules || {}
          })
        })
        .returning('*')
        .then(rows => rows[0]);

      // Add players to game
      const gamePlayers = lobby.players.map(player => ({
        game_id: game.id,
        player_id: player.id,
        initial_elo: player.elo_rating,
        joined_at: new Date()
      }));

      await db('game_players').insert(gamePlayers);
      
      // Initialize game state based on game type
      const initialState = this.generateInitialState(lobby.game_type, lobby.players);
      
      await db('game_states').insert({
        game_id: game.id,
        state: JSON.stringify(initialState),
        turn_number: 1,
        active_player_id: initialState.activePlayerId,
        created_at: new Date()
      });
      
      return game;
    } catch (error) {
      throw new Error(`Failed to create game: ${error.message}`);
    }
  }

  // Generate initial game state based on game type
  generateInitialState(gameType, players) {
    // Randomize first player
    const randomIndex = Math.floor(Math.random() * players.length);
    const firstPlayerId = players[randomIndex].id;
    
    // Default state structure
    const baseState = {
      activePlayerId: firstPlayerId,
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        ready: false
      })),
      winner: null,
      turnTimeLimit: 60, // seconds
      turnStartedAt: new Date().toISOString()
    };
    
    // Extend with game-specific state
    switch(gameType) {
      case 'chess':
        return {
          ...baseState,
          board: this.generateChessBoard(),
          capturedPieces: { white: [], black: [] },
          moveHistory: []
        };
      case 'checkers':
        return {
          ...baseState,
          board: this.generateCheckersBoard(),
          capturedPieces: { red: [], black: [] },
          moveHistory: []
        };
      default: // generic game state
        return {
          ...baseState,
          genericState: {
            round: 1,
            scores: players.reduce((acc, p) => {
              acc[p.id] = 0;
              return acc;
            }, {})
          }
        };
    }
  }

  // Helper methods to generate initial board states
  generateChessBoard() {
    // Return standard chess starting position
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  
  generateCheckersBoard() {
    // Basic 8x8 checkers board
    return [
      [0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [2, 0, 2, 0, 2, 0, 2, 0],
      [0, 2, 0, 2, 0, 2, 0, 2],
      [2, 0, 2, 0, 2, 0, 2, 0]
    ];
  }

  // Get game with players and current state
  async getGame(gameId) {
    try {
      // Get game record
      const game = await this.findById(gameId);
      
      if (!game) {
        return null;
      }
      
      // Get players in game
      const players = await this.db('game_players')
        .select([
          'game_players.*',
          'users.username',
          'users.elo_rating'
        ])
        .join('users', 'game_players.player_id', 'users.id')
        .where('game_players.game_id', gameId);
      
      // Get current game state
      const state = await this.db('game_states')
        .where('game_id', gameId)
        .orderBy('turn_number', 'desc')
        .first();
        
      return {
        ...game,
        players,
        currentState: state ? {
          ...state,
          state: JSON.parse(state.state)
        } : null
      };
    } catch (error) {
      throw new Error(`Failed to get game: ${error.message}`);
    }
  }

  // Get active games for a player
  async getPlayerActiveGames(playerId) {
    try {
      const games = await this.db('games')
        .select('games.*')
        .join('game_players', 'games.id', 'game_players.game_id')
        .where('game_players.player_id', playerId)
        .andWhere('games.status', 'active');
        
      return games;
    } catch (error) {
      throw new Error(`Failed to get player's active games: ${error.message}`);
    }
  }

  // Get player's game history
  async getPlayerGameHistory(playerId, limit = 10, offset = 0) {
    try {
      const games = await this.db('games')
        .select([
          'games.*',
          'game_players.final_elo',
          'game_players.initial_elo',
          this.db.raw('(game_players.final_elo - game_players.initial_elo) as elo_change')
        ])
        .join('game_players', 'games.id', 'game_players.game_id')
        .where('game_players.player_id', playerId)
        .andWhere('games.status', 'completed')
        .orderBy('games.ended_at', 'desc')
        .limit(limit)
        .offset(offset);
        
      return games;
    } catch (error) {
      throw new Error(`Failed to get player's game history: ${error.message}`);
    }
  }

  // Process game move
  async processMove(gameId, playerId, moveData) {
    try {
      // Get current game state
      const game = await this.getGame(gameId);
      
      if (!game) {
        return { success: false, message: 'Game not found' };
      }
      
      if (game.status !== 'active') {
        return { success: false, message: 'Game is not active' };
      }
      
      const { currentState } = game;
      
      if (!currentState) {
        return { success: false, message: 'Game state not found' };
      }
      
      // Check if it's player's turn
      if (currentState.active_player_id !== playerId) {
        return { success: false, message: 'Not your turn' };
      }
      
      // Parse current state
      const state = currentState.state;
      
      // Process move based on game type (would be more complex in real implementation)
      // Here's a simplified version
      const { nextState, nextActivePlayerId, isGameOver, winner } = this.calculateNextState(
        game.game_type,
        state,
        playerId,
        moveData
      );
      
      // Start transaction
      const trx = await this.db.transaction();
      
      try {
        // Save new game state
        await trx('game_states').insert({
          game_id: gameId,
          state: JSON.stringify(nextState),
          turn_number: currentState.turn_number + 1,
          active_player_id: nextActivePlayerId,
          move_data: JSON.stringify(moveData),
          created_at: new Date()
        });
        
        // Update game status if game is over
        if (isGameOver) {
          await trx(this.tableName)
            .where('id', gameId)
            .update({
              status: 'completed',
              winner_id: winner,
              ended_at: new Date(),
              updated_at: new Date()
            });
            
          // Update player ELO ratings
          if (winner) {
            await this.updatePlayerElos(gameId, winner, trx);
          }
        } else {
          // Just update the game timestamp
          await trx(this.tableName)
            .where('id', gameId)
            .update({
              updated_at: new Date()
            });
        }
        
        // Commit transaction
        await trx.commit();
        
        return { 
          success: true, 
          isGameOver,
          winner,
          nextState
        };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to process move: ${error.message}`);
    }
  }

  // Calculate next state based on game type and move
  calculateNextState(gameType, currentState, playerId, moveData) {
    // This would be a complex function that validates moves and calculates the next state
    // This is a simplified placeholder
    
    // Find player index
    const playerIndex = currentState.players.findIndex(p => p.id === playerId);
    
    // Get next player (simple round-robin)
    const nextPlayerIndex = (playerIndex + 1) % currentState.players.length;
    const nextPlayerId = currentState.players[nextPlayerIndex].id;
    
    // Create a copy of the state to modify
    const nextState = JSON.parse(JSON.stringify(currentState));
    
    // Set the active player
    nextState.activePlayerId = nextPlayerId;
    nextState.turnStartedAt = new Date().toISOString();
    
    // Apply move (this would be game-specific logic)
    // This is just a placeholder
    if (gameType === 'chess') {
      // Add move to history
      nextState.moveHistory.push(moveData.move);
      
      // Update board (in a real implementation, this would apply the chess move)
      nextState.board = moveData.resultingBoard;
      
      // Update captured pieces if any
      if (moveData.capturedPiece) {
        const captureColor = playerIndex === 0 ? 'white' : 'black';
        nextState.capturedPieces[captureColor].push(moveData.capturedPiece);
      }
      
      // Check if game is over
      const isGameOver = moveData.isCheckmate || moveData.isDraw;
      const winner = moveData.isCheckmate ? playerId : null;
      
      return { nextState, nextActivePlayerId: nextPlayerId, isGameOver, winner };
    } else {
      // Generic game update
      nextState.genericState.round++;
      
      // Update scores
      if (moveData.points) {
        nextState.genericState.scores[playerId] += moveData.points;
      }
      
      // Check if game is over (e.g., reaching target score)
      const targetScore = 100; // Example
      const isGameOver = Object.values(nextState.genericState.scores).some(score => score >= targetScore);
      let winner = null;
      
      if (isGameOver) {
        // Find player with highest score
        let highestScore = -1;
        
        Object.entries(nextState.genericState.scores).forEach(([pid, score]) => {
          if (score > highestScore) {
            highestScore = score;
            winner = pid;
          }
        });
      }
      
      return { nextState, nextActivePlayerId: nextPlayerId, isGameOver, winner };
    }
  }

  // Update ELO ratings after game completion
  async updatePlayerElos(gameId, winnerId, trx = null) {
    const db = trx || this.db;
    
    try {
      // Get all players in the game
      const players = await db('game_players')
        .select(['player_id', 'initial_elo'])
        .where('game_id', gameId);
      
      // Find winner and loser(s)
      const winner = players.find(p => p.player_id === winnerId);
      const losers = players.filter(p => p.player_id !== winnerId);
      
      if (!winner || losers.length === 0) {
        return;
      }
      
      // Calculate ELO changes (simplified version)
      // In a real implementation, this would be more sophisticated
      const kFactor = 32;
      
      // For each matchup between winner and a loser
      for (const loser of losers) {
        // Calculate expected score using ELO formula
        const winnerExpected = 1 / (1 + Math.pow(10, (loser.initial_elo - winner.initial_elo) / 400));
        const loserExpected = 1 - winnerExpected;
        
        // Calculate new ratings
        const winnerNewElo = Math.round(winner.initial_elo + kFactor * (1 - winnerExpected));
        const loserNewElo = Math.round(loser.initial_elo + kFactor * (0 - loserExpected));
        
        // Update game_players table
        await db('game_players')
          .where({
            game_id: gameId,
            player_id: winner.player_id
          })
          .update({
            final_elo: winnerNewElo
          });
          
        await db('game_players')
          .where({
            game_id: gameId,
            player_id: loser.player_id
          })
          .update({
            final_elo: loserNewElo
          });
          
        // Update users table
        await db('users')
          .where('id', winner.player_id)
          .update({
            elo_rating: winnerNewElo,
            updated_at: new Date()
          });
          
        await db('users')
          .where('id', loser.player_id)
          .update({
            elo_rating: loserNewElo,
            updated_at: new Date()
          });
      }
    } catch (error) {
      throw new Error(`Failed to update ELO ratings: ${error.message}`);
    }
  }

  // Forfeit game
  async forfeitGame(gameId, playerId) {
    try {
      // Check if game exists and is active
      const game = await this.findById(gameId);
      
      if (!game) {
        return { success: false, message: 'Game not found' };
      }
      
      if (game.status !== 'active') {
        return { success: false, message: 'Game is not active' };
      }
      
      // Check if player is in the game
      const playerInGame = await this.db('game_players')
        .where({
          game_id: gameId,
          player_id: playerId
        })
        .first();
        
      if (!playerInGame) {
        return { success: false, message: 'Player not in game' };
      }
      
      // Get other players
      const otherPlayers = await this.db('game_players')
        .where('game_id', gameId)
        .whereNot('player_id', playerId)
        .select('player_id');
        
      // If there's only one other player, they're the winner
      let winnerId = null;
      if (otherPlayers.length === 1) {
        winnerId = otherPlayers[0].player_id;
      }
      
      // Start transaction
      const trx = await this.db.transaction();
      
      try {
        // Update game status
        await trx(this.tableName)
          .where('id', gameId)
          .update({
            status: 'completed',
            winner_id: winnerId,
            ended_at: new Date(),
            updated_at: new Date(),
            result_message: `Player ${playerId} forfeited`
          });
          
        // Update ELO ratings if there's a clear winner
        if (winnerId) {
          await this.updatePlayerElos(gameId, winnerId, trx);
        }
        
        // Commit transaction
        await trx.commit();
        
        return { success: true, message: 'Game forfeited', winnerId };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to forfeit game: ${error.message}`);
    }
  }
}

export default new GameModel();
