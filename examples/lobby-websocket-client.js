// examples/lobby-websocket-client.js
import { io } from 'socket.io-client';

/**
 * LobbyClient provides a simple interface for interacting with 
 * the Matchmaking Service lobby system via WebSockets
 */
export class LobbyClient {
  constructor(serverUrl, authToken) {
    this.serverUrl = serverUrl;
    this.authToken = authToken;
    this.socket = null;
    this.connected = false;
    this.lobbyCallbacks = {};
    this.eventListeners = {};
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise} Resolves when connected, rejects on error
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Initialize socket with authentication
        this.socket = io(this.serverUrl, {
          auth: { token: this.authToken },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 3000
        });

        // Setup event handlers
        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.connected = true;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error.message);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from server:', reason);
          this.connected = false;
        });

        // Handle initial state
        this.socket.on('initial_state', (data) => {
          console.log('Received initial state:', data);
          this._triggerEvent('initialState', data);
        });

        // Setup lobby event handlers
        this._setupLobbyEventHandlers();
      } catch (error) {
        console.error('Error connecting to server:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Setup lobby-related event handlers
   * @private
   */
  _setupLobbyEventHandlers() {
    // Lobby created
    this.socket.on('lobby_created', (lobby) => {
      console.log('New lobby created:', lobby);
      this._triggerEvent('lobbyCreated', lobby);
    });

    // Lobby updated
    this.socket.on('lobby_updated', (lobby) => {
      console.log('Lobby updated:', lobby);
      this._triggerEvent('lobbyUpdated', lobby);
    });

    // Lobby deleted
    this.socket.on('lobby_deleted', (data) => {
      console.log('Lobby deleted:', data.lobbyId);
      this._triggerEvent('lobbyDeleted', data);
    });

    // Player joined lobby
    this.socket.on('player_joined_lobby', (data) => {
      console.log(`Player ${data.player.username} joined lobby ${data.lobbyId}`);
      this._triggerEvent('playerJoined', data);
    });

    // Player left lobby
    this.socket.on('player_left_lobby', (data) => {
      console.log(`Player ${data.playerId} left lobby ${data.lobbyId}`);
      this._triggerEvent('playerLeft', data);
    });

    // Player ready status changed
    this.socket.on('player_ready_status_changed', (data) => {
      console.log(`Player ${data.playerId} ready status: ${data.isReady}`);
      this._triggerEvent('playerReadyChanged', data);
    });

    // Lobby state changed
    this.socket.on('lobby_state_changed', (data) => {
      console.log(`Lobby ${data.lobbyId} state changed: ${data.oldState} -> ${data.newState}`);
      this._triggerEvent('lobbyStateChanged', data);
    });

    // Lobby chat message
    this.socket.on('lobby_chat_message', (message) => {
      console.log(`Chat from ${message.username}: ${message.message}`);
      this._triggerEvent('chatMessage', message);
    });

    // Game started from lobby
    this.socket.on('game_started', (data) => {
      console.log(`Game started from lobby ${data.lobbyId}, game ID: ${data.gameId}`);
      this._triggerEvent('gameStarted', data);
    });

    // Lobby invitation
    this.socket.on('lobby_invitation', (data) => {
      console.log(`Received lobby invitation from ${data.inviterName} for lobby ${data.lobbyId}`);
      this._triggerEvent('lobbyInvitation', data);
    });
  }

  /**
   * Create a new lobby
   * @param {Object} options Lobby options
   * @returns {Promise} Resolves with created lobby data
   */
  createLobby(options = {}) {
    return this._emitWithAck('create_lobby', {
      name: options.name || 'New Lobby',
      gameType: options.gameType || 'standard',
      maxPlayers: options.maxPlayers || 2,
      isPrivate: options.isPrivate || false,
      password: options.password || null
    });
  }

  /**
   * Join an existing lobby
   * @param {string} lobbyId Lobby ID
   * @param {string} password Password (for private lobbies)
   * @returns {Promise} Resolves with join result
   */
  joinLobby(lobbyId, password = null) {
    return this._emitWithAck('join_lobby', { 
      lobbyId, 
      password 
    });
  }

  /**
   * Leave a lobby
   * @param {string} lobbyId Lobby ID
   * @returns {Promise} Resolves with leave result
   */
  leaveLobby(lobbyId) {
    return this._emitWithAck('leave_lobby', { lobbyId });
  }

  /**
   * Set player ready status
   * @param {string} lobbyId Lobby ID
   * @param {boolean} isReady Ready status
   * @returns {Promise} Resolves with result
   */
  setReadyStatus(lobbyId, isReady) {
    return this._emitWithAck('set_ready_status', { 
      lobbyId, 
      isReady 
    });
  }

  /**
   * Send a chat message to a lobby
   * @param {string} lobbyId Lobby ID
   * @param {string} message Message text
   * @returns {Promise} Resolves with result
   */
  sendChatMessage(lobbyId, message) {
    return this._emitWithAck('lobby_chat', { 
      lobbyId, 
      message 
    });
  }

  /**
   * Start a game from a lobby
   * @param {string} lobbyId Lobby ID
   * @returns {Promise} Resolves with game start result
   */
  startGame(lobbyId) {
    return this._emitWithAck('start_game', { lobbyId });
  }

  /**
   * Invite a player to a lobby
   * @param {string} lobbyId Lobby ID
   * @param {string} targetUserId User ID to invite
   * @returns {Promise} Resolves with invitation result
   */
  invitePlayer(lobbyId, targetUserId) {
    return this._emitWithAck('send_invitation', { 
      lobbyId, 
      targetUserId 
    });
  }

  /**
   * Add an event listener
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event]
        .filter(cb => cb !== callback);
    }
  }

  /**
   * Trigger event callbacks
   * @param {string} event Event name
   * @param {*} data Event data
   * @private
   */
  _triggerEvent(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  /**
   * Emit a socket.io event with acknowledgement (Promise-based)
   * @param {string} event Event name
   * @param {*} data Event data
   * @returns {Promise} Resolves with response data
   * @private
   */
  _emitWithAck(event, data) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit(event, data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }
}

// Example usage
const example = async () => {
  try {
    // Create client and connect
    const client = new LobbyClient('http://localhost:3000', 'your-auth-token');
    
    // Setup event handlers
    client.on('lobbyCreated', (lobby) => {
      console.log('A new lobby was created:', lobby.name);
    });
    
    client.on('playerJoined', (data) => {
      console.log(`${data.player.username} joined the lobby!`);
    });
    
    client.on('chatMessage', (message) => {
      console.log(`${message.username}: ${message.message}`);
    });
    
    // Connect to server
    await client.connect();
    
    // Create a lobby
    const createResult = await client.createLobby({
      name: 'Test Lobby',
      maxPlayers: 4
    });
    
    const lobbyId = createResult.lobby.id;
    console.log(`Created lobby: ${lobbyId}`);
    
    // Set ready status
    await client.setReadyStatus(lobbyId, true);
    console.log('Set ready status to true');
    
    // Send a chat message
    await client.sendChatMessage(lobbyId, 'Hello everyone!');
    
    // Disconnect when done
    // client.disconnect();
  } catch (error) {
    console.error('Error in example:', error);
  }
};

// Run the example if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  example();
}
