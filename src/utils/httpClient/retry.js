/**
 * HTTP Client Retry Logic
 * 
 * Implements retry mechanism with configurable policies:
 * - Maximum number of retry attempts
 * - Exponential backoff strategy
 * - Retry-eligible error conditions
 * - Circuit breaker pattern
 */

/**
 * Sets up retry logic for the HTTP client
 * 
 * @param {Object} instance - Axios instance
 * @param {Object} retryConfig - Retry configuration
 * @param {number} retryConfig.maxRetries - Maximum number of retry attempts
 * @param {number} retryConfig.initialDelayMs - Initial delay in milliseconds
 * @param {number} retryConfig.maxDelayMs - Maximum delay in milliseconds
 * @param {Function} retryConfig.retryCondition - Function to determine if retry should happen
 */
function setupRetryLogic(instance, retryConfig) {
  // Add a response interceptor for handling retries
  instance.interceptors.response.use(
    // Response success - just return the response
    (response) => response,
    
    // Response error - handle retry logic
    async (error) => {
      const { config } = error;
      
      // If config is undefined or retry is not enabled, reject immediately
      if (!config || !retryConfig) {
        return Promise.reject(error);
      }
      
      // Don't retry if method is not retryable (e.g., POST methods might not be idempotent)
      const nonRetryableMethods = config.nonRetryableMethods || ['POST', 'PATCH', 'PUT'];
      if (nonRetryableMethods.includes(config.method?.toUpperCase()) && config.forceRetry !== true) {
        return Promise.reject(error);
      }

      // Initialize retry count
      config.retryCount = config.retryCount || 0;
      
      // Check if we should retry based on retry condition and max retries
      const shouldRetry = (
        config.retryCount < retryConfig.maxRetries && 
        retryConfig.retryCondition(error)
      );
      
      if (!shouldRetry) {
        return Promise.reject(error);
      }
      
      // Increment retry count
      config.retryCount += 1;
      
      // Calculate delay using exponential backoff with jitter
      const delay = calculateRetryDelay(
        config.retryCount,
        retryConfig.initialDelayMs,
        retryConfig.maxDelayMs
      );
      
      // Log retry attempt
      if (process.env.NODE_ENV === 'development') {
        console.log(`Retrying request (${config.retryCount}/${retryConfig.maxRetries}) after ${delay}ms`);
      }
      
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request
      return instance(config);
    }
  );
}

/**
 * Calculates retry delay using exponential backoff with jitter
 * 
 * @param {number} retryCount - Current retry attempt
 * @param {number} initialDelayMs - Initial delay in milliseconds
 * @param {number} maxDelayMs - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(retryCount, initialDelayMs, maxDelayMs) {
  // Calculate exponential backoff
  const exponentialDelay = initialDelayMs * Math.pow(2, retryCount - 1);
  
  // Add jitter to avoid retry storms (random value between 0.7 and 1.3 of the delay)
  const jitter = 0.7 + Math.random() * 0.6; // Random value between 0.7 and 1.3
  
  // Calculate final delay with jitter
  const delayWithJitter = exponentialDelay * jitter;
  
  // Ensure delay is not greater than maximum
  return Math.min(delayWithJitter, maxDelayMs);
}

module.exports = {
  setupRetryLogic,
};
