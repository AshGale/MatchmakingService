import React, { useEffect, useMemo } from 'react';
import './App.css';
// Import components and hooks
import { ErrorMessage, LoadingSpinner } from './components';
import { FilterBar, LobbyList, LobbyObject as LobbyComponentObject } from './components/lobby';
import { CreateLobbyForm } from './components/forms';
import { useLobbyState } from './hooks/useLobbyState';
import { useFilterState } from './hooks/useFilterState';
import { LobbyObject } from './types';


function App() {
  // Get lobby state and operations from the custom hook
  const {
    lobbies,
    loading,
    error,
    fetchLobbies,
    joinLobby,
    createLobby
  } = useLobbyState();

  // Get filter state and operations from the custom hook
  const {
    activeFilter,
    setFilter,
    filterCounts,
    updateFilterCounts
  } = useFilterState();

  // Fetch lobbies on component mount
  useEffect(() => {
    fetchLobbies();
  }, [fetchLobbies]);

  // Update filter counts when lobbies change
  useEffect(() => {
    if (lobbies.length > 0) {
      updateFilterCounts(lobbies);
    }
  }, [lobbies, updateFilterCounts]);

  // Map between our backend LobbyObject format and the component's expected format
  const mappedLobbies = useMemo(() => {
    return lobbies.map(lobby => ({
      lobby_id: lobby.id,
      status: mapStatus(lobby.status),
      player_count: lobby.currentPlayers,
      max_players: lobby.maxPlayers,
      created_at: lobby.createdAt.toISOString()
    } as LobbyComponentObject));
  }, [lobbies]);
  
  // Helper function to map status values
  function mapStatus(status: string): 'waiting' | 'active' | 'finished' {
    switch (status) {
      case 'open':
        return 'waiting';
      case 'in-game':
        return 'active';
      case 'closed':
        return 'finished';
      case 'full':
        return 'waiting'; // Full lobbies are still in waiting state
      default:
        return 'waiting';
    }
  }

  // Handle joining a lobby
  const handleJoinLobby = async (lobbyId: string) => {
    await joinLobby(lobbyId);
  };

  // Handle creating a new lobby
  const handleCreateLobby = async (maxPlayers: number) => {
    await createLobby(maxPlayers);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Matchmaking Service</h1>
        <p>Welcome to the Matchmaking Service application</p>
      </header>
      <main className="App-main">
        <div className="App-container">
          <section className="sidebar">
            <CreateLobbyForm onSubmit={handleCreateLobby} loading={loading} error={error || undefined} />
          </section>
          
          <section className="content">
            {error && <ErrorMessage message={error} />}
            
            <FilterBar
              activeFilter={activeFilter}
              onFilterChange={setFilter}
              counts={{
                all: filterCounts.all || 0,
                waiting: filterCounts.open || 0,
                active: filterCounts['in-game'] || 0,
                finished: filterCounts.closed || 0
              }}
            />
            
            <LobbyList
              lobbies={mappedLobbies}
              onJoinLobby={handleJoinLobby}
              loading={loading}
              error={error || undefined}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
