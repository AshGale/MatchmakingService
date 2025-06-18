import React from 'react';
import styles from './ErrorMessage.module.css';

export interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  variant?: 'inline' | 'block' | 'toast';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  variant = 'block'
}) => {
  const variantClass = styles[variant];
  
  return (
    <div 
      className={`${styles.container} ${variantClass}`} 
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.iconContainer}>
        <svg 
          className={styles.icon} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        {onRetry && (
          <button 
            className={styles.retryButton}
            onClick={onRetry}
            aria-label="Retry"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
