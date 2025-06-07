-- Performance Testing for Database Indexes
-- This script tests the effectiveness of the indexes in the matchmaking service database

-- Enable query execution time display
\timing on

-- Turn on execution plan analysis
EXPLAIN ANALYZE

-- 1. Test idx_lobbies_status index
-- This tests the performance of the get_lobbies_by_status function
SELECT * FROM lobbies WHERE status = 'waiting' ORDER BY created_at DESC LIMIT 100;

-- 2. Test idx_players_session_id index 
-- This tests lookup performance by session ID
SELECT * FROM players WHERE session_id = 'test-session-123' LIMIT 1;

-- 3. Test idx_players_lobby_join composite index
-- This tests performance when retrieving players in order from a specific lobby
SELECT * FROM players WHERE lobby_id = '00000000-0000-0000-0000-000000000001' ORDER BY join_order ASC;

-- 4. Test idx_games_status index
-- This tests filtering of games by their status
SELECT * FROM games WHERE status = 'active' LIMIT 100;

-- Additional Test: Test the behavior of queries without using indexes
-- Disable specific index temporarily to compare performance
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN ANALYZE
SELECT * FROM lobbies WHERE status = 'waiting' ORDER BY created_at DESC LIMIT 100;

-- Re-enable index scans
SET enable_indexscan = on;
SET enable_bitmapscan = on;

-- Test highly selective vs. non-selective queries
-- High selectivity (few rows returned, index should be used)
EXPLAIN ANALYZE
SELECT * FROM lobbies WHERE id = '00000000-0000-0000-0000-000000000001';

-- Low selectivity (many rows returned, index might not be used)
EXPLAIN ANALYZE
SELECT * FROM lobbies WHERE created_at > (CURRENT_TIMESTAMP - INTERVAL '1 month');
