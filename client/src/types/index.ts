export interface LobbyObject {
  id: string;
  lobby_id?: string;  // Backend format compatibility
  maxPlayers: number;
  max_players?: number; // Backend format compatibility
  currentPlayers: number;
  player_count?: number; // Backend format compatibility
  status: string; // 'open', 'full', 'in-game', 'closed' or 'waiting', 'active', 'finished'
  createdAt: Date;
  created_at?: string; // Backend format compatibility (ISO string)
  updatedAt: Date;
  updated_at?: string; // Backend format compatibility (ISO string)
  players?: Array<{
    id: string;
    username: string;
    joinedAt: Date;
  }>;
}

export interface UseLobbyStateResult {
  lobbies: LobbyObject[];
  selectedLobby: LobbyObject | null;
  fetchLobbies: (status?: string) => Promise<void>;
  fetchLobbyDetails: (id: string) => Promise<void>;
  createLobby: (maxPlayers: number) => Promise<string>;
  joinLobby: (lobbyId: string) => Promise<boolean>;
  leaveLobby: (lobbyId: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export interface UseFilterStateResult {
  activeFilter: string;
  setFilter: (filter: string) => void;
  filterCounts: Record<string, number>;
  updateFilterCounts: (lobbies: LobbyObject[]) => void;
}

export interface UseLoadingStateResult {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(promise: Promise<T>) => Promise<T>;
}

export interface UseErrorStateResult {
  error: string | null;
  setError: (message: string) => void;
  clearError: () => void;
  handleError: (error: any) => void;
}
