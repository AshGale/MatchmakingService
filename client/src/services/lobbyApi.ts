import { LobbyObject } from '../types';

/**
 * Base API configuration
 */
const API_BASE_URL = '/api'; // Relative URL to be handled by proxy in development
const LOBBIES_ENDPOINT = `${API_BASE_URL}/lobbies`;

/**
 * Maps frontend status values to backend status values
 */
type FrontendStatus = 'open' | 'full' | 'in-game' | 'closed';
type BackendStatus = 'waiting' | 'active' | 'finished';

interface StatusMappings {
  [key: string]: string;
}

const statusMapping: StatusMappings = {
  // Frontend → Backend
  'open': 'waiting',
  'full': 'waiting',
  'in-game': 'active',
  'closed': 'finished',
  
  // Backend → Frontend
  'waiting': 'open',
  'active': 'in-game',
  'finished': 'closed'
};

/**
 * Convert a backend lobby object to frontend format
 */
function convertLobbyFromBackend(lobby: any): LobbyObject {
  return {
    ...lobby,
    status: lobby.status && statusMapping[lobby.status] ? statusMapping[lobby.status] : lobby.status
  };
}

/**
 * Convert status string from frontend to backend format
 */
function convertStatusToBackend(status?: string): string | undefined {
  if (!status) return undefined;
  return statusMapping[status] || status;
}

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
 * @param status - Optional status filter ('open', 'full', 'in-game', 'closed')
 * @returns Array of lobbies
 */
export async function getLobbies(status?: string): Promise<LobbyObject[]> {
  try {
    // If no status is provided or it maps to undefined, default to fetching 'waiting' lobbies
    // This is needed because the backend requires the status query parameter
    const backendStatus = status ? convertStatusToBackend(status) : 'waiting';
    
    // TypeScript fix - ensure we always have a string to encode
    const encodedStatus = backendStatus ? encodeURIComponent(backendStatus) : '';
    const url = `${LOBBIES_ENDPOINT}?status=${encodedStatus}`;
    
    console.log(`Fetching lobbies with URL: ${url}`);
    
    const response = await apiRequest<{lobbies: any[], total_count: number}>(url);
    
    // Convert each lobby from backend to frontend format
    return Array.isArray(response.lobbies) ? response.lobbies.map(convertLobbyFromBackend) : [];
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    return [];
  }
}

/**
 * Get detailed information about a specific lobby
 * @param lobbyId - ID of the lobby to fetch
 * @returns Lobby details
 */
export async function getLobbyById(lobbyId: string): Promise<LobbyObject> {
  const response = await apiRequest<any>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}`);
  return convertLobbyFromBackend(response);
}

/**
 * Create a new lobby
 * @param maxPlayers - Maximum number of players allowed in the lobby
 * @returns Created lobby object
 */
export async function createLobby(maxPlayers: number): Promise<LobbyObject> {
  try {
    // Get the session ID for this user
    const playerId = getUserSessionId();
    
    console.log(`Creating lobby with max players: ${maxPlayers} and player ID: ${playerId}`);
    
    const response = await apiRequest<any>(LOBBIES_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        playerId, // Optional player ID
        settings: { maxPlayers } 
      }),
    });
    
    return convertLobbyFromBackend(response);
  } catch (error) {
    console.error('Error creating lobby:', error);
    throw error;
  }
}

/**
 * Generate a unique session ID for the current user
 * This would typically come from authentication in a real app
 * We'll store it in localStorage for persistence across page refreshes
 */
function getUserSessionId(): string {
  // Check if we already have a session ID in localStorage
  let sessionId = localStorage.getItem('matchmaking_session_id');
  
  // If not, create a new one and store it
  if (!sessionId) {
    // Generate a session ID that meets validation requirements (alphanumeric, underscores, hyphens only)
    // Use a simpler format that matches the backend validation pattern
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10).replace(/\./g, '');
    sessionId = `user_${timestamp}_${randomPart}`;
    localStorage.setItem('matchmaking_session_id', sessionId);
  }
  
  // Ensure the session ID meets the backend validation requirements
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
    console.warn('Invalid session ID format detected, regenerating...');
    localStorage.removeItem('matchmaking_session_id');
    return getUserSessionId(); // Recursive call to generate a valid ID
  }
  
  return sessionId;
}

/**
 * Join an existing lobby
 * @param lobbyId - ID of the lobby to join
 * @returns Updated lobby object with the player added
 */
export async function joinLobby(lobbyId: string): Promise<LobbyObject> {
  // Get persistent session ID for this user
  const sessionId = getUserSessionId();
  
  console.log(`Joining lobby ${lobbyId} with session ID: ${sessionId}`);
  
  try {
    const response = await apiRequest<any>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
    
    return convertLobbyFromBackend(response);
  } catch (error) {
    console.error(`Error joining lobby ${lobbyId}:`, error);
    throw error;
  }
}

/**
 * Leave a lobby
 * @param lobbyId - ID of the lobby to leave
 * @returns Updated lobby object
 */
export async function leaveLobby(lobbyId: string): Promise<LobbyObject> {
  try {
    // Get session ID for the current user
    const sessionId = getUserSessionId();
    
    console.log(`Attempting to leave lobby ${lobbyId} with session ID: ${sessionId}`);
    
    // The backend doesn't have a dedicated leave endpoint at this time
    // Instead, we'll handle this by updating the lobby status for now
    // In a production app, you would want a proper leave endpoint
    
    // For now, we'll just return the current lobby details
    const lobby = await getLobbyById(lobbyId);
    console.log(`User leaving lobby, current lobby state:`, lobby);
    
    return lobby;
  } catch (error) {
    console.error(`Error leaving lobby ${lobbyId}:`, error);
    return { id: lobbyId } as LobbyObject; // Return minimal lobby object on error
  }
}

/**
 * Update lobby status
 * @param lobbyId - ID of the lobby to update
 * @param status - New status ('open', 'full', 'in-game', 'closed')
 * @returns Updated lobby object
 */
export async function updateLobbyStatus(
  lobbyId: string,
  status: string
): Promise<LobbyObject> {
  // Convert frontend status to backend status
  const backendStatus = convertStatusToBackend(status);
  
  const response = await apiRequest<any>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: backendStatus }),
  });
  
  return convertLobbyFromBackend(response);
}
