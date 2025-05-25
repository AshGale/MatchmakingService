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
    console.log(`API call: ${method} ${endpoint}`, body ? JSON.stringify(body) : '');
    const response = await fetch(`${API_URL}/${endpoint}`, options);
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
    
    if (!response.ok) {
      console.error(`API Error Response:`, data);
      throw new Error(`API Error (${response.status}): ${data.error || data.message || 'Unknown error'}`);
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

// Test variables
let testLobbyId = null;
let username = 'testuser1';
let password = 'Password123!';

// Run single test
async function runSingleTest(testName, testFn) {
  try {
    console.log(`\n🧪 TEST: ${testName}`);
    await testFn();
    console.log(`✅ PASSED: ${testName}\n`);
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${testName}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Individual test functions
async function testLogin() {
  console.log(`Logging in as: ${username}`);
  await login(username, password);
  console.log('Login successful');
}

async function testCreateLobby() {
  const lobby = await createLobby(`${username}'s Test Lobby`, 4);
  testLobbyId = lobby.id; // Store for later tests
  console.log(`Lobby created with ID: ${lobby.id}`);
  console.log(`Status: ${lobby.status}`);
  console.log(`Players: ${lobby.players.length}/${lobby.maxPlayers}`);
}

async function testGetLobbies() {
  const lobbies = await getLobbies();
  console.log(`Found ${lobbies.length} active lobbies`);
}

async function testSetReady() {
  console.log(`Setting ready status for lobby: ${testLobbyId}`);
  const result = await setReady(testLobbyId, true);
  console.log('Ready status set successfully');
}

async function testStartGame() {
  try {
    await startGame(testLobbyId);
    throw new Error('Game should not start with only one player');
  } catch (error) {
    // Accept either error message
    if (error.message.includes('Not enough players') || error.message.includes('Only the lobby creator can start')) {
      console.log(`Correctly received expected error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

async function testLeaveLobby() {
  await leaveLobby(testLobbyId);
  console.log('Successfully left lobby');
}

// Run all tests in sequence
async function runAllTests() {
  console.log('\n🧪 LOBBY MANAGEMENT SYSTEM TEST SUITE 🧪\n');
  
  try {
    let passed = true;
    
    // Run tests in sequence
    passed &= await runSingleTest('User Login', testLogin);
    
    if (passed) passed &= await runSingleTest('Create Lobby', testCreateLobby);
    if (passed) passed &= await runSingleTest('List Lobbies', testGetLobbies);
    if (passed) passed &= await runSingleTest('Set Ready Status', testSetReady);
    if (passed) passed &= await runSingleTest('Start Game (Expected Failure)', testStartGame);
    if (passed) passed &= await runSingleTest('Leave Lobby', testLeaveLobby);
    
    if (passed) {
      console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉');
    } else {
      console.error('\n❌ SOME TESTS FAILED - SEE ABOVE FOR DETAILS');
    }
  } catch (error) {
    console.error('\n❌ TEST EXECUTION ERROR:', error);
  }
}

runAllTests();
