import { useState, useCallback } from 'react';
import { LobbyObject, UseLobbyStateResult } from '../types';

// Mock data for initial development
const MOCK_LOBBIES: LobbyObject[] = [
  {
    id: 'lobby-1',
    maxPlayers: 4,
    currentPlayers: 2,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    players: [
      { id: 'player-1', username: 'Player1', joinedAt: new Date() },
      { id: 'player-2', username: 'Player2', joinedAt: new Date() },
    ],
  },
  {
    id: 'lobby-2',
    maxPlayers: 6,
    currentPlayers: 6,
    status: 'full',
    createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    updatedAt: new Date(),
    players: Array(6).fill(0).map((_, i) => ({
      id: `player-${i+10}`,
      username: `Player${i+10}`,
      joinedAt: new Date(),
    })),
  },
  {
    id: 'lobby-3',
    maxPlayers: 4,
    currentPlayers: 4,
    status: 'in-game',
    createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 mins ago
    updatedAt: new Date(),
  },
];

/**
 * Custom hook for managing lobby data and operations
 * @returns {UseLobbyStateResult} Lobby state and operations
 */
export const useLobbyState = (): UseLobbyStateResult => {
  const [lobbies, setLobbies] = useState<LobbyObject[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<LobbyObject | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch lobbies with optional status filter
   * @param status - Optional status filter
   */
  const fetchLobbies = useCallback(async (status?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulating API call with mock data
      await new Promise(resolve => setTimeout(resolve, 300)); // Fake API delay
      
      // Filter mock data based on status if provided
      const filteredLobbies = status 
        ? MOCK_LOBBIES.filter(lobby => lobby.status === status)
        : [...MOCK_LOBBIES];
      
      setLobbies(filteredLobbies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lobbies');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch detailed information for a specific lobby
   * @param id - Lobby ID
   */
  const fetchLobbyDetails = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulating API call with mock data
      await new Promise(resolve => setTimeout(resolve, 300)); // Fake API delay
      
      const lobby = MOCK_LOBBIES.find(l => l.id === id);
      
      if (lobby) {
        setSelectedLobby(lobby);
      } else {
        setError('Lobby not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lobby details');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new lobby
   * @param maxPlayers - Maximum number of players allowed
   * @returns New lobby ID
   */
  const createLobby = useCallback(async (maxPlayers: number): Promise<string> => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Fake API delay
      
      const newLobby: LobbyObject = {
        id: `lobby-${Date.now()}`,
        maxPlayers,
        currentPlayers: 1, // Creator joins automatically
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'current-user', username: 'CurrentUser', joinedAt: new Date() },
        ],
      };
      
      setLobbies(prev => [...prev, newLobby]);
      setSelectedLobby(newLobby);
      
      return newLobby.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lobby');
      return ''; // Empty string indicates failure
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Join an existing lobby
   * @param lobbyId - ID of lobby to join
   * @returns Success status
   */
  const joinLobby = useCallback(async (lobbyId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 400)); // Fake API delay
      
      // Find and update the target lobby
      const lobbyIndex = lobbies.findIndex(l => l.id === lobbyId);
      
      if (lobbyIndex === -1) {
        setError('Lobby not found');
        return false;
      }
      
      const lobby = { ...lobbies[lobbyIndex] };
      
      if (lobby.currentPlayers >= lobby.maxPlayers) {
        setError('Lobby is full');
        return false;
      }
      
      // Update lobby with new player
      const updatedLobby = {
        ...lobby,
        currentPlayers: lobby.currentPlayers + 1,
        status: lobby.currentPlayers + 1 >= lobby.maxPlayers ? 'full' : 'open',
        updatedAt: new Date(),
        players: [
          ...(lobby.players || []),
          { id: 'current-user', username: 'CurrentUser', joinedAt: new Date() },
        ],
      };
      
      // Update lobbies state
      const updatedLobbies = [...lobbies];
      updatedLobbies[lobbyIndex] = updatedLobby;
      
      setLobbies(updatedLobbies);
      setSelectedLobby(updatedLobby);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join lobby');
      return false;
    } finally {
      setLoading(false);
    }
  }, [lobbies]);

  return {
    lobbies,
    selectedLobby,
    fetchLobbies,
    fetchLobbyDetails,
    createLobby,
    joinLobby,
    loading,
    error,
  };
};

export default useLobbyState;
