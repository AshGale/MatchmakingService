-- Insert game history for active game
INSERT INTO game_history (
  id, game_id, turn_number, player_id, move_data, timestamp
)
VALUES
  ('a1b2c3d4-5e6f-4a8b-9c0d-e1f2a3b4c5d6', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 1, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,3],"type":"place"}', NOW() - INTERVAL '9 minutes'),
  ('b2c3d4e5-6f7a-8b9c-0d1e-f2a3b4c5d6e7', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 2, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,3],"type":"place"}', NOW() - INTERVAL '8 minutes'),
  ('c3d4e5f6-7a8b-9c0d-1e2f-a3b4c5d6e7f8', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 3, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,4],"type":"place"}', NOW() - INTERVAL '7 minutes'),
  ('d4e5f6a7-8b9c-0d1e-2f3a-b4c5d6e7f8a9', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 4, 
   (SELECT user_id FROM game_players WHERE game_id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,4],"type":"place"}', NOW() - INTERVAL '6 minutes')
ON CONFLICT DO NOTHING;

-- Insert game history for completed game (just a few moves)
INSERT INTO game_history (
  id, game_id, turn_number, player_id, move_data, timestamp
)
VALUES
  ('e5f6a7b8-9c0d-1e2f-3a4b-c5d6e7f8a9b0', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 1, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[3,3],"type":"place"}', NOW() - INTERVAL '1 hour 55 minutes'),
  ('f6a7b8c9-0d1e-2f3a-4b5c-d6e7f8a9b0c1', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 2, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 1), 
   '{"position":[4,4],"type":"place"}', NOW() - INTERVAL '1 hour 50 minutes'),
  ('a7b8c9d0-1e2f-3a4b-5c6d-e7f8a9b0c1d2', '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 3, 
   (SELECT user_id FROM game_players WHERE game_id = '1c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' AND position = 0), 
   '{"position":[5,3],"type":"place"}', NOW() - INTERVAL '1 hour 45 minutes')
ON CONFLICT DO NOTHING;
