// server/src/services/monitoring.js
import { logger } from './logging.js';
import os from 'os';
import cluster from 'cluster';

// Store metrics in memory (for a real app, use a time series database)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byEndpoint: {}
  },
  responseTime: {
    average: 0,
    samples: []
  },
  security: {
    authFailures: 0,
    rateLimitExceeded: 0,
    suspiciousActivities: 0
  },
  system: {
    lastMemoryUsage: 0,
    lastCpuUsage: 0,
    lastHeapUsage: 0
  }
};

// Alert thresholds
const alertThresholds = {
  errorRate: 0.05, // 5% of requests
  responseTime: 500, // ms
  authFailures: 5, // per 15 minutes
  memoryUsage: 0.85, // 85% of available memory
  heapUsage: 0.7 // 70% of available heap
};

// Alert channels (mock implementation)
const alertChannels = {
  log: (message, level = 'error') => {
    logger[level]({
      message: `ALERT: ${message}`,
      alert: true,
      timestamp: new Date().toISOString()
    });
  },
  // In a real app, implement email, SMS, Slack, etc.
};

/**
 * Record a request for monitoring
 */
export const recordRequest = (method, endpoint, statusCode, duration) => {
  metrics.requests.total++;
  
  // Track by endpoint
  if (!metrics.requests.byEndpoint[endpoint]) {
    metrics.requests.byEndpoint[endpoint] = {
      total: 0,
      success: 0,
      error: 0,
      avgResponseTime: 0
    };
  }
  
  metrics.requests.byEndpoint[endpoint].total++;
  
  // Track success vs error
  if (statusCode < 400) {
    metrics.requests.success++;
    metrics.requests.byEndpoint[endpoint].success++;
  } else {
    metrics.requests.error++;
    metrics.requests.byEndpoint[endpoint].error++;
    
    // Check error threshold
    const errorRate = metrics.requests.error / metrics.requests.total;
    if (errorRate > alertThresholds.errorRate) {
      alertChannels.log(`High error rate detected: ${(errorRate * 100).toFixed(1)}%`);
    }
  }
  
  // Track response time
  metrics.responseTime.samples.push(duration);
  // Keep sample size reasonable
  if (metrics.responseTime.samples.length > 100) {
    metrics.responseTime.samples.shift();
  }
  
  // Calculate average
  const sum = metrics.responseTime.samples.reduce((acc, val) => acc + val, 0);
  metrics.responseTime.average = sum / metrics.responseTime.samples.length;
  
  // Update endpoint average response time
  const endpointMetrics = metrics.requests.byEndpoint[endpoint];
  endpointMetrics.avgResponseTime = 
    (endpointMetrics.avgResponseTime * (endpointMetrics.total - 1) + duration) / 
    endpointMetrics.total;
  
  // Check response time threshold
  if (endpointMetrics.avgResponseTime > alertThresholds.responseTime) {
    alertChannels.log(
      `Slow response time for ${endpoint}: ${endpointMetrics.avgResponseTime.toFixed(1)}ms`,
      'warn'
    );
  }
};

/**
 * Record security events for monitoring
 */
export const recordSecurityEvent = (eventType) => {
  switch (eventType) {
    case 'authentication_failed':
      metrics.security.authFailures++;
      if (metrics.security.authFailures >= alertThresholds.authFailures) {
        alertChannels.log(`High number of authentication failures detected: ${metrics.security.authFailures}`);
      }
      break;
      
    case 'rate_limit_exceeded':
    case 'api_rate_limit_exceeded':
      metrics.security.rateLimitExceeded++;
      break;
      
    case 'sensitive_operation':
    case 'permission_change_attempt':
      metrics.security.suspiciousActivities++;
      break;
  }
};

/**
 * Collect system metrics
 */
export const collectSystemMetrics = () => {
  // Memory usage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = (totalMem - freeMem) / totalMem;
  metrics.system.lastMemoryUsage = memUsage;
  
  // CPU load 
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  metrics.system.lastCpuUsage = cpuUsage;
  
  // Check heap usage of Node.js process
  const heapStats = process.memoryUsage();
  const heapUsage = heapStats.heapUsed / heapStats.heapTotal;
  metrics.system.lastHeapUsage = heapUsage;
  
  // Log system metrics periodically
  logger.info({
    message: 'System metrics',
    memoryUsage: (memUsage * 100).toFixed(1) + '%',
    cpuLoad: cpuUsage.toFixed(2),
    heapUsage: (heapUsage * 100).toFixed(1) + '%'
  });
  
  // Check thresholds
  if (memUsage > alertThresholds.memoryUsage) {
    alertChannels.log(`High memory usage: ${(memUsage * 100).toFixed(1)}%`);
  }
  
  if (heapUsage > alertThresholds.heapUsage) {
    alertChannels.log(`High heap usage: ${(heapUsage * 100).toFixed(1)}%`);
  }
};

/**
 * Get current metrics for dashboard display
 */
export const getMetrics = () => {
  return {
    requests: {
      total: metrics.requests.total,
      success: metrics.requests.success,
      error: metrics.requests.error,
      errorRate: metrics.requests.total > 0 ? 
        metrics.requests.error / metrics.requests.total : 0,
    },
    responseTime: {
      average: metrics.responseTime.average,
    },
    security: {
      authFailures: metrics.security.authFailures,
      rateLimitExceeded: metrics.security.rateLimitExceeded,
      suspiciousActivities: metrics.security.suspiciousActivities
    },
    system: {
      memoryUsage: metrics.system.lastMemoryUsage,
      cpuUsage: metrics.system.lastCpuUsage,
      heapUsage: metrics.system.lastHeapUsage
    },
    topEndpoints: Object.entries(metrics.requests.byEndpoint)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.total,
        avgResponseTime: stats.avgResponseTime
      }))
  };
};

/**
 * Start monitoring system
 */
export const startMonitoring = (interval = 60000) => {
  // Only run on primary process in cluster mode
  if (!cluster.isPrimary && cluster.isWorker) {
    return;
  }
  
  logger.info('Starting monitoring system');
  
  // Collect system metrics periodically
  setInterval(() => {
    collectSystemMetrics();
  }, interval);
  
  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('Monitoring system stopped');
    }
  };
};

// Create monitoring middleware
export const monitoringMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Record response metrics
  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRequest(req.method, req.originalUrl, res.statusCode, duration);
  });
  
  next();
};
