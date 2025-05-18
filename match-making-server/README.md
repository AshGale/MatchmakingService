# Match-Making Server

A Node.js-based match-making server for turn-based games, built with WebSockets, JWT authentication, and PostgreSQL.

## Features

- User registration and authentication with Argon2 and JWT
- Lobby creation and management
- Real-time updates with WebSockets
- Elo-based match-making
- Turn-based game management with time limits
- Docker containerized deployment

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL (provided via Docker)

## Getting Started

### Environment Setup

1. Clone the repository
2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Modify environment variables as needed

### Running with Docker

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Node.js application server
- Caddy reverse proxy

### Database Initialization

The database migrations will run automatically on container startup, but you can also run them manually:

```bash
docker exec -it matchmaker-server npm run migrate
```

To seed the database with sample data:

```bash
docker exec -it matchmaker-server npm run seed
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

### Lobby Endpoints

- `GET /api/lobbies` - Get list of lobbies
- `POST /api/lobbies` - Create a new lobby
- `GET /api/lobbies/:id` - Get lobby by ID
- `POST /api/lobbies/:id/join` - Join a lobby
- `POST /api/lobbies/:id/leave` - Leave a lobby
- `POST /api/lobbies/:id/start` - Start game from lobby
- `POST /api/lobbies/:id/invite` - Invite a player to a private lobby

### Game Endpoints

- `GET /api/games` - Get list of active games
- `GET /api/games/:id` - Get game by ID
- `POST /api/games/:id/move` - Submit a move
- `POST /api/games/:id/forfeit` - Forfeit a game
- `POST /api/games/quick-match` - Request a quick match
- `DELETE /api/games/quick-match` - Cancel a quick match request
- `POST /api/games/invite` - Send a game invitation
- `POST /api/games/invite/:id/respond` - Respond to a game invitation

### User Endpoints

- `GET /api/users` - Get list of users (paginated)
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/:id/stats` - Get user game statistics
- `GET /api/users/:id/history` - Get user's game history
- `PATCH /api/users/me` - Update current user's profile

## WebSocket Events

### Connection Events

- `connection` - When a user connects
- `disconnect` - When a user disconnects
- `initial_state` - Initial state sent to user upon connection
- `user_connected` - When another user connects
- `user_disconnected` - When another user disconnects

### Lobby Events

- `create_lobby` - Create a new lobby
- `lobby_created` - When a new lobby is created
- `join_lobby` - Join an existing lobby
- `player_joined_lobby` - When a player joins a lobby
- `lobby_updated` - When a lobby is updated
- `leave_lobby` - Leave a lobby
- `player_left_lobby` - When a player leaves a lobby
- `lobby_deleted` - When a lobby is deleted
- `start_game` - Start a game from a lobby

### Match-making Events

- `quick_match` - Request a quick match
- `cancel_quick_match` - Cancel a quick match request
- `send_invitation` - Send a game invitation
- `game_invitation` - When receiving a game invitation
- `respond_to_invitation` - Respond to a game invitation
- `invitation_declined` - When an invitation is declined

### Game Events

- `game_started` - When a game starts
- `submit_move` - Submit a move
- `game_updated` - When the game state changes
- `turn_expired` - When a player's turn time expires
- `forfeit_game` - Forfeit a game
- `game_ended` - When a game ends
- `rating_updated` - When a player's rating changes

## Project Structure

```
.
├── caddy/
│   └── Caddyfile           # Caddy reverse proxy configuration
├── database/
│   ├── migrations/         # Database migrations
│   └── seeds/              # Database seed data
├── logs/                   # Log files
├── server/
│   ├── src/
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── app.js              # Express application
│   ├── db.js               # Database configuration
│   ├── index.js            # Application entry point
│   └── websockets.js       # WebSocket configuration
├── .env.example            # Example environment variables
├── docker-compose.yml      # Docker Compose configuration
├── knexfile.js             # Knex.js configuration
└── README.md               # Project documentation
```

## Development

### Running Locally

```bash
cd server
npm install
npm run dev
```

### Running Tests

```bash
cd server
npm test
```

## Security Considerations

- JWT tokens are used for authentication
- Passwords are hashed using Argon2
- Express rate limiting is implemented for auth endpoints
- All database queries use parameterized statements
- Helmet.js is used for setting secure HTTP headers

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Deployment

The application is designed to be deployed on a Windows 10 laptop with standard user access:

1. Install Docker Desktop for Windows
2. Clone the repository
3. Create and configure the `.env` file
4. Run `docker-compose up -d`
5. Access the application at http://localhost