-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  turn_player_id UUID REFERENCES users(id),
  turn_started_at TIMESTAMP WITH TIME ZONE,
  game_state JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for games table
CREATE INDEX IF NOT EXISTS idx_games_lobby_id ON games(lobby_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_turn_player_id ON games(turn_player_id);

-- Create game_players table
CREATE TABLE IF NOT EXISTS game_players (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_elo INTEGER NOT NULL,
  final_elo INTEGER,
  result VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  position INTEGER NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (game_id, user_id)
);

-- Create indices for game_players table
CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);

-- Create game_history table
CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  move_data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for game_history table
CREATE INDEX IF NOT EXISTS idx_game_history_game_id_turn ON game_history(game_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_game_history_player_id ON game_history(player_id);

-- Create trigger for games.updated_at
CREATE OR REPLACE TRIGGER update_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE games IS 'Stores active and completed games';
COMMENT ON TABLE game_players IS 'Stores player information for each game';
COMMENT ON TABLE game_history IS 'Stores move history for each game';
