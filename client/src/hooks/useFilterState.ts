import { useState, useCallback } from 'react';
import { LobbyObject, UseFilterStateResult } from '../types';

/**
 * Custom hook for managing filter state and operations
 * @returns {UseFilterStateResult} Filter state and operations
 */
export const useFilterState = (): UseFilterStateResult => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    open: 0,
    full: 0,
    'in-game': 0,
    closed: 0,
  });
  
  /**
   * Update the active filter
   * @param filter - New filter to apply
   */
  const setFilter = useCallback((filter: string): void => {
    setActiveFilter(filter);
  }, []);
  
  /**
   * Calculate and update filter counts based on provided lobbies
   * @param lobbies - Array of lobby objects
   */
  const updateFilterCounts = useCallback((lobbies: LobbyObject[]): void => {
    // Initialize counts
    const counts: Record<string, number> = {
      all: lobbies.length,
      open: 0,
      full: 0,
      'in-game': 0,
      closed: 0,
    };
    
    // Count lobbies by status
    lobbies.forEach(lobby => {
      if (counts[lobby.status] !== undefined) {
        counts[lobby.status] += 1;
      }
    });
    
    setFilterCounts(counts);
  }, []);
  
  return {
    activeFilter,
    setFilter,
    filterCounts,
    updateFilterCounts,
  };
};

export default useFilterState;
