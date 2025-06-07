/**
 * HTTP Client Example Usage
 * 
 * This file demonstrates how to use the HTTP client with different configurations.
 */

const { createHttpClient } = require('./index');

/**
 * Example of creating a basic HTTP client
 */
function basicClientExample() {
  // Create a basic HTTP client with default configuration
  const httpClient = createHttpClient();
  
  return httpClient;
}

/**
 * Example of creating a customized HTTP client
 */
function customizedClientExample() {
  // Create a customized HTTP client
  const httpClient = createHttpClient({
    baseURL: 'https://api.example.com/v1',
    headers: {
      'X-API-Key': 'your-api-key',
    },
    timeout: 10000, // 10 seconds
    retry: {
      maxRetries: 5,
      initialDelayMs: 500,
      maxDelayMs: 8000,
    }
  });
  
  return httpClient;
}

/**
 * Example usage of HTTP client for API requests
 */
async function exampleApiRequests() {
  const httpClient = basicClientExample();
  
  try {
    // Example GET request
    const getResponse = await httpClient.get('/users');
    console.log('GET Response:', getResponse.data);
    
    // Example POST request
    const postResponse = await httpClient.post('/users', {
      name: 'John Doe',
      email: 'john.doe@example.com'
    });
    console.log('POST Response:', postResponse.data);
    
    // Example PUT request
    const putResponse = await httpClient.put('/users/123', {
      name: 'John Updated',
      email: 'john.updated@example.com'
    });
    console.log('PUT Response:', putResponse.data);
    
    // Example DELETE request
    const deleteResponse = await httpClient.delete('/users/123');
    console.log('DELETE Response:', deleteResponse.data);
    
  } catch (error) {
    console.error('API Error:', error.message);
    
    // Check for specific error types
    if (error.isNetworkError) {
      console.error('Network error occurred');
    } else if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

module.exports = {
  basicClientExample,
  customizedClientExample,
  exampleApiRequests,
};
