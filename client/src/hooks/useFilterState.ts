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
    const counts = {
      all: lobbies.length,
      open: 0,
      full: 0,
      'in-game': 0,
      closed: 0,
    };
    
    // Count lobbies by status
    lobbies.forEach(lobby => {
      // Safe type check for valid status values
      if (lobby.status === 'open' || lobby.status === 'full' || 
          lobby.status === 'in-game' || lobby.status === 'closed') {
        counts[lobby.status] += 1;
      }
    });
    
    setFilterCounts(counts as {all: number; open: number; full: number; 'in-game': number; closed: number;});
  }, []);
  
  return {
    activeFilter,
    setFilter,
    filterCounts,
    updateFilterCounts,
  };
};

export default useFilterState;
