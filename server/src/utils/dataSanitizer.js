// server/src/utils/dataSanitizer.js
// Utility to redact sensitive information from logging data

// Default fields to be redacted
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'jwt',
  'secret',
  'email',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn'
];

// Redaction replacement value
const REDACTED = '[REDACTED]';

/**
 * Deep clones and sanitizes an object by redacting sensitive fields
 * @param {Object} data - Object to sanitize
 * @param {Array<string>} additionalFields - Additional sensitive field names to redact
 * @returns {Object} Sanitized copy of the object
 */
function sanitizeData(data, additionalFields = []) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Combine default sensitive fields with custom ones
  const sensitiveFields = [
    ...DEFAULT_SENSITIVE_FIELDS,
    ...additionalFields
  ].map(field => field.toLowerCase());

  // Create a deep copy to avoid modifying the original object
  const sanitized = Array.isArray(data) ? [...data] : {...data};

  // Recursively sanitize the object
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if this key matches a sensitive field
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = REDACTED;
    } 
    // Recursively sanitize nested objects
    else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key], additionalFields);
    }
  });

  return sanitized;
}

export { sanitizeData, DEFAULT_SENSITIVE_FIELDS, REDACTED };
