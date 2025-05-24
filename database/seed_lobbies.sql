-- Insert test lobbies
INSERT INTO lobbies (
  id, name, creator_id, max_players, is_private, status, created_at
)
SELECT 
  'a7e31f3d-23c5-45b7-8cdc-62c59e3a5c7d',
  'Public Game Lobby',
  id,
  2,
  false,
  'waiting',
  NOW() - INTERVAL '30 minutes'
FROM users
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lobbies (
  id, name, creator_id, max_players, is_private, status, created_at
)
SELECT 
  'b8c59d4e-6a1f-4d3b-b2e7-5f91c3a8d70b',
  'Private Game Lobby',
  id,
  2,
  true,
  'waiting',
  NOW() - INTERVAL '20 minutes'
FROM users
OFFSET 1
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert lobby players
INSERT INTO lobby_players (
  lobby_id, user_id, joined_at
)
SELECT
  'a7e31f3d-23c5-45b7-8cdc-62c59e3a5c7d',
  id,
  NOW() - INTERVAL '30 minutes'
FROM users
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lobby_players (
  lobby_id, user_id, joined_at
)
SELECT
  'b8c59d4e-6a1f-4d3b-b2e7-5f91c3a8d70b',
  id,
  NOW() - INTERVAL '20 minutes'
FROM users
OFFSET 1
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert lobby invitation
INSERT INTO lobby_invitations (
  id, lobby_id, user_id, invited_by, invited_at, expires_at
)
SELECT
  'c7d21e5f-3a4c-4b5d-9c6e-8d7f9a0b1c2d',
  'b8c59d4e-6a1f-4d3b-b2e7-5f91c3a8d70b',
  u1.id,
  u2.id,
  NOW() - INTERVAL '15 minutes',
  NOW() + INTERVAL '45 minutes'
FROM 
  users u1,
  users u2
WHERE 
  u1.id <> u2.id
LIMIT 1
ON CONFLICT DO NOTHING;
