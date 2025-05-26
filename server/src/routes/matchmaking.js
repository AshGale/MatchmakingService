// server/src/routes/matchmaking.js
import express from 'express';
import { configureWebSockets } from '../websockets.js';

const router = express.Router();

/**
 * @route GET /api/matchmaking/stats
 * @desc Get matchmaking queue statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const matchmakingHandler = configureWebSockets.matchmakingHandler;
    
    if (!matchmakingHandler) {
      return res.status(500).json({ 
        success: false, 
        error: 'Matchmaking service not initialized' 
      });
    }
    
    const stats = matchmakingHandler.matchmakingService.getQueueStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
