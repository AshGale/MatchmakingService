import { useState, useCallback } from 'react';
import { UseLoadingStateResult } from '../types';

/**
 * Custom hook for managing loading states for async operations
 * @returns {UseLoadingStateResult} Loading state and operations
 */
export const useLoadingState = (): UseLoadingStateResult => {
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Set loading state to true
   */
  const startLoading = useCallback((): void => {
    setIsLoading(true);
  }, []);
  
  /**
   * Set loading state to false
   */
  const stopLoading = useCallback((): void => {
    setIsLoading(false);
  }, []);
  
  /**
   * Utility function to handle loading state around a promise
   * @param promise - Promise to execute with loading state
   * @returns Result of the promise
   */
  const withLoading = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      try {
        startLoading();
        return await promise;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );
  
  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
  };
};

export default useLoadingState;
