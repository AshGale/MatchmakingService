// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\lobby\test-lobby-api.js
import fetch from 'node-fetch';

// Configuration
const API_URL = 'http://localhost:3000/api';
let accessToken = null;
let refreshToken = null;
let userId = null;

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };
  
  try {
    const response = await fetch(`${API_URL}/${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error || data.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.message);
    throw error;
  }
}

// Auth functions
async function register(username, password, email) {
  console.log(`Registering user: ${username}`);
  return apiCall('auth/register', 'POST', { username, password, email });
}

async function login(username, password) {
  console.log(`Logging in as: ${username}`);
  const data = await apiCall('auth/login', 'POST', { username, password });
  accessToken = data.accessToken;
  refreshToken = data.refreshToken.token;
  userId = data.user.id;
  console.log(`Logged in successfully. User ID: ${userId}`);
  return data;
}

// Lobby functions
async function createLobby(name, maxPlayers = 2, isPrivate = false, password = null) {
  console.log(`Creating lobby: ${name}`);
  return apiCall('lobbies', 'POST', { 
    name, 
    maxPlayers, 
    isPrivate, 
    password 
  }, accessToken);
}

async function getLobbies() {
  console.log('Getting list of lobbies');
  return apiCall('lobbies', 'GET', null, accessToken);
}

async function joinLobby(lobbyId, password = null) {
  console.log(`Joining lobby: ${lobbyId}`);
  return apiCall(`lobbies/${lobbyId}/join`, 'POST', { password }, accessToken);
}

async function leaveLobby(lobbyId) {
  console.log(`Leaving lobby: ${lobbyId}`);
  return apiCall(`lobbies/${lobbyId}/leave`, 'DELETE', null, accessToken);
}

async function setReady(lobbyId, isReady = true) {
  console.log(`Setting ready status to ${isReady} in lobby: ${lobbyId}`);
  return apiCall(`lobbies/${lobbyId}/ready`, 'POST', { isReady }, accessToken);
}

async function startGame(lobbyId) {
  console.log(`Starting game in lobby: ${lobbyId}`);
  return apiCall(`lobbies/${lobbyId}/start`, 'POST', null, accessToken);
}

async function getLobbyChat(lobbyId) {
  console.log(`Getting chat history for lobby: ${lobbyId}`);
  return apiCall(`lobbies/${lobbyId}/chat`, 'GET', null, accessToken);
}

// Main test function
async function runTest() {
  try {
    // Generate a highly unique username with timestamp and random suffix
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const username = `user_${timestamp}_${randomSuffix}`;
    const password = 'Password123!';
    const email = `${username}@example.com`;
    
    // Register and login
    await register(username, password, email);
    await login(username, password);
    
    // Create a lobby
    const lobby = await createLobby(`${username}'s Lobby`, 4);
    console.log('Created lobby:', lobby);
    
    // Get list of lobbies
    const lobbies = await getLobbies();
    console.log('Available lobbies:', lobbies);
    
    // Set ready status
    const readyStatus = await setReady(lobby.id);
    console.log('Ready status set:', readyStatus);
    
    // Try to start the game (this might fail if not enough players are ready)
    try {
      const gameStarted = await startGame(lobby.id);
      console.log('Game started:', gameStarted);
    } catch (error) {
      console.log('Expected error - cannot start game with only one player ready');
    }
    
    // Leave the lobby
    const leftLobby = await leaveLobby(lobby.id);
    console.log('Left lobby:', leftLobby);
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest();
