import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

/**
 * Example of a React component that connects to the match-making server
 * This can be used as a reference for integrating with the front-end
 */
const GameLobby = ({ token, userId }) => {
  const [socket, setSocket] = useState(null);
  const [lobbies, setLobbies] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [lobbyName, setLobbyName] = useState('');
  const [selectedLobby, setSelectedLobby] = useState(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) return;
    
    // Connect to the server with authentication
    const io = require('socket.io-client');
    const newSocket = io('http://localhost', {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
    
    newSocket.on('initial_state', (data) => {
      setLobbies(data.lobbies || []);
      setOnlineUsers(data.onlineUsers || []);
      setActiveGames(data.activeGames || []);
    });
    
    // Lobby events
    newSocket.on('lobby_created', (lobby) => {
      setLobbies(prev => [...prev, lobby]);
    });
    
    newSocket.on('lobby_updated', (updatedLobby) => {
      setLobbies(prev => prev.map(lobby => 
        lobby.id === updatedLobby.id ? updatedLobby : lobby
      ));
      
      if (selectedLobby && selectedLobby.id === updatedLobby.id) {
        setSelectedLobby(updatedLobby);
      }
    });
    
    newSocket.on('lobby_deleted', ({ lobbyId }) => {
      setLobbies(prev => prev.filter(lobby => lobby.id !== lobbyId));
      
      if (selectedLobby && selectedLobby.id === lobbyId) {
        setSelectedLobby(null);
      }
    });
    
    newSocket.on('player_joined_lobby', ({ lobbyId, player }) => {
      if (selectedLobby && selectedLobby.id === lobbyId) {
        setSelectedLobby(prev => ({
          ...prev,
          players: [...prev.players, player]
        }));
      }
    });
    
    newSocket.on('player_left_lobby', ({ lobbyId, playerId, newOwner }) => {
      if (selectedLobby && selectedLobby.id === lobbyId) {
        setSelectedLobby(prev => ({
          ...prev,
          players: prev.players.filter(p => p.id !== playerId),
          creatorId: newOwner ? newOwner.id : prev.creatorId
        }));
      }
    });
    
    // Game events
    newSocket.on('game_started', ({ gameId, players }) => {
      console.log(`Game started: ${gameId}`);
      // Redirect to game page or update UI
    });
    
    newSocket.on('game_invitation', ({ invitationId, fromUserId, fromUsername }) => {
      // Show invitation UI
      const accept = window.confirm(`${fromUsername} has invited you to a game. Accept?`);
      
      if (accept) {
        newSocket.emit('respond_to_invitation', { invitationId, accept: true }, (response) => {
          if (response.success) {
            // Redirect to game page
            console.log(`Game started: ${response.gameId}`);
          }
        });
      } else {
        newSocket.emit('respond_to_invitation', { invitationId, accept: false });
      }
    });
    
    // User events
    newSocket.on('user_connected', ({ userId, username }) => {
      setOnlineUsers(prev => [...prev, { id: userId, username, status: 'online' }]);
    });
    
    newSocket.on('user_disconnected', ({ userId }) => {
      setOnlineUsers(prev => prev.filter(user => user.id !== userId));
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [token]);
  
  // Create a new lobby
  const handleCreateLobby = () => {
    if (!socket || !lobbyName.trim()) return;
    
    socket.emit('create_lobby', { name: lobbyName }, (response) => {
      if (response.success) {
        setLobbyName('');
        setSelectedLobby(response.lobby);
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Join an existing lobby
  const handleJoinLobby = (lobbyId) => {
    if (!socket) return;
    
    socket.emit('join_lobby', { lobbyId }, (response) => {
      if (response.success) {
        setSelectedLobby(response.lobby);
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Leave the current lobby
  const handleLeaveLobby = () => {
    if (!socket || !selectedLobby) return;
    
    socket.emit('leave_lobby', { lobbyId: selectedLobby.id }, (response) => {
      if (response.success) {
        setSelectedLobby(null);
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Start a game from the lobby
  const handleStartGame = () => {
    if (!socket || !selectedLobby) return;
    
    socket.emit('start_game', { lobbyId: selectedLobby.id }, (response) => {
      if (response.success) {
        // Redirect to game page
        console.log(`Game started: ${response.gameId}`);
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Request a quick match
  const handleQuickMatch = () => {
    if (!socket) return;
    
    socket.emit('quick_match', {}, (response) => {
      if (response.success) {
        alert(response.message);
        if (response.matchId) {
          // Match found immediately, game will start soon
          console.log(`Match found: ${response.matchId}`);
        }
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Cancel quick match request
  const handleCancelQuickMatch = () => {
    if (!socket) return;
    
    socket.emit('cancel_quick_match', {}, (response) => {
      if (response.success) {
        alert('Quick match request canceled');
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  // Send a game invitation
  const handleSendInvitation = (targetUserId) => {
    if (!socket) return;
    
    socket.emit('send_invitation', { targetUserId }, (response) => {
      if (response.success) {
        alert('Invitation sent');
      } else {
        alert(`Error: ${response.error}`);
      }
    });
  };
  
  return (
    <div className="game-lobby">
      <h1>Game Lobby</h1>
      
      {/* Create Lobby Form */}
      <div className="create-lobby">
        <input
          type="text"
          value={lobbyName}
          onChange={(e) => setLobbyName(e.target.value)}
          placeholder="Lobby Name"
        />
        <button onClick={handleCreateLobby}>Create Lobby</button>
        <button onClick={handleQuickMatch}>Quick Match</button>
      </div>
      
      {/* Selected Lobby */}
      {selectedLobby && (
        <div className="selected-lobby">
          <h2>{selectedLobby.name}</h2>
          <p>Created by: {selectedLobby.creatorName}</p>
          <h3>Players:</h3>
          <ul>
            {selectedLobby.players.map(player => (
              <li key={player.id}>{player.username}</li>
            ))}
          </ul>
          <div className="lobby-actions">
            <button onClick={handleLeaveLobby}>Leave Lobby</button>
            {selectedLobby.creatorId === userId && (
              <button 
                onClick={handleStartGame}
                disabled={selectedLobby.players.length < 2}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Lobby List */}
      {!selectedLobby && (
        <div className="lobby-list">
          <h2>Available Lobbies</h2>
          {lobbies.length === 0 ? (
            <p>No lobbies available</p>
          ) : (
            <ul>
              {lobbies.map(lobby => (
                <li key={lobby.id}>
                  <span>{lobby.name} ({lobby.players.length}/{lobby.maxPlayers})</span>
                  <button onClick={() => handleJoinLobby(lobby.id)}>Join</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Online Users */}
      <div className="online-users">
        <h2>Online Users</h2>
        {onlineUsers.length === 0 ? (
          <p>No users online</p>
        ) : (
          <ul>
            {onlineUsers.map(user => (
              <li key={user.id}>
                <span>{user.username}</span>
                {user.id !== userId && (
                  <button onClick={() => handleSendInvitation(user.id)}>
                    Invite
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Active Games */}
      <div className="active-games">
        <h2>Active Games</h2>
        {activeGames.length === 0 ? (
          <p>No active games</p>
        ) : (
          <ul>
            {activeGames.map(game => (
              <li key={game.id}>
                <span>
                  {game.players[0].username} vs {game.players[1].username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GameLobby;