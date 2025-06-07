/**
 * Database Error Handling
 * 
 * Implements custom error types for database operations and provides
 * mapping functions to convert database-specific errors to application errors.
 */

/**
 * Base Database Error class
 */
class DatabaseError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'DatabaseError';
    this.code = options.code || 'DB_ERROR';
    this.status = options.status || 500;
    this.originalError = options.originalError;
    this.retryable = options.retryable || false;
  }
}

/**
 * Specific error type for connection failures
 */
class ConnectionError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'DB_CONNECTION_ERROR',
      status: options.status || 503,
      retryable: options.retryable !== undefined ? options.retryable : true
    });
    this.name = 'ConnectionError';
  }
}

/**
 * Specific error type for query execution failures
 */
class QueryError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'DB_QUERY_ERROR',
      status: options.status || 500,
      retryable: options.retryable !== undefined ? options.retryable : false
    });
    this.name = 'QueryError';
    this.query = options.query;
    this.params = options.params;
  }
}

/**
 * Specific error type for transaction failures
 */
class TransactionError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'DB_TRANSACTION_ERROR',
      status: options.status || 500
    });
    this.name = 'TransactionError';
  }
}

/**
 * Specific error type for constraint violations
 */
class ConstraintViolationError extends QueryError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'DB_CONSTRAINT_VIOLATION',
      status: options.status || 400,
      retryable: false
    });
    this.name = 'ConstraintViolationError';
    this.constraint = options.constraint;
  }
}

/**
 * Map PostgreSQL errors to application-specific errors
 * 
 * @param {Error} error - PostgreSQL error to map
 * @param {Object} context - Additional context (query, params, etc.)
 * @returns {Error} - Mapped error
 */
function mapDatabaseError(error, context = {}) {
  // If it's already one of our custom errors, return as is
  if (error instanceof DatabaseError) {
    return error;
  }

  // Extract PostgreSQL specific error info
  const pgError = error;
  const code = pgError.code; // PostgreSQL error code
  const detail = pgError.detail;
  const message = pgError.message || 'Database error';
  const constraint = pgError.constraint;
  
  // Define context for the error
  const errorContext = {
    originalError: error,
    ...context
  };

  // Map based on PostgreSQL error codes
  // See: https://www.postgresql.org/docs/current/errcodes-appendix.html
  
  // Connection errors (Class 08)
  if (code && code.startsWith('08')) {
    return new ConnectionError(`Database connection error: ${message}`, {
      ...errorContext,
      code: `DB_${code}`,
      retryable: true
    });
  }
  
  // Constraint violations (Class 23)
  if (code && code.startsWith('23')) {
    let errorMessage = 'Constraint violation';
    let status = 400;
    
    // Common constraint violation codes
    switch(code) {
      case '23505': // unique_violation
        errorMessage = 'Duplicate entry';
        break;
      case '23503': // foreign_key_violation
        errorMessage = 'Referenced record does not exist';
        break;
      case '23502': // not_null_violation
        errorMessage = 'Required field is missing';
        break;
      case '23514': // check_violation
        errorMessage = 'Value violates check constraint';
        break;
      default:
        errorMessage = 'Data validation failed';
    }
    
    return new ConstraintViolationError(`${errorMessage}: ${detail || message}`, {
      ...errorContext,
      code: `DB_${code}`,
      status,
      constraint
    });
  }
  
  // Transaction errors (Class 25, 40)
  if (code && (code.startsWith('25') || code.startsWith('40'))) {
    return new TransactionError(`Transaction error: ${message}`, {
      ...errorContext,
      code: `DB_${code}`,
      retryable: code.startsWith('40')
    });
  }
  
  // Query timeout (Class 57)
  if (code && code.startsWith('57')) {
    return new QueryError(`Query timeout: ${message}`, {
      ...errorContext,
      code: `DB_${code}`,
      status: 504,
      retryable: true
    });
  }
  
  // Default error handler
  return new DatabaseError(`Database error: ${message}`, {
    ...errorContext,
    code: code ? `DB_${code}` : 'DB_UNKNOWN_ERROR'
  });
}

/**
 * Attempt to execute a database operation with retry logic for transient errors
 * 
 * @param {Function} operation - Function that performs the database operation
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in milliseconds (default: 100)
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds (default: 5000)
 * @param {Function} options.shouldRetry - Function to determine if retry should happen
 * @returns {Promise<*>} - Result of the operation
 */
async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    shouldRetry = (error) => error.retryable === true
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Map error if it's not already a DatabaseError
      if (!(error instanceof DatabaseError)) {
        lastError = mapDatabaseError(error);
      }
      
      const isLastAttempt = attempt > maxRetries;
      const shouldRetryOperation = !isLastAttempt && shouldRetry(lastError);
      
      if (!shouldRetryOperation) {
        break;
      }
      
      // Calculate backoff delay with exponential backoff and jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
      const delay = Math.min(exponentialDelay * jitter, maxDelayMs);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DB] Retrying operation (${attempt}/${maxRetries}) after ${delay}ms due to:`, lastError.message);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, we've exhausted retries or determined not to retry
  throw lastError;
}

module.exports = {
  DatabaseError,
  ConnectionError,
  QueryError,
  TransactionError,
  ConstraintViolationError,
  mapDatabaseError,
  withRetry
};
