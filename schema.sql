-- Matchmaking Service Database Schema
-- This schema defines tables for lobby management, player tracking, and game sessions

-- Create type for lobby status
CREATE TYPE lobby_status AS ENUM ('waiting', 'active', 'finished');

-- Create type for game status
CREATE TYPE game_status AS ENUM ('active', 'finished');

-- Lobbies Table
-- Stores information about game lobbies where players can join
CREATE TABLE lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_count INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL,
    status lobby_status NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_max_players CHECK (max_players BETWEEN 2 AND 4),
    CONSTRAINT chk_player_count CHECK (player_count >= 0 AND player_count <= max_players)
);

-- Create index on status for filtering queries
CREATE INDEX idx_lobbies_status ON lobbies (status);

-- Players Table
-- Tracks players who have joined lobbies
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) NOT NULL,
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    join_order INTEGER NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unq_session_lobby UNIQUE (session_id, lobby_id),
    CONSTRAINT chk_join_order CHECK (join_order > 0)
);

-- Create indexes
CREATE INDEX idx_players_session_id ON players (session_id);
CREATE INDEX idx_players_lobby_join ON players (lobby_id, join_order);

-- Games Table
-- Represents active game sessions that have been started from lobbies
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    status game_status NOT NULL DEFAULT 'active',
    current_turn_player_id UUID REFERENCES players(id),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unq_lobby_game UNIQUE (lobby_id),
    CONSTRAINT chk_finished_timestamp CHECK (
        (status = 'finished' AND finished_at IS NOT NULL) OR 
        (status = 'active' AND finished_at IS NULL)
    )
);

-- Create index for game status lookups
CREATE INDEX idx_games_status ON games (status);

-- Database Functions/Stored Procedures

-- Create a new lobby
CREATE OR REPLACE FUNCTION create_lobby(max_players_count INTEGER)
RETURNS UUID AS $$
DECLARE
    new_lobby_id UUID;
BEGIN
    IF max_players_count < 2 OR max_players_count > 4 THEN
        RAISE EXCEPTION 'Max players must be between 2 and 4';
    END IF;
    
    INSERT INTO lobbies (max_players) 
    VALUES (max_players_count)
    RETURNING id INTO new_lobby_id;
    
    RETURN new_lobby_id;
END;
$$ LANGUAGE plpgsql;

-- Add a player to a lobby
CREATE OR REPLACE FUNCTION add_player_to_lobby(lobby_id_param UUID, session_id_param VARCHAR)
RETURNS UUID AS $$
DECLARE
    player_count_current INTEGER;
    max_players_allowed INTEGER;
    next_join_order INTEGER;
    new_player_id UUID;
    lobby_status_current lobby_status;
BEGIN
    -- Get current lobby state
    SELECT player_count, max_players, status
    INTO player_count_current, max_players_allowed, lobby_status_current
    FROM lobbies
    WHERE id = lobby_id_param;
    
    -- Check if lobby exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lobby not found';
    END IF;
    
    -- Check if lobby is in waiting state
    IF lobby_status_current != 'waiting' THEN
        RAISE EXCEPTION 'Cannot join a lobby that is not in waiting state';
    END IF;
    
    -- Check if lobby is full
    IF player_count_current >= max_players_allowed THEN
        RAISE EXCEPTION 'Lobby is full';
    END IF;
    
    -- Calculate join order (current player count + 1)
    next_join_order := player_count_current + 1;
    
    -- Insert new player
    INSERT INTO players (session_id, lobby_id, join_order)
    VALUES (session_id_param, lobby_id_param, next_join_order)
    RETURNING id INTO new_player_id;
    
    -- Update lobby player count
    UPDATE lobbies
    SET player_count = player_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = lobby_id_param;
    
    RETURN new_player_id;
END;
$$ LANGUAGE plpgsql;

-- Update lobby status
CREATE OR REPLACE FUNCTION update_lobby_status(lobby_id_param UUID, new_status lobby_status)
RETURNS BOOLEAN AS $$
DECLARE
    current_status lobby_status;
BEGIN
    -- Get current status
    SELECT status INTO current_status
    FROM lobbies
    WHERE id = lobby_id_param;
    
    -- Check if lobby exists
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Validate status transition
    IF (current_status = 'finished') THEN
        RETURN FALSE; -- Cannot change status once finished
    END IF;
    
    -- Update the status
    UPDATE lobbies
    SET status = new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = lobby_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get lobbies by status
CREATE OR REPLACE FUNCTION get_lobbies_by_status(status_param lobby_status)
RETURNS SETOF lobbies AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM lobbies
    WHERE status = status_param
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired sessions (for lobbies that have been inactive for a specified time)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions(timeout_minutes INTEGER)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Update status of expired lobbies to 'finished'
    UPDATE lobbies
    SET status = 'finished',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'waiting'
    AND updated_at < (CURRENT_TIMESTAMP - (timeout_minutes || ' minutes')::interval)
    RETURNING count(*) INTO affected_count;
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;
