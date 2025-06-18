# MatchmakingService

## Project Overview

The MatchmakingService is a comprehensive API service designed to facilitate game matchmaking in multiplayer environments. It provides a robust backend solution for managing player lobbies, tracking player sessions, and coordinating game instances.

### Key Features

- **Dynamic Lobby Management**: Create and manage game lobbies with configurable player limits (2-4 players)
- **Player Session Tracking**: Associate players with unique session IDs and track their participation
- **Automatic Matchmaking**: Quick-join functionality for players to find available games
- **Game State Management**: Track game status, player turns, and game completion
- **RESTful API**: Well-structured API endpoints for client integration
- **Scalable Architecture**: Built with modern Node.js practices for reliability and performance
- **Comprehensive Logging**: Detailed logging for monitoring and debugging

## Prerequisites

### Required Software

- **Node.js** (≥18.0.0)
- **PostgreSQL** (≥12.0)
- **npm** (≥6.0.0) or **yarn** (≥1.22.0)

### System Requirements

- **Memory**: 2GB RAM minimum recommended
- **Disk Space**: 500MB for application and dependencies
- **Operating System**: Cross-platform (Windows, macOS, Linux)

### Database Requirements

- PostgreSQL database with CREATE privileges
- User with appropriate permissions to create tables and functions

### Development Tools (Optional)

- PostgreSQL client (pgAdmin, DBeaver, etc.)
- API testing tool (Postman, Insomnia, etc.)
- Node.js IDE or code editor (VSCode recommended)

## Installation

### Clone the Repository

```bash
git clone https://github.com/your-username/MatchmakingService.git
cd MatchmakingService
```

### Install Dependencies

```bash
npm install
```

Or if using Yarn:

```bash
yarn install
```

### Database Setup

1. Create a PostgreSQL database for the application:

```bash
psql -U postgres -c "CREATE DATABASE matchmaking_service;"
```

2. Run the database schema setup script:

```bash
psql -U postgres -d matchmaking_service -f schema.sql
```

3. (Optional) Run the validation tests:

```bash
psql -U postgres -d matchmaking_service -f schema_validation_tests.sql
```

### Troubleshooting Common Installation Issues

- **Node Version Issues**: Ensure your Node.js version is at least 18.0.0 using `node -v`
- **PostgreSQL Connection Issues**: Verify your PostgreSQL service is running and credentials are correct
- **Permission Denied**: Check file permissions if running into access issues

## Environment Configuration

### Setting up Environment Variables

1. Create a `.env` file based on the example template:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your specific configuration values:

```env
# API Keys (Required to enable respective provider)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
MISTRAL_API_KEY=your_mistral_key_here
XAI_API_KEY=YOUR_XAI_KEY_HERE
AZURE_OPENAI_API_KEY=your_azure_key_here
```

### Database Configuration

Add the following database connection parameters to your `.env` file:

```env
# Database Connection
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=matchmaking_service
PG_USER=postgres
PG_PASSWORD=your_password
```

### Server Configuration

Add server settings to your `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### Securing Environment Variables

- Never commit the `.env` file to version control
- Rotate API keys regularly
- Use different credentials for development and production environments
- Consider using a secrets management service for production deployments

## Database Setup

### Database Schema Overview

The database schema consists of three main tables:

1. **Lobbies** - Stores information about game lobbies
   - Primary key: `id` (UUID)
   - Tracks player count, maximum players, and lobby status
   - Status can be: 'waiting', 'active', or 'finished'

2. **Players** - Tracks players who have joined lobbies
   - Primary key: `id` (UUID)
   - References `lobby_id` with foreign key constraint
   - Stores `session_id` and `join_order` 

3. **Games** - Represents active game sessions
   - Primary key: `id` (UUID)
   - References `lobby_id` with foreign key constraint
   - Tracks current turn and game status

The schema also includes several stored procedures for common operations:

- `create_lobby(max_players_count INTEGER)` 
- `add_player_to_lobby(lobby_id_param UUID, session_id_param VARCHAR)`
- `update_lobby_status(lobby_id_param UUID, new_status lobby_status)`
- `get_lobbies_by_status(status_param lobby_status)`
- `cleanup_expired_sessions(timeout_minutes INTEGER)`

### Setting Up the Database

1. **Create the Database**

```bash
psql -U postgres -c "CREATE DATABASE matchmaking_service;"
```

2. **Apply the Schema**

```bash
psql -U postgres -d matchmaking_service -f schema.sql
```

3. **Run Schema Validation Tests**

```bash
psql -U postgres -d matchmaking_service -f schema_validation_tests.sql
```

### Database Maintenance

- The `cleanup_expired_sessions` function can be run periodically to clean up inactive lobbies
- Regular backups are recommended for production environments
- Monitor database size and performance as usage grows

## Running the Application

### Starting the Backend Server

To start the backend server in development mode with auto-reload:

```bash
npm run dev
```

To start the backend server in production mode:

```bash
npm start
```

The server will run on the port specified in your `.env` file (defaults to 3000).

### Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server in production mode |
| `npm run dev` | Start the server with nodemon for development |
| `npm test` | Run the test suite |

### Running the Frontend

The frontend is a React TypeScript application located in the `client` directory. The frontend runs on port 3006 to avoid conflicts with the backend server running on port 3000.

To start the frontend development server:

```bash
# Navigate to the client directory
cd client

# Install dependencies (first time only)
npm install

# Start the development server
npm start
```

Alternatively, you can use the provided scripts to start both frontend and backend:

```bash
# On Windows
.\start.cmd

# On Unix/Linux/macOS
./start.sh
```

The frontend will be accessible at http://localhost:3006

### Health Check

To verify the server is running correctly, access the health check endpoint:

```
GET /api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-06-18T15:11:43.000Z"
}
```

## API Documentation

### Lobbies

#### Create a Lobby

```
POST /api/lobbies
```

**Request Body**:
```json
{
  "max_players": 4 // Number between 2-4
}
```

**Response**:
```json
{
  "lobby_id": "uuid",
  "status": "waiting",
  "player_count": 0,
  "max_players": 4
}
```

#### List Lobbies

```
GET /api/lobbies?status=waiting
```

**Query Parameters**:
- `status` (optional): Filter by lobby status ('waiting', 'active', 'finished')

**Response**:
```json
{
  "lobbies": [
    {
      "lobby_id": "uuid",
      "status": "waiting",
      "player_count": 1,
      "max_players": 4,
      "created_at": "2025-06-18T15:06:43.000Z"
    }
  ],
  "total_count": 1
}
```

#### Get Lobby Details

```
GET /api/lobbies/{lobby_id}
```

**Response**:
```json
{
  "lobby": {
    "lobby_id": "uuid",
    "status": "waiting",
    "player_count": 2,
    "max_players": 4,
    "created_at": "2025-06-18T14:59:43.000Z",
    "updated_at": "2025-06-18T15:01:43.000Z"
  },
  "players": [
    {
      "player_id": "uuid",
      "session_id": "session1",
      "join_order": 1,
      "joined_at": "2025-06-18T15:00:43.000Z"
    }
  ]
}
```

#### Join a Lobby

```
POST /api/lobbies/{lobby_id}/join
```

**Request Body**:
```json
{
  "session_id": "unique-session-identifier"
}
```

**Response**:
```json
{
  "success": true,
  "player_id": "uuid",
  "lobby": {
    "lobby_id": "uuid",
    "status": "waiting",
    "player_count": 3,
    "max_players": 4
  }
}
```

#### Quick Join

```
POST /api/quick-join
```

**Request Body**:
```json
{
  "session_id": "unique-session-identifier",
  "preferred_players": 4 // Optional, default is 4
}
```

**Response**:
```json
{
  "lobby_id": "uuid",
  "created_new": false // Whether a new lobby was created
}
```

#### Update Lobby Status

```
PUT /api/lobbies/{lobby_id}/status
```

**Request Body**:
```json
{
  "status": "active", // 'active' or 'finished'
  "player_id": "uuid" // Required for some transitions
}
```

**Response**:
```json
{
  "success": true,
  "lobby": {
    "lobby_id": "uuid",
    "status": "active",
    "player_count": 3,
    "max_players": 4,
    "updated_at": "2025-06-18T15:11:43.000Z"
  }
}
```
