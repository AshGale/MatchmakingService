// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\auth\api-test.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Generate a unique username to avoid conflicts
const testUsername = `testuser_${Date.now()}`;
const testPassword = 'TestPass123';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testRegistration() {
  console.log(`Testing registration with username: ${testUsername}`);
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Registration successful!');
      console.log('User ID:', data.user.id);
      console.log('Username:', data.user.username);
      console.log('Access token received:', !!data.accessToken);
      console.log('Refresh token received:', !!data.refreshToken);
      
      // Test login with the new credentials
      await testLogin();
    } else {
      console.log('❌ Registration failed:', data.message || 'Unknown error');
      if (data.errors) {
        console.log('Validation errors:', data.errors);
      }
    }
  } catch (error) {
    console.error('Error during registration test:', error.message);
  }
}

async function testLogin() {
  console.log(`\nTesting login with username: ${testUsername}`);
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('User ID:', data.user.id);
      console.log('Access token received:', !!data.accessToken);
      console.log('Refresh token received:', !!data.refreshToken);
      
      // Test accessing a protected route
      if (data.accessToken) {
        await testProtectedRoute(data.accessToken);
      }
    } else {
      console.log('❌ Login failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error during login test:', error.message);
  }
}

async function testProtectedRoute(token) {
  console.log('\nTesting access to protected route (/api/auth/me)');
  
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Protected route access successful!');
      console.log('User profile:', data);
    } else {
      console.log('❌ Protected route access failed:', data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error accessing protected route:', error.message);
  }
}

// Start the tests
testRegistration();
