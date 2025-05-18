#!/usr/bin/env node
const http = require('http');
const logger = require('./src/utils/logger');

/**
 * Simple healthcheck script
 * Used by Docker to determine container health
 */
const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Health check successful
  } else {
    logger.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1); // Health check failed
  }
});

request.on('error', (err) => {
  logger.error(`Health check failed: ${err.message}`);
  process.exit(1); // Health check failed
});

request.end();