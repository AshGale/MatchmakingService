const express = require('express');
const { validators } = require('../middleware/validation.middleware');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/error.middleware');
const LobbyManager = require('../business/lobby-manager');

const router = express.Router();
const lobbyManager = new LobbyManager();

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
router.post('/', validators.createLobby, async (req, res, next) => {
  try {
    const { playerId, settings } = req.body;
    
    // Create lobby using LobbyManager
    const lobby = await lobbyManager.createLobby(playerId, settings);
    
    res.status(201).json(lobby);
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
router.get('/', validators.getLobbies, async (req, res, next) => {
  try {
    const { status } = req.query;
    
    // Get lobbies from the database through LobbyManager
    const lobbies = await lobbyManager.getLobbiesByStatus(status);
    
    res.json({
      lobbies,
      total_count: lobbies.length
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
router.get('/:id', validators.getLobbyById, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get lobby details from the database
    const lobby = await lobbyManager.getLobbyInfo(id);
    
    if (!lobby) {
      throw new NotFoundError(`Lobby with ID ${id} not found`);
    }
    
    res.json(lobby);
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
router.post('/:id/join', validators.joinLobby, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { session_id } = req.body;
    
    // Add player to lobby using LobbyManager
    const updatedLobby = await lobbyManager.joinLobby(session_id, id);
    
    res.json(updatedLobby);
    
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
router.put('/:id/status', validators.updateLobbyStatus, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Update lobby status using LobbyManager
    const updatedLobby = await lobbyManager.updateLobbyStatus(id, status);
    
    res.json(updatedLobby);
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
