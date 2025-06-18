import React from 'react';
import styles from './LoadingSpinner.module.css';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color,
  text
}) => {
  const sizeClass = styles[size];
  const customStyle = color ? { borderTopColor: color } : {};
  
  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div 
        className={`${styles.spinner} ${sizeClass}`} 
        style={customStyle} 
        aria-hidden="true"
      />
      {text && <p className={styles.text}>{text}</p>}
      <span className={styles.srOnly}>Loading{text ? `: ${text}` : ''}</span>
    </div>
  );
};
