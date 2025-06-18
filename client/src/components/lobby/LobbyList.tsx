import React from 'react';
import { LobbyCard, LobbyObject } from './LobbyCard';
import styles from './LobbyList.module.css';

export interface LobbyListProps {
  lobbies: LobbyObject[];
  onJoinLobby: (lobbyId: string) => void;
  loading?: boolean;
  error?: string;
}

// Loading placeholder for lobby cards
const LoadingSkeleton: React.FC = () => (
  <div className={styles.skeleton}>
    <div className={styles.skeletonHeader}>
      <div className={styles.skeletonStatus}></div>
      <div className={styles.skeletonDate}></div>
    </div>
    <div className={styles.skeletonContent}></div>
    <div className={styles.skeletonFooter}></div>
  </div>
);

export const LobbyList: React.FC<LobbyListProps> = ({
  lobbies,
  onJoinLobby,
  loading = false,
  error
}) => {
  // Function to handle retrying when an error occurs
  const handleRetry = () => {
    // In a real implementation, this would trigger a re-fetch of lobbies
    window.location.reload();
  };

  // Render loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Available Lobbies</h2>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Error Loading Lobbies</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (lobbies.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyContainer}>
          <h2 className={styles.emptyTitle}>No Lobbies Available</h2>
          <p className={styles.emptyMessage}>
            There are currently no game lobbies available. Create a new lobby or check back later.
          </p>
        </div>
      </div>
    );
  }

  // Render lobbies grid
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Available Lobbies</h2>
      <div className={styles.grid}>
        {lobbies.map(lobby => (
          <div className={styles.cardWrapper} key={lobby.lobby_id}>
            <LobbyCard
              lobby={lobby}
              onJoin={onJoinLobby}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
