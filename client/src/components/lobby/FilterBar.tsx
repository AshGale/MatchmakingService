import React from 'react';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  activeFilter: string; // 'all', 'waiting', 'active', 'finished'
  onFilterChange: (filter: string) => void;
  counts: {
    all: number;
    waiting: number;
    active: number;
    finished: number;
  };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activeFilter,
  onFilterChange,
  counts
}) => {
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'active', label: 'Active' },
    { value: 'finished', label: 'Finished' }
  ];

  // Handle filter selection
  const handleFilterClick = (filter: string) => {
    if (filter !== activeFilter) {
      onFilterChange(filter);
    }
  };

  return (
    <div className={styles.container} role="tablist" aria-label="Filter lobbies by status">
      {filterOptions.map(option => (
        <button
          key={option.value}
          className={`${styles.filterButton} ${activeFilter === option.value ? styles.active : ''}`}
          onClick={() => handleFilterClick(option.value)}
          role="tab"
          aria-selected={activeFilter === option.value}
          aria-controls={`panel-${option.value}`}
          id={`tab-${option.value}`}
        >
          <span className={styles.label}>{option.label}</span>
          <span className={styles.count}>{counts[option.value as keyof typeof counts]}</span>
        </button>
      ))}
    </div>
  );
};
