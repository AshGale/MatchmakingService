import { useState, useCallback } from 'react';
import { UseErrorStateResult } from '../types';

/**
 * Custom hook for handling and displaying error states
 * @returns {UseErrorStateResult} Error state and operations
 */
export const useErrorState = (): UseErrorStateResult => {
  const [error, setErrorState] = useState<string | null>(null);
  
  /**
   * Set an error message
   * @param message - Error message to display
   */
  const setError = useCallback((message: string): void => {
    setErrorState(message);
  }, []);
  
  /**
   * Clear the current error
   */
  const clearError = useCallback((): void => {
    setErrorState(null);
  }, []);
  
  /**
   * Utility function to handle errors from various sources
   * @param error - Error object or string
   */
  const handleError = useCallback((error: any): void => {
    if (error instanceof Error) {
      setErrorState(error.message);
    } else if (typeof error === 'string') {
      setErrorState(error);
    } else if (error && typeof error === 'object' && 'message' in error) {
      setErrorState(String(error.message));
    } else {
      setErrorState('An unexpected error occurred');
    }
  }, []);
  
  return {
    error,
    setError,
    clearError,
    handleError,
  };
};

export default useErrorState;
