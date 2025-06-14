import React from 'react';
import { CreateLobbyForm } from './';
import { useLobbyState } from '../../hooks';

/**
 * Example component showing how to use the CreateLobbyForm
 * with the useLobbyState hook
 */
const CreateLobbyFormExample = () => {
  const { createLobby, loading, error } = useLobbyState();
  
  const handleCreateLobby = async (maxPlayers: number) => {
    try {
      const lobbyId = await createLobby(maxPlayers);
      
      if (lobbyId) {
        console.log(`Successfully created lobby with ID: ${lobbyId}`);
        // Additional success handling here (e.g., show success message, redirect, etc.)
      }
    } catch (err) {
      console.error('Error creating lobby:', err);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Create a New Game Lobby</h1>
      <p>Select the number of players and create your lobby.</p>
      
      <CreateLobbyForm 
        onSubmit={handleCreateLobby}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default CreateLobbyFormExample;
