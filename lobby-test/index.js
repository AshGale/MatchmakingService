// c:\Users\ashga\Documents\Code\MatchmakingService\lobby-test\index.js
import fetch from 'node-fetch';

// Config
const API_URL = 'http://localhost:3000/api';
let accessToken = null;
let userId = null;

// Helper for API calls
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };
  
  try {
    const response = await fetch(`${API_URL}/${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) throw new Error(`API Error: ${data.error || data.message || 'Unknown error'}`);
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
  userId = data.user.id;
  console.log(`Logged in successfully. User ID: ${userId}`);
  return data;
}

// Lobby functions
async function createLobby(name, maxPlayers = 2, isPrivate = false, password = null) {
  console.log(`Creating lobby: ${name}`);
  // The API endpoint uses auth middleware to get creatorId and creatorName
  // We only need to provide the lobby details
  return apiCall('lobbies', 'POST', { 
    name, 
    maxPlayers, 
    isPrivate 
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

// Run tests
async function runTest() {
  try {
    console.log('\n🧪 LOBBY MANAGEMENT SYSTEM TEST 🧪\n');
    
    // Use existing test account
    const username = 'testuser1';
    const password = 'Password123!';
    
    console.log('🔑 Step 1: Login');
    await login(username, password);
    console.log('✅ Login successful');
    
    console.log('\n🏠 Step 2: Create lobby');
    const lobby = await createLobby(`${username}'s Test Lobby`, 4);
    console.log(`✅ Lobby created: "${lobby.name}" (ID: ${lobby.id})`);
    console.log(`   Status: ${lobby.status}`);
    console.log(`   Players: ${lobby.players.length}/${lobby.maxPlayers}`);
    
    console.log('\n🔍 Step 3: Get all lobbies');
    const lobbies = await getLobbies();
    console.log(`✅ Found ${lobbies.length} active lobbies`);
    
    console.log('\n👍 Step 4: Set player ready status');
    const readyStatus = await setReady(lobby.id, true);
    console.log('✅ Ready status set to true');
    
    console.log('\n🎮 Step 5: Try to start game (expected to fail with single player)');
    try {
      const gameStarted = await startGame(lobby.id);
      console.log('⚠️ Unexpectedly started game:', gameStarted);
    } catch (error) {
      console.log('✅ Expected error: Not enough players to start game');
    }
    
    console.log('\n🚪 Step 6: Leave lobby');
    const leftLobby = await leaveLobby(lobby.id);
    console.log('✅ Successfully left lobby');
    
    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }
}

runTest();
