/**
 * HTTP Client Module
 * 
 * Exports a configurable HTTP client with interceptors, timeout handling, and retry logic.
 * Uses Axios as the underlying HTTP client implementation.
 */

const { createHttpClient } = require('./client');

module.exports = {
  createHttpClient,
};
