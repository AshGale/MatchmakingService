// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\websocket\websocket.test.js
import { io as Client } from 'socket.io-client';
import { assert } from 'chai';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { setTimeout as sleep } from 'timers/promises';

// Configure environment
dotenv.config({ path: '../../.env' });

// Test setup
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Test user data
const testUsers = [
  { userId: '1', username: 'test_user1' },
  { userId: '2', username: 'test_user2' }
];

// Create test tokens
const createToken = (user) => {
  return jwt.sign(
    { userId: user.userId, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Socket.io client with auth
const createAuthClient = (user) => {
  const token = createToken(user);
  return Client(BASE_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: false
  });
};

// Test suite
console.log('Starting WebSocket test suite...');

// Track test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run tests
const runTest = async (name, testFn) => {
  console.log(`\n🧪 Running test: ${name}`);
  try {
    await testFn();
    console.log(`✅ Test passed: ${name}`);
    results.passed++;
    results.tests.push({ name, passed: true });
  } catch (error) {
    console.error(`❌ Test failed: ${name}`);
    console.error(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
  }
};

// Test 1: Authentication middleware
await runTest('Authentication middleware', async () => {
  // Without token
  const invalidClient = Client(BASE_URL, {
    autoConnect: false,
    reconnection: false
  });
  
  // Connect and expect error
  let authError = null;
  invalidClient.on('connect_error', (error) => {
    authError = error;
  });
  
  invalidClient.connect();
  await sleep(500);
  invalidClient.disconnect();
  
  assert.isNotNull(authError, 'Should get authentication error without token');
  
  // With valid token
  const validClient = createAuthClient(testUsers[0]);
  let connected = false;
  
  validClient.on('connect', () => {
    connected = true;
  });
  
  validClient.connect();
  await sleep(500);
  validClient.disconnect();
  
  assert.isTrue(connected, 'Should connect successfully with valid token');
});

// Test 2: Basic WebSocket server setup
await runTest('Basic WebSocket server setup', async () => {
  const client = createAuthClient(testUsers[0]);
  let initialState = null;
  
  client.on('initial_state', (data) => {
    initialState = data;
  });
  
  client.connect();
  await sleep(1000);
  
  assert.isNotNull(initialState, 'Should receive initial state');
  assert.property(initialState, 'lobbies', 'Initial state should contain lobbies');
  assert.property(initialState, 'onlineUsers', 'Initial state should contain onlineUsers');
  
  client.disconnect();
});

// Test 3: Lobby event handling
await runTest('Lobby event handling', async () => {
  const client = createAuthClient(testUsers[0]);
  let lobbyCreated = false;
  let lobbyId = null;
  
  // Connect and listen for lobby events
  client.connect();
  await sleep(500);
  
  // Create lobby
  client.emit('create_lobby', { 
    name: 'Test Lobby',
    gameType: 'standard',
    maxPlayers: 4,
    isPrivate: false
  }, (response) => {
    lobbyCreated = response.success;
    if (response.success) {
      lobbyId = response.lobby.id;
    }
  });
  
  await sleep(1000);
  assert.isTrue(lobbyCreated, 'Should successfully create a lobby');
  assert.isNotNull(lobbyId, 'Should receive lobby ID');
  
  // Test joining a lobby
  let joinedLobby = false;
  
  client.emit('join_lobby', { lobbyId }, (response) => {
    joinedLobby = response.success;
  });
  
  await sleep(500);
  assert.isTrue(joinedLobby, 'Should successfully join a lobby');
  
  // Test sending and receiving chat messages
  let chatReceived = false;
  const testMessage = 'Hello, lobby!';
  
  client.on('lobby_chat_message', (data) => {
    chatReceived = data.message === testMessage;
  });
  
  client.emit('send_lobby_message', { 
    lobbyId, 
    message: testMessage 
  });
  
  await sleep(500);
  assert.isTrue(chatReceived, 'Should receive chat messages in lobby');
  
  // Cleanup
  client.emit('leave_lobby', { lobbyId });
  await sleep(500);
  client.disconnect();
});

// Test 4: Game state event handling
await runTest('Game state event handling', async () => {
  // Create two clients
  const client1 = createAuthClient(testUsers[0]);
  const client2 = createAuthClient(testUsers[1]);
  
  // Connect both clients
  client1.connect();
  client2.connect();
  await sleep(500);
  
  // Setup game variables
  let gameId = null;
  let gameStarted = false;
  
  // Listen for game start event
  client1.on('game_started', (data) => {
    gameId = data.gameId;
    gameStarted = true;
  });
  
  // Send invitation
  client1.emit('send_invitation', { 
    targetUserId: testUsers[1].userId 
  }, (response) => {
    assert.isTrue(response.success, 'Invitation should be sent successfully');
  });
  
  await sleep(500);
  
  // Accept invitation
  let invitationReceived = false;
  client2.on('game_invitation', (data) => {
    invitationReceived = true;
    
    // Accept the invitation
    client2.emit('respond_to_invitation', {
      invitationId: data.invitationId,
      accept: true
    });
  });
  
  await sleep(1000);
  assert.isTrue(invitationReceived, 'Invitation should be received');
  assert.isTrue(gameStarted, 'Game should be started');
  assert.isNotNull(gameId, 'Should receive game ID');
  
  // Test game move
  let moveReceived = false;
  const testMove = { x: 1, y: 2 };
  
  client2.on('game_move', (data) => {
    moveReceived = data.move.x === testMove.x && data.move.y === testMove.y;
  });
  
  client1.emit('game_move', { 
    gameId, 
    move: testMove 
  });
  
  await sleep(500);
  assert.isTrue(moveReceived, 'Should receive game moves');
  
  // Cleanup
  client1.disconnect();
  client2.disconnect();
});

// Test 5: Connection management and error handling
await runTest('Connection management and error handling', async () => {
  const client = createAuthClient(testUsers[0]);
  
  // Connect and check online notification
  let userConnected = false;
  let userDisconnected = false;
  
  // Create second client to monitor events
  const observerClient = createAuthClient(testUsers[1]);
  observerClient.connect();
  await sleep(500);
  
  observerClient.on('user_connected', (data) => {
    userConnected = data.userId === testUsers[0].userId;
  });
  
  observerClient.on('user_disconnected', (data) => {
    userDisconnected = data.userId === testUsers[0].userId;
  });
  
  // Connect the first client
  client.connect();
  await sleep(1000);
  
  assert.isTrue(userConnected, 'Should notify when user connects');
  
  // Disconnect the first client
  client.disconnect();
  await sleep(1000);
  
  assert.isTrue(userDisconnected, 'Should notify when user disconnects');
  
  // Cleanup
  observerClient.disconnect();
});

// Print test summary
console.log('\n📊 TEST SUMMARY:');
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Total: ${results.passed + results.failed}`);

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);
