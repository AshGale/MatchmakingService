const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validators } = require('../middleware/validation.middleware');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/error.middleware');

const router = express.Router();

/**
 * @api {post} /api/lobbies Create a new lobby
 * @apiName CreateLobby
 * @apiGroup Lobbies
 * @apiDescription Creates a new game lobby with specified maximum players
 *
 * @apiParam {Number} max_players Number of maximum players (2-4)
 *
 * @apiSuccess {String} lobby_id Unique identifier of the created lobby
 * @apiSuccess {String} status Current lobby status ('waiting')
 * @apiSuccess {Number} player_count Current number of players in the lobby (0)
 * @apiSuccess {Number} max_players Maximum number of players allowed
 *
 * @apiError {Object} error Error message and details
 */
router.post('/', validators.createLobby, (req, res, next) => {
  try {
    const { max_players } = req.body;

    // Generate a random UUID for lobby_id
    const lobby_id = uuidv4();

    // Return mock response
    res.status(201).json({
      lobby_id,
      status: 'waiting',
      player_count: 0,
      max_players
    });
  } catch (error) {
    next(error); // Forward to error handling middleware
  }
});

/**
 * @api {get} /api/lobbies Get all lobbies
 * @apiName GetLobbies
 * @apiGroup Lobbies
 * @apiDescription Retrieves a list of game lobbies, optionally filtered by status
 *
 * @apiParam {String} [status] Optional filter for lobby status ('waiting', 'active', 'finished')
 *
 * @apiSuccess {Array} lobbies Array of lobby objects
 * @apiSuccess {Number} total_count Total number of lobbies matching filter
 *
 * @apiError {Object} error Error message and details
 */
router.get('/', validators.getLobbies, (req, res, next) => {
  try {
    // Mock implementation returning sample lobby objects
    const mockLobbies = [
      {
        lobby_id: uuidv4(),
        status: 'waiting',
        player_count: 1,
        max_players: 4,
        created_at: new Date().toISOString()
      },
      {
        lobby_id: uuidv4(),
        status: 'waiting',
        player_count: 2,
        max_players: 2,
        created_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      }
    ];

    // Filter by status if provided
    const { status } = req.query;
    const filteredLobbies = status 
      ? mockLobbies.filter(lobby => lobby.status === status)
      : mockLobbies;

    res.json({
      lobbies: filteredLobbies,
      total_count: filteredLobbies.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @api {get} /api/lobbies/:id Get lobby details
 * @apiName GetLobbyDetails
 * @apiGroup Lobbies
 * @apiDescription Retrieves detailed information about a specific lobby
 *
 * @apiParam {String} id Lobby UUID
 *
 * @apiSuccess {Object} lobby Detailed lobby information
 * @apiSuccess {Array} players List of players in the lobby
 *
 * @apiError {Object} error Error message and details
 */
router.get('/:id', validators.getLobbyById, (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Mock implementation
    const lobby = {
      lobby_id: id,
      status: 'waiting',
      player_count: 2,
      max_players: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Mock player list
    const players = [
      {
        player_id: uuidv4(),
        session_id: 'session1',
        join_order: 1,
        joined_at: new Date(Date.now() - 120000).toISOString() // 2 minutes ago
      },
      {
        player_id: uuidv4(),
        session_id: 'session2',
        join_order: 2,
        joined_at: new Date().toISOString()
      }
    ];
    
    res.json({
      lobby,
      players
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @api {post} /api/lobbies/:id/join Join a lobby
 * @apiName JoinLobby
 * @apiGroup Lobbies
 * @apiDescription Adds a player to an existing lobby
 *
 * @apiParam {String} id Lobby UUID
 * @apiParam {String} session_id Player session identifier
 *
 * @apiSuccess {Boolean} success Whether the join operation was successful
 * @apiSuccess {String} player_id Unique identifier of the created player
 * @apiSuccess {Object} lobby Updated lobby information
 *
 * @apiError {Object} error Error message and details
 * @apiError (404) {Object} error Lobby not found error
 * @apiError (409) {Object} error Lobby full or player already exists error
 * @apiError (400) {Object} error Validation error (invalid session_id or lobby not in 'waiting' state)
 */
router.post('/:id/join', validators.joinLobby, (req, res, next) => {
  try {
    const { id } = req.params;
    const { session_id } = req.body;
    
    // Mock implementation
    // 1. Check if lobby exists (404 if not found)
    const mockLobby = {
      lobby_id: id,
      status: 'waiting',
      player_count: 2,
      max_players: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Simulate 30% chance lobby doesn't exist
    if (Math.random() < 0.3) {
      return next(new NotFoundError(`Lobby with id ${id} not found`));
    }
    
    // 2. Check if lobby is in 'waiting' status
    if (mockLobby.status !== 'waiting') {
      return next(new ValidationError(`Cannot join lobby in '${mockLobby.status}' status`));
    }
    
    // 3. Check if lobby is at capacity
    if (mockLobby.player_count >= mockLobby.max_players) {
      return next(new ConflictError('Lobby is at capacity'));
    }
    
    // 4. Check if session_id already exists in this lobby
    // Mock player list for demonstration
    const existingPlayers = [
      { player_id: uuidv4(), session_id: 'existing-session', join_order: 1 },
      { player_id: uuidv4(), session_id: 'another-session', join_order: 2 }
    ];
    
    // Check if session already exists
    const existingPlayer = existingPlayers.find(player => player.session_id === session_id);
    if (existingPlayer) {
      return next(new ConflictError('Player with this session already exists in lobby'));
    }
    
    // 5. Generate player ID and update lobby
    const player_id = uuidv4();
    mockLobby.player_count += 1;
    
    res.json({
      success: true,
      player_id,
      lobby: mockLobby
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @api {post} /api/quick-join Quick join a lobby
 * @apiName QuickJoin
 * @apiGroup Lobbies
 * @apiDescription Finds an available lobby or creates a new one
 *
 * @apiParam {String} session_id Player session identifier
 * @apiParam {Number} [preferred_players] Preferred number of players (2-4)
 *
 * @apiSuccess {String} lobby_id Unique identifier of the joined lobby
 * @apiSuccess {Boolean} created_new Whether a new lobby was created
 *
 * @apiError {Object} error Error message and details
 */
router.post('/quick-join', validators.quickJoin, (req, res, next) => {
  try {
    const { session_id, preferred_players = 4 } = req.body;
    
    // Mock implementation of matchmaking algorithm
    // Simulate checking for available lobbies
    const found = Math.random() > 0.5; // 50% chance of finding a lobby
    
    const lobby_id = uuidv4();
    const created_new = !found;
    
    res.json({
      lobby_id,
      created_new
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @api {put} /api/lobbies/:id/status Update lobby status
 * @apiName UpdateLobbyStatus
 * @apiGroup Lobbies
 * @apiDescription Updates the status of a lobby
 *
 * @apiParam {String} id Lobby UUID
 * @apiParam {String} status New lobby status ('waiting', 'active', 'finished')
 * @apiParam {String} [player_id] Player making the status change (required for some transitions)
 *
 * @apiSuccess {Boolean} success Whether the update was successful
 * @apiSuccess {Object} lobby Updated lobby information
 *
 * @apiError {Object} error Error message and details
 */
router.put('/:id/status', validators.updateLobbyStatus, (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, player_id } = req.body;
    
    // Mock implementation
    // Check valid status transitions
    const validTransitions = {
      'waiting': ['active'],
      'active': ['finished']
    };
    
    const mockLobby = {
      lobby_id: id,
      status: 'waiting', // Current status
      player_count: 2,
      max_players: 4,
      updated_at: new Date().toISOString()
    };
    
    // Check if transition is valid
    if (!validTransitions[mockLobby.status] || !validTransitions[mockLobby.status].includes(status)) {
      return next(new ValidationError(`Invalid status transition from ${mockLobby.status} to ${status}`));
    }
    
    // Update lobby status
    mockLobby.status = status;
    mockLobby.updated_at = new Date().toISOString();
    
    res.json({
      success: true,
      lobby: mockLobby
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
