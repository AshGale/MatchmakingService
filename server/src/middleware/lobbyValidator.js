// server/src/middleware/lobbyValidator.js
import { param, body, query, validationResult } from 'express-validator';
import logger from '../utils/logger.js';

// Validation rules for different lobby endpoints
export const lobbyValidators = {
  // GET /api/lobbies
  getLobbies: [
    query('includePrivate').optional().isBoolean().withMessage('includePrivate must be a boolean'),
    query('gameType').optional().isString().withMessage('gameType must be a string'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer')
  ],
  
  // POST /api/lobbies
  createLobby: [
    body('name')
      .isLength({ min: 3, max: 50 })
      .withMessage('Lobby name must be between 3 and 50 characters')
      .trim(),
    body('gameType')
      .optional()
      .isString()
      .withMessage('Game type must be a string')
      .trim(),
    body('maxPlayers')
      .optional()
      .isInt({ min: 2, max: 10 })
      .withMessage('Max players must be between 2 and 10'),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean'),
    body('password')
      .optional()
      .isString()
      .isLength({ min: 3, max: 20 })
      .withMessage('Password must be between 3 and 20 characters')
  ],
  
  // GET /api/lobbies/:id
  getLobby: [
    param('id').isUUID().withMessage('Invalid lobby ID')
  ],
  
  // POST /api/lobbies/:id/join
  joinLobby: [
    param('id').isUUID().withMessage('Invalid lobby ID'),
    body('password').optional().isString().withMessage('Password must be a string')
  ],
  
  // DELETE /api/lobbies/:id/leave
  leaveLobby: [
    param('id').isUUID().withMessage('Invalid lobby ID')
  ],
  
  // POST /api/lobbies/:id/start
  startGame: [
    param('id').isUUID().withMessage('Invalid lobby ID')
  ],
  
  // POST /api/lobbies/:id/ready
  setReady: [
    param('id').isUUID().withMessage('Invalid lobby ID'),
    body('isReady').isBoolean().withMessage('isReady must be a boolean')
  ],
  
  // POST /api/lobbies/:id/invite
  invitePlayer: [
    param('id').isUUID().withMessage('Invalid lobby ID'),
    body('userId').isUUID().withMessage('Invalid user ID')
  ]
};

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation error', { 
      endpoint: `${req.method} ${req.originalUrl}`, 
      errors: errors.array(),
      userId: req.user?.id
    });
    return res.status(400).json({ errors: errors.array() });
  }
  
  next();
};

export default { lobbyValidators, handleValidationErrors };
