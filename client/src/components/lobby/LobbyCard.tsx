import React from 'react';
import styles from './LobbyCard.module.css';
import { formatDistanceToNow } from 'date-fns';

// Lobby object type definition as mentioned in task
export interface LobbyObject {
  id: string;
  lobby_id?: string; // For compatibility with transformed objects
  status: 'waiting' | 'active' | 'finished';
  currentPlayers: number;
  player_count?: number; // For compatibility with transformed objects
  maxPlayers: number;
  max_players?: number; // For compatibility with transformed objects
  createdAt: string;
  created_at?: string; // For compatibility with transformed objects
}

// Props interface as defined in the task
export interface LobbyCardProps {
  lobby: LobbyObject;
  onJoin: (lobbyId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  return <span className={`${styles.statusIndicator} ${styles[status]}`}>{status}</span>;
};

export const LobbyCard: React.FC<LobbyCardProps> = ({
  lobby,
  onJoin,
  loading = false,
  disabled = false
}) => {
  const { id, status, currentPlayers, maxPlayers, createdAt } = lobby;
  
  // Format the date for relative time display
  const formattedDate = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    } catch (e) {
      return 'unknown time';
    }
  }, [createdAt]);
  
  // Check if the lobby is full
  const isFull = currentPlayers >= maxPlayers;
  
  // Determine if join button should be disabled
  const isJoinDisabled = disabled || loading || isFull || status !== 'waiting';
  
  const handleJoin = () => {
    if (!isJoinDisabled) {
      onJoin(id);
    }
  };
  
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <StatusIndicator status={status} />
        <span className={styles.createdAt}>Created {formattedDate}</span>
      </div>
      
      <div className={styles.content}>
        <div className={styles.playerCount}>
          <span className={styles.count}>{currentPlayers}/{maxPlayers}</span>
          <span className={styles.playersLabel}>players</span>
        </div>
      </div>
      
      <div className={styles.footer}>
        <button 
          className={styles.joinButton} 
          onClick={handleJoin}
          disabled={isJoinDisabled}
        >
          {loading ? (
            <span className={styles.loadingIndicator}>Joining...</span>
          ) : isFull ? (
            'Full'
          ) : status !== 'waiting' ? (
            status === 'active' ? 'In Progress' : 'Finished'
          ) : (
            'Join'
          )}
        </button>
      </div>
    </div>
  );
};
