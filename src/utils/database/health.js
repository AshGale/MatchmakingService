/**
 * Database Health Check Mechanisms
 * 
 * Implements health check functionality for monitoring database
 * connection health and pool metrics.
 */

const { pool, getConnection } = require('./pool');
const { withRetry } = require('./errors');

/**
 * Database health check result
 * @typedef {Object} HealthCheckResult
 * @property {boolean} isHealthy - Whether the database connection is healthy
 * @property {Object} metrics - Connection pool metrics
 * @property {number} responseTime - Response time in milliseconds
 * @property {string|null} error - Error message if health check failed
 */

/**
 * Get current pool metrics
 * 
 * @returns {Object} Pool metrics
 */
function getPoolMetrics() {
  // Get metrics from the pg-pool instance
  const metrics = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };

  // Add derived metrics
  metrics.activeCount = metrics.totalCount - metrics.idleCount;
  metrics.utilizationPercentage = metrics.totalCount > 0 
    ? Math.round((metrics.activeCount / metrics.totalCount) * 100) 
    : 0;

  return metrics;
}

/**
 * Check if the database connection is healthy
 * 
 * @param {Object} options - Health check options
 * @param {boolean} options.deep - Whether to perform a deep check with query execution
 * @returns {Promise<HealthCheckResult>} Health check result
 */
async function checkDatabaseHealth(options = {}) {
  const { deep = false } = options;
  const startTime = Date.now();
  
  const result = {
    isHealthy: false,
    metrics: getPoolMetrics(),
    responseTime: 0,
    error: null
  };

  try {
    // Try to execute a simple query to verify connection
    await withRetry(async () => {
      const client = await getConnection();
      
      try {
        if (deep) {
          // Deep health check - run a more intensive query
          await client.query('SELECT version(), current_timestamp, pg_is_in_recovery()');
        } else {
          // Simple ping - minimal overhead
          await client.query('SELECT 1');
        }
        
        result.isHealthy = true;
      } finally {
        client.release();
      }
    }, {
      maxRetries: 1,
      initialDelayMs: 50,
      maxDelayMs: 500
    });
  } catch (error) {
    result.error = error.message;
    console.error('[DB Health] Database health check failed:', error);
  }
  
  // Calculate response time
  result.responseTime = Date.now() - startTime;
  
  return result;
}

/**
 * Periodic health check monitor
 * Runs health checks at regular intervals and logs issues
 * 
 * @param {Object} options - Monitor options
 * @param {number} options.intervalMs - Check interval in milliseconds (default: 30000)
 * @param {boolean} options.deep - Whether to do deep health checks (default: false)
 * @param {Function} options.onUnhealthy - Callback when unhealthy state is detected
 * @returns {Object} Monitor control object with start/stop methods
 */
function createHealthMonitor(options = {}) {
  const {
    intervalMs = 30000,
    deep = false,
    onUnhealthy = null
  } = options;
  
  let intervalId = null;
  let lastHealthy = true;
  
  async function checkHealth() {
    try {
      const health = await checkDatabaseHealth({ deep });
      
      // Log health status changes
      if (health.isHealthy !== lastHealthy) {
        if (health.isHealthy) {
          console.log('[DB Health] Database connection restored');
        } else {
          console.error('[DB Health] Database connection unhealthy:', health.error);
          
          // Call onUnhealthy callback if provided
          if (typeof onUnhealthy === 'function') {
            onUnhealthy(health);
          }
        }
      }
      
      lastHealthy = health.isHealthy;
      
      // Log concerning metrics even if healthy
      const { metrics } = health;
      if (metrics.waitingCount > 5) {
        console.warn(`[DB Health] High waiting connection count: ${metrics.waitingCount}`);
      }
      if (metrics.utilizationPercentage > 80) {
        console.warn(`[DB Health] High pool utilization: ${metrics.utilizationPercentage}%`);
      }
      
      return health;
    } catch (error) {
      console.error('[DB Health] Error during health check:', error);
      return {
        isHealthy: false,
        metrics: getPoolMetrics(),
        responseTime: -1,
        error: error.message
      };
    }
  }
  
  return {
    /**
     * Start the health monitoring
     */
    start() {
      if (intervalId) return;
      
      // Run initial check
      checkHealth();
      
      // Set up interval
      intervalId = setInterval(checkHealth, intervalMs);
      console.log(`[DB Health] Started database health monitoring (interval: ${intervalMs}ms)`);
    },
    
    /**
     * Stop the health monitoring
     */
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[DB Health] Stopped database health monitoring');
      }
    },
    
    /**
     * Run a single health check
     */
    check: checkHealth
  };
}

module.exports = {
  checkDatabaseHealth,
  createHealthMonitor,
  getPoolMetrics
};
