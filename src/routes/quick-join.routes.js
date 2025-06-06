const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validators } = require('../middleware/validation.middleware');
const { ValidationError } = require('../middleware/error.middleware');

const router = express.Router();

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
router.post('/', validators.quickJoin, (req, res, next) => {
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

module.exports = router;
