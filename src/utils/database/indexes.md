# Database Indexing Strategy for Matchmaking Service

## Overview

This document outlines the indexing strategy for the Matchmaking Service database, detailing the indexes that have been implemented to optimize query performance for common operations. PostgreSQL is used as the database engine, which provides B-tree indexes by default.

## Index Types in PostgreSQL

PostgreSQL supports several index types, each optimized for different query patterns:

1. **B-tree**: The default and most general-purpose index type. Optimal for equality and range queries.
2. **Hash**: Good for equality comparisons only, not for ranges or sorting.
3. **GiST**: Generalized Search Tree, useful for geometric data and full-text search.
4. **GIN**: Generalized Inverted Index, suitable for composite values like arrays and JSON.
5. **BRIN**: Block Range Index, good for large tables with naturally ordered data.
6. **SP-GiST**: Space-partitioned GiST, works well with non-balanced data structures.

## Current Indexes

### Lobbies Table

#### idx_lobbies_status
- **Columns**: `status`
- **Type**: B-tree
- **Purpose**: Optimizes filtering of lobbies by their status (waiting, active, finished)
- **Usage Scenarios**: Finding available lobbies, cleanup processes, filtering active games
- **Query Pattern**: `WHERE status = 'waiting'` in the `get_lobbies_by_status` function
- **Benefits**: Improves performance of the `get_lobbies_by_status` function and the `cleanup_expired_sessions` function that targets 'waiting' status

### Players Table

#### idx_players_session_id
- **Columns**: `session_id`
- **Type**: B-tree
- **Purpose**: Enables quick lookups of players by session ID
- **Usage Scenarios**: Authentication, reconnection to existing games, player profile lookups
- **Query Pattern**: `WHERE session_id = ?`
- **Benefits**: Speeds up player identification and authentication

#### idx_players_lobby_join
- **Columns**: (`lobby_id`, `join_order`)
- **Type**: B-tree
- **Purpose**: Optimizes querying of players in a specific lobby, ordered by their join sequence
- **Usage Scenarios**: Turn management, player ordering, game flow control
- **Query Pattern**: `WHERE lobby_id = ? ORDER BY join_order`
- **Benefits**: Essential for turn-based games to efficiently retrieve players in order

### Games Table

#### idx_games_status
- **Columns**: `status`
- **Type**: B-tree
- **Purpose**: Improves filtering of games by their status (active, finished)
- **Usage Scenarios**: Finding active games, reporting, analytics
- **Query Pattern**: `WHERE status = 'active'`
- **Benefits**: Speeds up queries that filter games by status, useful for matchmaking and statistics

## Index Analysis

### Performance Considerations

- All indexes are using B-trees, which is appropriate for the query patterns observed
- The composite index on players uses the most selective column first (lobby_id) followed by the ordering column
- No redundant indexes are present
- The indexed columns align well with the WHERE clauses in database functions

### Write Impact

All the indexes will have minimal impact on write performance:
- The lobbies and games tables typically have moderate write frequency
- The players table has higher write frequency but the benefits of indexed reads outweigh the write overhead

## Recommendations

1. **Monitor Index Usage**: Set up regular monitoring of index usage statistics to ensure indexes are being utilized effectively
2. **Consider Partial Indexes**: For the `idx_lobbies_status` index, consider a partial index on `status = 'waiting'` if that is the most common query pattern
3. **Index Maintenance**: Schedule regular index maintenance (REINDEX or VACUUM ANALYZE) during low-traffic periods
4. **Performance Testing**: Conduct load tests to verify index performance under realistic conditions

## Implementation Notes

All indexes are automatically created as part of the schema.sql deployment. No additional implementation work is required for the indexes themselves.
