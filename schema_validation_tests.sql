-- Database Schema Validation Tests
-- This file contains tests to validate the database schema integrity, constraints, and functionality

-- Start transaction for tests
BEGIN;

-- Test 1: Verify lobbies table structure and constraints
DO $$ 
DECLARE
    valid_lobby_id UUID;
    invalid_max_players INTEGER;
BEGIN
    -- Test valid lobby creation
    INSERT INTO lobbies (max_players) VALUES (4) RETURNING id INTO valid_lobby_id;
    ASSERT FOUND, 'Failed to create a valid lobby';
    
    -- Test max_players constraint (too high)
    BEGIN
        invalid_max_players := 5;
        INSERT INTO lobbies (max_players) VALUES (invalid_max_players);
        ASSERT FALSE, 'Should not allow max_players > 4';
    EXCEPTION WHEN check_violation THEN
        -- Expected error
    END;
    
    -- Test max_players constraint (too low)
    BEGIN
        invalid_max_players := 1;
        INSERT INTO lobbies (max_players) VALUES (invalid_max_players);
        ASSERT FALSE, 'Should not allow max_players < 2';
    EXCEPTION WHEN check_violation THEN
        -- Expected error
    END;
    
    -- Clean up
    DELETE FROM lobbies WHERE id = valid_lobby_id;
END $$;

-- Test 2: Verify players table structure and constraints
DO $$ 
DECLARE
    test_lobby_id UUID;
    test_player_id UUID;
    duplicate_session VARCHAR;
BEGIN
    -- Create a test lobby
    INSERT INTO lobbies (max_players) VALUES (2) RETURNING id INTO test_lobby_id;
    
    -- Test valid player creation
    INSERT INTO players (session_id, lobby_id, join_order) 
    VALUES ('test_session_1', test_lobby_id, 1) 
    RETURNING id INTO test_player_id;
    ASSERT FOUND, 'Failed to create a valid player';
    
    -- Test unique session_id per lobby constraint
    BEGIN
        duplicate_session := 'test_session_1';
        INSERT INTO players (session_id, lobby_id, join_order)
        VALUES (duplicate_session, test_lobby_id, 2);
        ASSERT FALSE, 'Should not allow duplicate session_id in the same lobby';
    EXCEPTION WHEN unique_violation THEN
        -- Expected error
    END;
    
    -- Test different session_id in the same lobby (should work)
    INSERT INTO players (session_id, lobby_id, join_order)
    VALUES ('test_session_2', test_lobby_id, 2);
    ASSERT FOUND, 'Failed to create a second player with different session_id';
    
    -- Test invalid join_order (negative)
    BEGIN
        INSERT INTO players (session_id, lobby_id, join_order)
        VALUES ('test_session_3', test_lobby_id, -1);
        ASSERT FALSE, 'Should not allow negative join_order';
    EXCEPTION WHEN check_violation THEN
        -- Expected error
    END;
    
    -- Clean up
    DELETE FROM players WHERE lobby_id = test_lobby_id;
    DELETE FROM lobbies WHERE id = test_lobby_id;
END $$;

-- Test 3: Verify games table structure and constraints
DO $$ 
DECLARE
    test_lobby_id UUID;
    test_player_id UUID;
    test_game_id UUID;
BEGIN
    -- Create test lobby and player
    INSERT INTO lobbies (max_players, status) VALUES (2, 'active') RETURNING id INTO test_lobby_id;
    INSERT INTO players (session_id, lobby_id, join_order)
    VALUES ('test_session_1', test_lobby_id, 1)
    RETURNING id INTO test_player_id;
    
    -- Test valid game creation
    INSERT INTO games (lobby_id, current_turn_player_id)
    VALUES (test_lobby_id, test_player_id)
    RETURNING id INTO test_game_id;
    ASSERT FOUND, 'Failed to create a valid game';
    
    -- Test one game per lobby constraint
    BEGIN
        INSERT INTO games (lobby_id)
        VALUES (test_lobby_id);
        ASSERT FALSE, 'Should not allow multiple games for the same lobby';
    EXCEPTION WHEN unique_violation THEN
        -- Expected error
    END;
    
    -- Test finished game with timestamp
    UPDATE games
    SET status = 'finished', finished_at = CURRENT_TIMESTAMP
    WHERE id = test_game_id;
    ASSERT FOUND, 'Failed to update game to finished status';
    
    -- Test invalid timestamp (finished game without timestamp)
    BEGIN
        INSERT INTO games (lobby_id, status, finished_at)
        VALUES (gen_random_uuid(), 'finished', NULL);
        ASSERT FALSE, 'Should not allow finished game without finished_at timestamp';
    EXCEPTION WHEN check_violation THEN
        -- Expected error
    END;
    
    -- Test invalid timestamp (active game with finished timestamp)
    BEGIN
        INSERT INTO games (lobby_id, status, finished_at)
        VALUES (gen_random_uuid(), 'active', CURRENT_TIMESTAMP);
        ASSERT FALSE, 'Should not allow active game with finished_at timestamp';
    EXCEPTION WHEN check_violation THEN
        -- Expected error
    END;
    
    -- Clean up
    DELETE FROM games WHERE lobby_id = test_lobby_id;
    DELETE FROM players WHERE lobby_id = test_lobby_id;
    DELETE FROM lobbies WHERE id = test_lobby_id;
END $$;

-- Test 4: Verify referential integrity constraints
DO $$
DECLARE
    test_lobby_id UUID;
    test_player_id UUID;
    nonexistent_id UUID := gen_random_uuid();
BEGIN
    -- Create test lobby and player
    INSERT INTO lobbies (max_players) VALUES (2) RETURNING id INTO test_lobby_id;
    INSERT INTO players (session_id, lobby_id, join_order)
    VALUES ('test_session_1', test_lobby_id, 1)
    RETURNING id INTO test_player_id;
    
    -- Test player creation with non-existent lobby
    BEGIN
        INSERT INTO players (session_id, lobby_id, join_order)
        VALUES ('test_session_2', nonexistent_id, 1);
        ASSERT FALSE, 'Should not allow player with non-existent lobby_id';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected error
    END;
    
    -- Test game creation with non-existent lobby
    BEGIN
        INSERT INTO games (lobby_id)
        VALUES (nonexistent_id);
        ASSERT FALSE, 'Should not allow game with non-existent lobby_id';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected error
    END;
    
    -- Test game creation with non-existent player
    BEGIN
        INSERT INTO games (lobby_id, current_turn_player_id)
        VALUES (test_lobby_id, nonexistent_id);
        ASSERT FALSE, 'Should not allow game with non-existent player_id';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected error
    END;
    
    -- Clean up
    DELETE FROM players WHERE lobby_id = test_lobby_id;
    DELETE FROM lobbies WHERE id = test_lobby_id;
END $$;

-- Test 5: Verify cascade delete functionality
DO $$
DECLARE
    test_lobby_id UUID;
    test_player_id UUID;
    test_game_id UUID;
    player_count INTEGER;
    game_count INTEGER;
BEGIN
    -- Create test lobby, player and game
    INSERT INTO lobbies (max_players, status) VALUES (2, 'active') RETURNING id INTO test_lobby_id;
    INSERT INTO players (session_id, lobby_id, join_order)
    VALUES ('cascade_test', test_lobby_id, 1)
    RETURNING id INTO test_player_id;
    INSERT INTO games (lobby_id, current_turn_player_id)
    VALUES (test_lobby_id, test_player_id)
    RETURNING id INTO test_game_id;
    
    -- Delete the lobby
    DELETE FROM lobbies WHERE id = test_lobby_id;
    
    -- Verify cascade delete for players
    SELECT COUNT(*) INTO player_count
    FROM players WHERE lobby_id = test_lobby_id;
    ASSERT player_count = 0, 'Players not cascade deleted with lobby';
    
    -- Verify cascade delete for games
    SELECT COUNT(*) INTO game_count
    FROM games WHERE lobby_id = test_lobby_id;
    ASSERT game_count = 0, 'Games not cascade deleted with lobby';
END $$;

-- Test 6: Test stored procedures and functions
DO $$
DECLARE
    test_lobby_id UUID;
    test_player_id UUID;
    lobby_count INTEGER;
    player_count INTEGER;
    status_updated BOOLEAN;
BEGIN
    -- Test create_lobby function
    SELECT create_lobby(3) INTO test_lobby_id;
    ASSERT test_lobby_id IS NOT NULL, 'create_lobby function failed';
    
    -- Test invalid create_lobby call
    BEGIN
        PERFORM create_lobby(5);
        ASSERT FALSE, 'Should not allow creating lobby with invalid max_players';
    EXCEPTION WHEN OTHERS THEN
        -- Expected error
    END;
    
    -- Test add_player_to_lobby function
    SELECT add_player_to_lobby(test_lobby_id, 'func_test_session') INTO test_player_id;
    ASSERT test_player_id IS NOT NULL, 'add_player_to_lobby function failed';
    
    -- Verify lobby player count was updated
    SELECT player_count INTO player_count
    FROM lobbies WHERE id = test_lobby_id;
    ASSERT player_count = 1, 'Lobby player count not updated correctly';
    
    -- Test update_lobby_status function
    SELECT update_lobby_status(test_lobby_id, 'active') INTO status_updated;
    ASSERT status_updated = TRUE, 'update_lobby_status function failed';
    
    -- Test get_lobbies_by_status function
    SELECT COUNT(*) INTO lobby_count
    FROM get_lobbies_by_status('active');
    ASSERT lobby_count >= 1, 'get_lobbies_by_status function failed';
    
    -- Clean up
    DELETE FROM lobbies WHERE id = test_lobby_id;
END $$;

-- If all tests pass, we can commit the transaction
COMMIT;

-- Display success message
DO $$ BEGIN RAISE NOTICE 'All database schema validation tests passed successfully!'; END $$;
