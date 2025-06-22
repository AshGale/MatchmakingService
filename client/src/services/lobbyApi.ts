import { LobbyObject } from '../types';

/**
 * Base API configuration
 */
// Use relative paths for all API endpoints to ensure proxy works correctly
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
  // Log the raw lobby data to debug
  console.log('Raw lobby data from backend:', lobby);
  
  if (!lobby) {
    console.error('Received null or undefined lobby data from backend');
    // Return a default placeholder lobby object to avoid UI crashes
    const nowDate = new Date();
    return {
      id: 'invalid',
      lobby_id: 'invalid',
      status: 'waiting',
      currentPlayers: 0,
      player_count: 0,
      maxPlayers: 0,
      max_players: 0,
      createdAt: nowDate,  // Use Date object, not string
      created_at: nowDate.toISOString(),
      updatedAt: nowDate   // Add updatedAt required by the interface
    };
  }
  
  // Extract and safely convert player count values
  const currentPlayersValue = lobby.current_players || lobby.player_count || lobby.currentPlayers || 0;
  const maxPlayersValue = lobby.max_players || lobby.maxPlayers || 0;
  
  // Ensure numeric values
  const currentPlayers = Number(currentPlayersValue);
  const maxPlayers = Number(maxPlayersValue);
  
  // Handle date values
  let createdDate: Date;
  let dateStr = lobby.created_at || lobby.createdAt;
  
  // Convert to Date object
  if (!dateStr) {
    createdDate = new Date(); // Current date if none provided
  } else if (dateStr instanceof Date) {
    createdDate = dateStr; // Already a Date object
  } else {
    try {
      // Try to parse the date string
      createdDate = new Date(dateStr);
      
      // Check if valid date
      if (isNaN(createdDate.getTime())) {
        console.warn('Invalid date string received:', dateStr);
        createdDate = new Date(); // Fallback to current date
      }
    } catch (e) {
      console.error('Error parsing date:', e);
      createdDate = new Date(); // Fallback to current date
    }
  }
  
  // Map backend property names to frontend property names
  // Handle both snake_case and camelCase format
  return {
    // Keep the original properties for other fields not explicitly transformed
    ...lobby,
    
    // Ensure ID is properly mapped
    id: lobby.id || lobby.lobby_id || '',
    lobby_id: lobby.id || lobby.lobby_id || '',
    
    // Map status
    status: lobby.status && statusMapping[lobby.status] ? statusMapping[lobby.status] : lobby.status,
    
    // Map player counts and ensure they are numbers
    currentPlayers: currentPlayers,
    player_count: currentPlayers,
    
    // Map max players
    maxPlayers: maxPlayers,
    max_players: maxPlayers,
    
    // Handle dates - createdAt must be Date object to match the interface
    createdAt: createdDate,
    created_at: createdDate.toISOString(),
    updatedAt: new Date() // Default updatedAt to current date if not provided
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
 * Get or generate a persistent user session ID that meets backend validation requirements
 */
function getUserSessionId(): string {
  let sessionId = localStorage.getItem('matchmaking_session_id');
  
  // Validation regex pattern: alphanumeric, underscores, hyphens only, length 8-128
  const validSessionIdPattern = /^[a-zA-Z0-9_-]{8,128}$/;
  
  // If no session ID exists or the existing one is invalid, generate a new one
  if (!sessionId || !validSessionIdPattern.test(sessionId)) {
    // Create a session ID guaranteed to be valid by using only safe characters
    // Format: user_[timestamp]_[random string]
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10) + 
                      Math.random().toString(36).substring(2, 10);
    
    sessionId = `user_${timestamp}_${randomPart}`;
    
    // Ensure the ID isn't too long (max 128 chars)
    if (sessionId.length > 128) {
      sessionId = sessionId.substring(0, 128);
    }
    
    // Double-check validity (should always pass due to our construction method)
    if (!validSessionIdPattern.test(sessionId)) {
      // Fallback simple ID if somehow still invalid
      sessionId = `user_${Math.random().toString(36).substring(2, 10)}`;
    }
    
    console.log('Generated new session ID:', sessionId);
    localStorage.setItem('matchmaking_session_id', sessionId);
  }
  
  return sessionId;
}

/**
 * Join an existing lobby
 * @param lobbyId - ID of the lobby to join
 * @returns Updated lobby object with the player added
 */
export async function joinLobby(lobbyId: string): Promise<LobbyObject> {
  const sessionId = getUserSessionId();
  
  try {
    console.log(`Joining lobby ${lobbyId} with session ${sessionId}`);
    const response = await apiRequest<any>(`${LOBBIES_ENDPOINT}/${encodeURIComponent(lobbyId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
    return convertLobbyFromBackend(response);
  } catch (error) {
    console.error('Error joining lobby:', error);
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
