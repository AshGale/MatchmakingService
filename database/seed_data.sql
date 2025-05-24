-- Insert test data for games
INSERT INTO games (
  id, lobby_id, status, started_at, completed_at, 
  turn_player_id, turn_started_at, game_state, created_at, updated_at
) 
SELECT 
  '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 
  (SELECT id FROM lobbies LIMIT 1), 
  'in_progress', 
  NOW() - INTERVAL '10 minutes', 
  NULL, 
  (SELECT id FROM users LIMIT 1), 
  NOW() - INTERVAL '1 minute', 
  '{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,"B","W",null,null,null],[null,null,null,"W","B",null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null]],"currentTurn":5}', 
  NOW() - INTERVAL '10 minutes', 
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM games WHERE id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');

-- Insert completed game
INSERT INTO games (
  id, lobby_id, status, started_at, completed_at, 
  turn_player_id, turn_started_at, game_state, created_at, updated_at
) 
SELECT 
  '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 
  (SELECT id FROM lobbies LIMIT 1 OFFSET 1), 
  'completed', 
  NOW() - INTERVAL '2 hours', 
  NOW() - INTERVAL '1 hour', 
  NULL, 
  NULL, 
  '{"board":[[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,"W","W","W",null,null],[null,null,null,"W","W","W",null,null],[null,null,null,"W","W","W",null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null]],"currentTurn":12}', 
  NOW() - INTERVAL '2 hours', 
  NOW() - INTERVAL '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');

-- Insert game players for active game
INSERT INTO game_players (
  game_id, user_id, initial_elo, final_elo, result, position, joined_at
)
SELECT
  '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  id,
  rating,
  NULL,
  'in_progress',
  ROW_NUMBER() OVER (ORDER BY id) - 1,
  NOW() - INTERVAL '10 minutes'
FROM users
LIMIT 2
ON CONFLICT DO NOTHING;

-- Insert game players for completed game
INSERT INTO game_players (
  game_id, user_id, initial_elo, final_elo, result, position, joined_at
)
SELECT
  '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  id,
  1000,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY id) = 1 THEN 1050 ELSE 950 END,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY id) = 1 THEN 'win' ELSE 'loss' END,
  ROW_NUMBER() OVER (ORDER BY id) - 1,
  NOW() - INTERVAL '2 hours'
FROM users
LIMIT 2
ON CONFLICT DO NOTHING;

-- Insert game history for active game
INSERT INTO game_history (
  id, game_id, turn_number, player_id, move_data, timestamp
)
VALUES
  ('a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 1, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,3],"type":"place"}', NOW() - INTERVAL '9 minutes'),
  ('b2c3d4e5-6f7g-8h9i-0j1k-l2m3n4o5p6q7', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 2, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,3],"type":"place"}', NOW() - INTERVAL '8 minutes'),
  ('c3d4e5f6-7g8h-9i0j-1k2l-m3n4o5p6q7r8', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 3, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,4],"type":"place"}', NOW() - INTERVAL '7 minutes'),
  ('d4e5f6g7-8h9i-0j1k-2l3m-n4o5p6q7r8s9', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 4, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,4],"type":"place"}', NOW() - INTERVAL '6 minutes')
ON CONFLICT DO NOTHING;

-- Insert game history for completed game (just a few moves)
INSERT INTO game_history (
  id, game_id, turn_number, player_id, move_data, timestamp
)
VALUES
  ('e5f6g7h8-9i0j-1k2l-3m4n-o5p6q7r8s9t0', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 1, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,3],"type":"place"}', NOW() - INTERVAL '1 hour 55 minutes'),
  ('f6g7h8i9-0j1k-2l3m-4n5o-p6q7r8s9t0u1', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 2, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,4],"type":"place"}', NOW() - INTERVAL '1 hour 50 minutes'),
  ('g7h8i9j0-1k2l-3m4n-5o6p-q7r8s9t0u1v2', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 3, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[5,3],"type":"place"}', NOW() - INTERVAL '1 hour 45 minutes')
ON CONFLICT DO NOTHING;
