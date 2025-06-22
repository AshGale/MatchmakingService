import { LobbyObject } from '../types';

/**
 * Base API configuration
 */
const API_BASE_URL = '/api'; // Relative URL to be handled by proxy in development
const LOBBIES_ENDPOINT = `${API_BASE_URL}/lobbies`;

/**
 * API request helper with error handling
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Response data
 */
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      // Try to parse error response
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `API Error: ${response.status}`);
      } catch (parseError) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    }

    // For 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Get all lobbies with optional status filter
 * @param status - Optional status filter ('waiting', 'active', 'finished')
 * @returns Array of lobbies
 */
export async function getLobbies(status?: string): Promise<LobbyObject[]> {
  const url = status
    ? `${LOBBIES_ENDPOINT}?status=${encodeURIComponent(status)}`
    : LOBBIES_ENDPOINT;
  
  return apiRequest<LobbyObject[]>(url);
}

/**
 * Get detailed information about a specific lobby
 * @param lobbyId - ID of the lobby to fetch
 * @returns Lobby details
 */
export async function getLobbyById(lobbyId: string): Promise<LobbyObject> {
  return apiRequest<LobbyObject>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}`);
}

/**
 * Create a new lobby
 * @param maxPlayers - Maximum number of players allowed in the lobby
 * @returns Created lobby object
 */
export async function createLobby(maxPlayers: number): Promise<LobbyObject> {
  return apiRequest<LobbyObject>(LOBBIES_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ settings: { maxPlayers } }),
  });
}

/**
 * Join an existing lobby
 * @param lobbyId - ID of the lobby to join
 * @returns Updated lobby object with the player added
 */
export async function joinLobby(lobbyId: string): Promise<LobbyObject> {
  return apiRequest<LobbyObject>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/join`, {
    method: 'POST',
  });
}

/**
 * Leave a lobby
 * @param lobbyId - ID of the lobby to leave
 * @returns Updated lobby object
 */
export async function leaveLobby(lobbyId: string): Promise<LobbyObject> {
  return apiRequest<LobbyObject>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/leave`, {
    method: 'POST',
  });
}

/**
 * Update lobby status
 * @param lobbyId - ID of the lobby to update
 * @param status - New status ('waiting', 'active', 'finished')
 * @returns Updated lobby object
 */
export async function updateLobbyStatus(
  lobbyId: string,
  status: string
): Promise<LobbyObject> {
  return apiRequest<LobbyObject>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}
