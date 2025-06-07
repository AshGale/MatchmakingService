/**
 * HTTP Client Interceptors
 * 
 * Implements request and response interceptors for authentication,
 * error handling, and response transformation.
 */

/**
 * Sets up request and response interceptors for the HTTP client
 * 
 * @param {Object} instance - Axios instance
 * @param {Object} config - Configuration options
 */
function setupInterceptors(instance, config) {
  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      // Add authentication if available (e.g., from environment variables)
      const authToken = process.env.API_AUTH_TOKEN;
      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      
      // Add request ID for tracing
      config.headers['X-Request-ID'] = generateRequestId();
      
      // Add timestamp for debugging
      config.metadata = { 
        ...config.metadata,
        startTime: Date.now()
      };
      
      return config;
    },
    (error) => {
      // Log request errors
      console.error('Request error:', error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      // Add response time information
      const requestTime = Date.now() - (response.config.metadata?.startTime || 0);
      response.metadata = {
        ...response.metadata,
        requestTime,
      };
      
      // Log success responses if needed
      if (process.env.NODE_ENV === 'development') {
        console.log(`${response.config.method.toUpperCase()} ${response.config.url} - ${response.status} (${requestTime}ms)`);
      }
      
      return response;
    },
    (error) => {
      // Add response time to error object if possible
      if (error.config && error.config.metadata?.startTime) {
        const requestTime = Date.now() - error.config.metadata.startTime;
        error.metadata = {
          ...error.metadata,
          requestTime,
        };
      }
      
      // Transform error for better client handling
      if (error.response) {
        // Server responded with non-2xx status
        const { status, data } = error.response;
        
        // Enhance error with additional information
        error.isAxiosError = true;
        error.status = status;
        error.message = data?.message || error.message;
        
        // Log errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error(`API Error (${status}):`, error.message);
        }
      } else if (error.request) {
        // Request made but no response received
        error.isNetworkError = true;
        
        if (process.env.NODE_ENV === 'development') {
          console.error('Network Error:', error.message);
        }
      }
      
      return Promise.reject(error);
    }
  );
}

/**
 * Generates a unique request ID
 * 
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  setupInterceptors,
};
