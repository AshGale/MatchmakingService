/**
 * HTTP Client Implementation
 * 
 * Configurable HTTP client with:
 * - Base configuration (URLs, headers, timeout)
 * - Request/response interceptors
 * - Timeout handling
 * - Retry logic with exponential backoff
 */

const axios = require('axios');
const { setupInterceptors } = require('./interceptors');
const { setupRetryLogic } = require('./retry');

/**
 * Default HTTP client configuration
 */
const DEFAULT_CONFIG = {
  // Base configuration
  baseURL: process.env.API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 5000, // 5 seconds default timeout
  
  // Retry configuration
  retry: {
    maxRetries: 3,
    initialDelayMs: 300,
    maxDelayMs: 5000,
    retryCondition: (error) => {
      return (
        (!error.response && error.code !== 'ECONNABORTED') || // Network errors
        (error.response && error.response.status >= 500) || // Server errors
        error.code === 'ETIMEDOUT' // Timeout errors
      );
    },
  }
};

/**
 * Create a configured HTTP client instance
 * 
 * @param {Object} options - Configuration options to override defaults
 * @param {string} options.baseURL - Base URL for the API
 * @param {Object} options.headers - Default headers
 * @param {number} options.timeout - Default timeout in milliseconds
 * @param {Object} options.retry - Retry configuration
 * @param {number} options.retry.maxRetries - Maximum number of retry attempts
 * @param {number} options.retry.initialDelayMs - Initial delay in milliseconds
 * @param {number} options.retry.maxDelayMs - Maximum delay in milliseconds
 * @param {Function} options.retry.retryCondition - Function to determine if retry should happen
 * @returns {Object} Configured axios instance
 */
function createHttpClient(options = {}) {
  // Merge options with defaults
  const config = {
    ...DEFAULT_CONFIG,
    ...options,
    headers: {
      ...DEFAULT_CONFIG.headers,
      ...(options.headers || {}),
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...(options.retry || {}),
    },
  };

  // Create axios instance
  const instance = axios.create({
    baseURL: config.baseURL,
    headers: config.headers,
    timeout: config.timeout,
  });

  // Setup request/response interceptors
  setupInterceptors(instance, config);

  // Setup retry logic
  setupRetryLogic(instance, config.retry);

  return instance;
}

module.exports = {
  createHttpClient,
  DEFAULT_CONFIG,
};
