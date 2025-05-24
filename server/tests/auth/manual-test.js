// server/tests/auth/manual-test.js
import fetch from 'node-fetch';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// API base URL
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Test state
let accessToken = null;
let refreshToken = null;
let currentUsername = null;

/**
 * Show the test menu
 */
function showMenu() {
  console.log('\n=== Authentication Test Menu ===');
  console.log('1. Register a new user');
  console.log('2. Login with credentials');
  console.log('3. Access protected profile');
  console.log('4. Refresh access token');
  console.log('5. Logout');
  console.log('6. Exit');
  console.log('===========================');
  console.log('Current status:');
  console.log(`- User: ${currentUsername || 'Not logged in'}`);
  console.log(`- Access token: ${accessToken ? 'Present' : 'None'}`);
  console.log(`- Refresh token: ${refreshToken ? 'Present' : 'None'}`);
  console.log('===========================\n');
  
  rl.question('Select an option (1-6): ', handleMenuChoice);
}

/**
 * Handle menu selection
 */
async function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      await registerUser();
      break;
    case '2':
      await loginUser();
      break;
    case '3':
      await getProfile();
      break;
    case '4':
      await refreshToken();
      break;
    case '5':
      await logoutUser();
      break;
    case '6':
      console.log('Exiting test script. Goodbye!');
      rl.close();
      return;
    default:
      console.log('Invalid option. Please try again.');
  }
  
  showMenu();
}

/**
 * Register a new user
 */
async function registerUser() {
  rl.question('Enter username: ', async (username) => {
    rl.question('Enter password: ', async (password) => {
      try {
        console.log(`\nRegistering user ${username}...`);
        
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username,
            password
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('✅ Registration successful!');
          console.log('User ID:', data.user.id);
          
          // Update test state
          currentUsername = username;
          accessToken = data.accessToken;
          refreshToken = data.refreshToken;
        } else {
          console.log('❌ Registration failed:', data.message || 'Unknown error');
          if (data.errors) {
            console.log('Validation errors:', data.errors);
          }
        }
        
        showMenu();
      } catch (error) {
        console.error('Error during registration:', error.message);
        showMenu();
      }
    });
  });
}

/**
 * Login with existing credentials
 */
async function loginUser() {
  rl.question('Enter username: ', async (username) => {
    rl.question('Enter password: ', async (password) => {
      try {
        console.log(`\nLogging in as ${username}...`);
        
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username,
            password
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('✅ Login successful!');
          
          // Update test state
          currentUsername = username;
          accessToken = data.accessToken;
          refreshToken = data.refreshToken;
        } else {
          console.log('❌ Login failed:', data.message || 'Unknown error');
        }
        
        showMenu();
      } catch (error) {
        console.error('Error during login:', error.message);
        showMenu();
      }
    });
  });
}

/**
 * Get user profile (protected route)
 */
async function getProfile() {
  try {
    if (!accessToken) {
      console.log('❌ No access token available. Please login first.');
      showMenu();
      return;
    }
    
    console.log('\nFetching user profile...');
    
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Profile retrieved successfully!');
      console.log('User profile:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Profile retrieval failed:', data.message || 'Unknown error');
    }
    
    showMenu();
  } catch (error) {
    console.error('Error retrieving profile:', error.message);
    showMenu();
  }
}

/**
 * Refresh the access token
 */
async function refreshAccessToken() {
  try {
    if (!refreshToken) {
      console.log('❌ No refresh token available. Please login first.');
      showMenu();
      return;
    }
    
    console.log('\nRefreshing access token...');
    
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Token refresh successful!');
      
      // Update tokens
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
    } else {
      console.log('❌ Token refresh failed:', data.message || 'Unknown error');
    }
    
    showMenu();
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    showMenu();
  }
}

/**
 * Logout the current user
 */
async function logoutUser() {
  try {
    if (!accessToken || !refreshToken) {
      console.log('❌ No tokens available. Please login first.');
      showMenu();
      return;
    }
    
    console.log('\nLogging out...');
    
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        refreshToken
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Logout successful!');
      
      // Clear test state
      currentUsername = null;
      accessToken = null;
      refreshToken = null;
    } else {
      console.log('❌ Logout failed:', data.message || 'Unknown error');
    }
    
    showMenu();
  } catch (error) {
    console.error('Error during logout:', error.message);
    showMenu();
  }
}

// Start the test script
console.log('Authentication Manual Test Script');
console.log('================================');
console.log('This script allows you to interactively test the authentication system.');
console.log('The server must be running at http://localhost:3000');

showMenu();
