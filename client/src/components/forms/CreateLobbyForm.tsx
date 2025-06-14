import React, { useState } from 'react';
// Using inline styles for now to avoid module resolution issues
// Will be replaced with proper CSS modules when project setup is complete

interface CreateLobbyFormProps {
  onSubmit: (maxPlayers: number) => void;
  loading?: boolean;
  error?: string;
}

/**
 * Form component for creating new game lobbies
 * Allows selection of max player count (2-4 players)
 */
const CreateLobbyForm = ({ 
  onSubmit, 
  loading = false, 
  error 
}: CreateLobbyFormProps) => {
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: any) => {
    e.preventDefault();
    
    // Validate player count
    if (!maxPlayers) {
      setValidationError('Please select the number of players');
      return;
    }
    
    if (maxPlayers < 2 || maxPlayers > 4) {
      setValidationError('Player count must be between 2 and 4');
      return;
    }
    
    // Clear validation error if valid
    setValidationError('');
    
    // Submit form
    onSubmit(maxPlayers);
  };

  // Calculate error message from either props or local validation
  const errorMessage = error || validationError;
  
  return (
    <form 
      onSubmit={handleSubmit} 
      style={styles.formContainer}
      aria-labelledby="create-lobby-heading"
    >
      <h2 id="create-lobby-heading">Create New Lobby</h2>
      
      <fieldset disabled={loading} style={styles.fieldset}>
        <legend style={styles.legend}>Select number of players</legend>
        
        <div style={styles.radioGroup} role="radiogroup">
          {[2, 3, 4].map((count) => (
            <label key={count} style={styles.radioOption}>
              <input
                type="radio"
                name="playerCount"
                value={count}
                checked={maxPlayers === count}
                onChange={() => setMaxPlayers(count)}
                aria-describedby={errorMessage ? "error-message" : undefined}
              />
              <span>{count} Players</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Error message display */}
      {errorMessage && (
        <div 
          id="error-message" 
          style={styles.errorMessage} 
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={loading}
        style={styles.submitButton}
        aria-busy={loading ? "true" : "false"}
      >
        {loading ? 'Creating...' : 'Create Lobby'}
      </button>
    </form>
  );
};

// Inline styles to avoid module resolution issues
const styles = {
  formContainer: {
    maxWidth: '400px',
    padding: '1.5rem',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    margin: '0 auto'
  },
  fieldset: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '1rem',
    marginBottom: '1.5rem'
  },
  legend: {
    fontWeight: '600',
    fontSize: '0.9rem',
    padding: '0 0.5rem'
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem'
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease'
  },
  errorMessage: {
    color: '#dc3545',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.5rem',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderRadius: '4px',
    borderLeft: '3px solid #dc3545'
  },
  submitButton: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  }
};

export default CreateLobbyForm;
