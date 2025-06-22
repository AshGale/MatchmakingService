import { useState, useCallback, useEffect } from 'react';
import { LobbyObject, UseLobbyStateResult } from '../types';
import {
  getLobbies,
  getLobbyById,
  createLobby as apiCreateLobby,
  joinLobby as apiJoinLobby,
  leaveLobby as apiLeaveLobby
} from '../services/lobbyApi';

/**
 * Custom hook for managing lobby data and operations
 * @returns {UseLobbyStateResult} Lobby state and operations
 */
export const useLobbyState = (): UseLobbyStateResult => {
  const [lobbies, setLobbies] = useState<LobbyObject[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<LobbyObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch lobbies with optional status filter
   * @param status - Optional status filter
   */
  const fetchLobbies = useCallback(async (status?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the API service to get lobbies
      const result = await getLobbies(status);
      setLobbies(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lobbies');
      // Keep existing lobbies if request fails
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
      
      // Call the API service to get lobby details
      const lobby = await getLobbyById(id);
      setSelectedLobby(lobby);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lobby details');
      setSelectedLobby(null);
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
      
      // Call the API service to create a lobby
      const newLobby = await apiCreateLobby(maxPlayers);
      
      // Update local state with the new lobby
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
      
      // Call the API service to join the lobby
      const updatedLobby = await apiJoinLobby(lobbyId);
      
      // Update the local state with the updated lobby data
      setLobbies(prev => prev.map(lobby => 
        lobby.id === lobbyId ? updatedLobby : lobby
      ));
      setSelectedLobby(updatedLobby);
      
      return true;
    } catch (err) {
      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('full')) {
          setError('Lobby is full');
        } else if (err.message.includes('not found')) {
          setError('Lobby not found');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to join lobby');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Leave a lobby
   * @param lobbyId - ID of lobby to leave
   * @returns Success status
   */
  const leaveLobby = useCallback(async (lobbyId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the API service to leave the lobby
      const updatedLobby = await apiLeaveLobby(lobbyId);
      
      // Update the local state with the updated lobby data
      setLobbies(prev => prev.map(lobby => 
        lobby.id === lobbyId ? updatedLobby : lobby
      ));
      setSelectedLobby(null);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave lobby');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch lobbies on component mount
  useEffect(() => {
    fetchLobbies();
    // We're intentionally only running this once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    lobbies,
    selectedLobby,
    fetchLobbies,
    fetchLobbyDetails,
    createLobby,
    joinLobby,
    leaveLobby,
    loading,
    error,
  };
};

export default useLobbyState;
