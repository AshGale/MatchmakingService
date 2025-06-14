export interface LobbyObject {
  id: string;
  maxPlayers: number;
  currentPlayers: number;
  status: string; // 'open', 'full', 'in-game', 'closed'
  createdAt: Date;
  updatedAt: Date;
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
