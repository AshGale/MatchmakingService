import React from 'react';
import styles from './QuickJoinButton.module.css';

export interface QuickJoinButtonProps {
  onQuickJoin: () => void;
  loading?: boolean;
  disabled?: boolean;
  preferredPlayers?: number;
}

export const QuickJoinButton: React.FC<QuickJoinButtonProps> = ({
  onQuickJoin,
  loading = false,
  disabled = false,
  preferredPlayers = 4
}) => {
  const handleClick = () => {
    if (!disabled && !loading) {
      onQuickJoin();
    }
  };

  // Create aria-label based on component state
  const getAriaLabel = () => {
    if (disabled) {
      return 'Quick join unavailable';
    }
    if (loading) {
      return 'Finding a game...';
    }
    return `Quick join a game with ${preferredPlayers} players`;
  };

  return (
    <button
      className={`${styles.button} ${loading ? styles.loading : ''} ${disabled ? styles.disabled : ''}`}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={getAriaLabel()}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <span className={styles.loadingText}>Finding Game...</span>
        </>
      ) : (
        <>
          <span className={styles.icon} aria-hidden="true">🎮</span>
          <span className={styles.text}>Quick Join</span>
          {preferredPlayers && (
            <span className={styles.playerCount}>{preferredPlayers} players</span>
          )}
        </>
      )}
    </button>
  );
};
