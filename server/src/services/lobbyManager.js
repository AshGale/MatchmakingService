import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.onlineUsers = new Map();
    this.quickMatchQueue = new Map();
    this.invitations = new Map();
    this.userSockets = new Map();
  }

  // User connection management
  userConnected(userId, username, socketId) {
    this.onlineUsers.set(userId, { id: userId, username, status: 'online' });
    this.userSockets.set(userId, socketId);
    logger.info(`User ${username} (${userId}) connected with socket ${socketId}`);
    return { id: userId, username, status: 'online' };
  }

  userDisconnected(userId) {
    // Remove from online users
    this.onlineUsers.delete(userId);
    this.userSockets.delete(userId);
    
    // Remove from quick match queue
    this.cancelQuickMatch(userId);
    
    // Remove from any lobbies they're in
    this.lobbies.forEach((lobby, lobbyId) => {
      if (lobby.players.some(player => player.id === userId)) {
        this.leaveLobby(lobbyId, userId);
      }
    });
    
    // Remove any pending invitations
    this.invitations.forEach((invitation, invitationId) => {
      if (invitation.fromUserId === userId || invitation.targetUserId === userId) {
        this.invitations.delete(invitationId);
      }
    });
    
    return true;
  }

  getSocketId(userId) {
    return this.userSockets.get(userId);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.values());
  }

  // Lobby management
  createLobby({ name, creatorId, creatorName, maxPlayers = 2, isPrivate = false }) {
    const lobbyId = uuidv4();
    
    const lobby = {
      id: lobbyId,
      name,
      creatorId,
      createdAt: new Date(),
      players: [{ id: creatorId, username: creatorName }],
      maxPlayers,
      isPrivate,
      status: 'waiting'
    };
    
    this.lobbies.set(lobbyId, lobby);
    logger.info(`Lobby created: ${name} (${lobbyId}) by ${creatorName}`);
    
    return lobby;
  }

  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId);
  }

  getLobbies(includePrivate = false) {
    const lobbies = Array.from(this.lobbies.values());
    return includePrivate
      ? lobbies
      : lobbies.filter(lobby => !lobby.isPrivate);
  }

  joinLobby(lobbyId, userId, username) {
    const lobby = this.lobbies.get(lobbyId);
    
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    
    if (lobby.players.length >= lobby.maxPlayers) {
      throw new Error('Lobby is full');
    }
    
    if (lobby.status !== 'waiting') {
      throw new Error('Lobby is not accepting new players');
    }
    
    // Check if player is already in the lobby
    if (lobby.players.some(player => player.id === userId)) {
      throw new Error('You are already in this lobby');
    }
    
    // Add player to lobby
    lobby.players.push({ id: userId, username });
    logger.info(`Player ${username} (${userId}) joined lobby ${lobby.name} (${lobbyId})`);
    
    return lobby;
  }

  leaveLobby(lobbyId, userId) {
    const lobby = this.lobbies.get(lobbyId);
    
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    
    // Check if player is in the lobby
    const playerIndex = lobby.players.findIndex(player => player.id === userId);
    if (playerIndex === -1) {
      throw new Error('You are not in this lobby');
    }
    
    // Remove player from lobby
    lobby.players.splice(playerIndex, 1);
    
    let result = {
      lobbyDeleted: false,
      newOwner: null,
      lobby
    };
    
    // If the lobby is now empty, delete it
    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
      result.lobbyDeleted = true;
      logger.info(`Lobby ${lobby.name} (${lobbyId}) deleted as it's empty`);
    } 
    // If the creator left, assign a new creator
    else if (userId === lobby.creatorId) {
      lobby.creatorId = lobby.players[0].id;
      result.newOwner = lobby.players[0];
      logger.info(`New owner of lobby ${lobby.name} (${lobbyId}): ${lobby.players[0].username} (${lobby.players[0].id})`);
    }
    
    return result;
  }

  deleteLobby(lobbyId) {
    if (!this.lobbies.has(lobbyId)) {
      throw new Error('Lobby not found');
    }
    
    const lobby = this.lobbies.get(lobbyId);
    this.lobbies.delete(lobbyId);
    logger.info(`Lobby ${lobby.name} (${lobbyId}) deleted`);
    
    return true;
  }

  // Quick match functionality
  requestQuickMatch(userId, username, preferences = {}) {
    // Remove any existing quick match requests
    this.cancelQuickMatch(userId);
    
    const request = {
      userId,
      username,
      preferences,
      timestamp: Date.now()
    };
    
    this.quickMatchQueue.set(userId, request);
    logger.info(`Player ${username} (${userId}) requested quick match`);
    
    // Look for a match
    const match = this.findQuickMatch(userId, preferences);
    
    if (match) {
      const matchId = uuidv4();
      const players = [
        { id: userId, username },
        { id: match.userId, username: match.username }
      ];
      
      // Remove both from queue
      this.quickMatchQueue.delete(userId);
      this.quickMatchQueue.delete(match.userId);
      
      logger.info(`Quick match found for ${username} (${userId}) and ${match.username} (${match.userId})`);
      
      return {
        message: 'Match found',
        matchId,
        players
      };
    }
    
    return {
      message: 'Added to quick match queue, waiting for opponent'
    };
  }

  findQuickMatch(userId, preferences = {}) {
    // Calculate user's Elo (would normally get from DB)
    // For now, we'll assume a default Elo of 1000 for simplicity
    const userElo = preferences.elo || 1000;
    const maxEloDiff = preferences.maxEloDiff || 200;
    
    // Find closest Elo match
    let bestMatch = null;
    let smallestEloDiff = Infinity;
    
    this.quickMatchQueue.forEach((request, queuedUserId) => {
      if (queuedUserId === userId) return;
      
      const queuedElo = request.preferences.elo || 1000;
      const eloDiff = Math.abs(userElo - queuedElo);
      
      // Check if this is a better match
      if (eloDiff <= maxEloDiff && eloDiff < smallestEloDiff) {
        bestMatch = request;
        smallestEloDiff = eloDiff;
      }
    });
    
    return bestMatch;
  }

  cancelQuickMatch(userId) {
    if (this.quickMatchQueue.has(userId)) {
      this.quickMatchQueue.delete(userId);
      logger.info(`Quick match request canceled for player ${userId}`);
      return true;
    }
    return false;
  }

  // Game invitations
  createInvitation(fromUserId, fromUsername, targetUserId) {
    const invitationId = uuidv4();
    
    const invitation = {
      id: invitationId,
      fromUserId,
      fromUsername,
      targetUserId,
      timestamp: Date.now(),
      // Expire after 60 seconds
      expiresAt: Date.now() + 60000
    };
    
    this.invitations.set(invitationId, invitation);
    logger.info(`Game invitation created from ${fromUsername} (${fromUserId}) to ${targetUserId}`);
    
    // Set timeout to clean up expired invitation
    setTimeout(() => {
      if (this.invitations.has(invitationId)) {
        this.invitations.delete(invitationId);
        logger.info(`Game invitation ${invitationId} expired`);
      }
    }, 60000);
    
    return invitationId;
  }

  getInvitation(invitationId) {
    const invitation = this.invitations.get(invitationId);
    
    if (!invitation) return null;
    
    // Check if expired
    if (invitation.expiresAt < Date.now()) {
      this.invitations.delete(invitationId);
      return null;
    }
    
    return invitation;
  }

  removeInvitation(invitationId) {
    this.invitations.delete(invitationId);
    return true;
  }
}

export { LobbyManager };