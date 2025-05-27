// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\game-state\game-state.test.js
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { GameManager } from '../../src/services/gameManager.js';
import GameService from '../../src/services/gameService.js';
import EloService from '../../src/services/eloService.js';
import db from '../../src/db.js';

describe('Game State Management', () => {
  let gameManager;
  let gameService;
  let sandbox;
  let dbStub;
  let clock;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
    
    // Setup database stub
    dbStub = sandbox.stub();
    dbStub.returns({
      where: sandbox.stub().returnsThis(),
      join: sandbox.stub().returnsThis(),
      leftJoin: sandbox.stub().returnsThis(),
      select: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves({ id: 'game-1' }),
      insert: sandbox.stub().resolves([1]),
      update: sandbox.stub().resolves(1),
      whereIn: sandbox.stub().returnsThis(),
      orderBy: sandbox.stub().returnsThis(),
    });
    
    // Replace actual db with stub
    sandbox.stub(db, 'default').returns(dbStub);
    
    gameManager = new GameManager();
    gameService = new GameService();
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('1. Game State Initialization', () => {
    it('should create a new game with correct initial state', () => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      const game = gameManager.createGame(players);
      
      expect(game).to.have.property('id').that.is.a('string');
      expect(game).to.have.property('players').that.is.an('array').with.lengthOf(2);
      expect(game).to.have.property('state').that.is.an('object');
      expect(game).to.have.property('currentTurn').that.is.an('object');
      expect(game.status).to.equal('active');
      
      // Verify board is initialized correctly
      expect(game.state.board).to.be.an('array');
      expect(game.state.moveHistory).to.be.an('array').that.is.empty;
      
      // Verify current turn is set correctly
      expect(game.currentTurn).to.have.property('playerId').that.is.oneOf(['player1', 'player2']);
      expect(game.currentTurn).to.have.property('startTime').that.is.a('number');
      expect(game.currentTurn).to.have.property('endTime').that.is.a('number');
    });
  });
  
  describe('2. Turn Management', () => {
    let game;
    
    beforeEach(() => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      game = gameManager.createGame(players);
      // Force first player to be player1 for testing
      game.currentTurn.playerId = 'player1';
      game.currentTurn.playerIndex = 0;
    });
    
    it('should reject moves made out of turn', () => {
      expect(() => gameManager.processMove(game.id, 'player2', { type: 'place', position: { x: 0, y: 0 } }))
        .to.throw('Not your turn');
    });
    
    it('should advance turn to next player after a valid move', () => {
      // Stub validateMove and applyMove to avoid implementation details
      sandbox.stub(gameManager, 'validateMove').returns(true);
      sandbox.stub(gameManager, 'applyMove').returns(true);
      sandbox.stub(gameManager, 'checkGameOver').returns({ gameOver: false });
      
      const result = gameManager.processMove(game.id, 'player1', { type: 'place', position: { x: 0, y: 0 } });
      
      expect(result.currentTurn.playerId).to.equal('player2');
      expect(result.currentTurn.playerIndex).to.equal(1);
    });
  });
  
  describe('3. Move Processing and State Updates', () => {
    let game;
    
    beforeEach(() => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      game = gameManager.createGame(players);
      // Force first player to be player1 for testing
      game.currentTurn.playerId = 'player1';
      game.currentTurn.playerIndex = 0;
    });
    
    it('should validate moves before applying them', () => {
      const validateMoveSpy = sandbox.spy(gameManager, 'validateMove');
      
      // Stub other methods to focus on validation
      sandbox.stub(gameManager, 'applyMove').returns(true);
      sandbox.stub(gameManager, 'checkGameOver').returns({ gameOver: false });
      
      gameManager.processMove(game.id, 'player1', { type: 'place', position: { x: 0, y: 0 } });
      
      expect(validateMoveSpy.calledOnce).to.be.true;
    });
    
    it('should apply valid moves to the game state', () => {
      const applyMoveSpy = sandbox.spy(gameManager, 'applyMove');
      
      // Stub other methods to focus on applying move
      sandbox.stub(gameManager, 'validateMove').returns(true);
      sandbox.stub(gameManager, 'checkGameOver').returns({ gameOver: false });
      
      const move = { type: 'place', position: { x: 0, y: 0 } };
      gameManager.processMove(game.id, 'player1', move);
      
      expect(applyMoveSpy.calledOnce).to.be.true;
      expect(applyMoveSpy.calledWith(game, 'player1', move)).to.be.true;
    });
    
    it('should persist move to database', async () => {
      // Stub database-related methods
      sandbox.stub(gameService, 'saveMoveToDatabase').resolves({ id: 'move-1' });
      
      await gameService.processMove('game-1', 'player1', { type: 'place', position: { x: 0, y: 0 } });
      
      expect(gameService.saveMoveToDatabase.calledOnce).to.be.true;
    });
  });
  
  describe('4. Turn Timeout Handling', () => {
    let game;
    
    beforeEach(() => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      game = gameManager.createGame(players);
      gameManager.games.set(game.id, game);
      
      // Force first player to be player1 for testing
      game.currentTurn.playerId = 'player1';
      game.currentTurn.playerIndex = 0;
      
      // Set a short turn time for testing
      game.currentTurn.endTime = Date.now() + 1000; // 1 second
    });
    
    it('should detect expired turns', () => {
      // Advance clock past turn end time
      clock.tick(1500);
      
      const expiredTurns = gameManager.checkTurnTimers();
      
      expect(expiredTurns).to.be.an('array').with.lengthOf(1);
      expect(expiredTurns[0].gameId).to.equal(game.id);
      expect(expiredTurns[0].nextTurn.playerId).to.equal('player2');
    });
    
    it('should advance turn when timeout occurs', () => {
      // Advance clock past turn end time
      clock.tick(1500);
      
      gameManager.checkTurnTimers();
      
      const updatedGame = gameManager.getGame(game.id);
      expect(updatedGame.currentTurn.playerId).to.equal('player2');
      expect(updatedGame.currentTurn.playerIndex).to.equal(1);
    });
  });
  
  describe('5. Game Completion Logic', () => {
    let game;
    
    beforeEach(() => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      game = gameManager.createGame(players);
      gameManager.games.set(game.id, game);
    });
    
    it('should detect when a game is over', () => {
      // Set up game state that would trigger a win condition
      // This is just an example and depends on game rules
      game.state.board = [
        ['X', 'X', 'X'],
        [null, null, null],
        [null, null, null]
      ];
      
      // Mock the win detection logic
      sandbox.stub(gameManager, 'checkGameOver').returns({
        gameOver: true,
        winner: { id: 'player1', username: 'Player 1' },
        reason: 'Three in a row'
      });
      
      // Stub other methods
      sandbox.stub(gameManager, 'validateMove').returns(true);
      sandbox.stub(gameManager, 'applyMove').returns(true);
      sandbox.stub(gameManager, 'updateEloRatings').returns([]);
      
      const result = gameManager.processMove(game.id, 'player1', { type: 'place', position: { x: 0, y: 0 } });
      
      expect(result.gameOver).to.be.true;
      expect(result.winner.id).to.equal('player1');
    });
    
    it('should mark game as completed when it ends', () => {
      // Set up game state that would trigger a win condition
      game.state.board = [
        ['X', 'X', 'X'],
        [null, null, null],
        [null, null, null]
      ];
      
      // Mock the win detection logic
      sandbox.stub(gameManager, 'checkGameOver').returns({
        gameOver: true,
        winner: { id: 'player1', username: 'Player 1' },
        reason: 'Three in a row'
      });
      
      // Stub other methods
      sandbox.stub(gameManager, 'validateMove').returns(true);
      sandbox.stub(gameManager, 'applyMove').returns(true);
      sandbox.stub(gameManager, 'updateEloRatings').returns([]);
      
      gameManager.processMove(game.id, 'player1', { type: 'place', position: { x: 0, y: 0 } });
      
      const updatedGame = gameManager.getGame(game.id);
      expect(updatedGame.status).to.equal('completed');
      expect(updatedGame.winner.id).to.equal('player1');
      expect(updatedGame).to.have.property('endTime');
    });
  });
  
  describe('6. Integration with Elo Rating Updates', () => {
    let game;
    
    beforeEach(() => {
      const players = [
        { id: 'player1', username: 'Player 1' },
        { id: 'player2', username: 'Player 2' }
      ];
      
      game = gameManager.createGame(players);
      gameManager.games.set(game.id, game);
      
      // Mock Elo service
      sandbox.stub(EloService.prototype, 'calculateNewRating').callsFake((oldRating, opponentRating, score) => {
        return {
          newRating: oldRating + (score === 1 ? 10 : -10),
          ratingChange: score === 1 ? 10 : -10
        };
      });
    });
    
    it('should update Elo ratings when game completes', () => {
      // Set up game state for win
      game.status = 'completed';
      game.winner = { id: 'player1', username: 'Player 1' };
      
      const ratings = gameManager.updateEloRatings(game);
      
      expect(ratings).to.be.an('array').with.lengthOf(2);
      expect(ratings[0].userId).to.equal('player1');
      expect(ratings[0].change).to.be.greaterThan(0);
      expect(ratings[1].userId).to.equal('player2');
      expect(ratings[1].change).to.be.lessThan(0);
    });
    
    it('should persist rating changes to database when game completes', async () => {
      // Stub the database methods
      const dbInsertStub = sandbox.stub().resolves([1]);
      const dbUpdateStub = sandbox.stub().resolves(1);
      
      dbStub.insert = dbInsertStub;
      dbStub.update = dbUpdateStub;
      
      await gameService.saveGameCompletion('game-1', {
        winner: { id: 'player1' },
        reason: 'Three in a row'
      });
      
      // Check that ratings were saved to database
      expect(dbInsertStub.calledWith(sinon.match.has('rating_history'))).to.be.true;
      expect(dbUpdateStub.calledWith(sinon.match.has('users'))).to.be.true;
    });
  });
});
