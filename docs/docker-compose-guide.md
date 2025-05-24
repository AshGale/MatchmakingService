# Docker Compose Configuration Guide

## Project Structure
The MatchmakingService is containerized using Docker and orchestrated with Docker Compose. The setup includes three main services:

1. **Node.js Application Server (server)**
   - Built from the Dockerfile in the `/server` directory
   - Exposes port 3000
   - Connected to the PostgreSQL database

2. **PostgreSQL Database (postgres)**
   - Uses the official PostgreSQL Alpine image
   - Persistent data storage with Docker volumes
   - Runs database initialization scripts from `/database/init`

3. **Caddy Reverse Proxy (caddy)**
   - Handles HTTP/HTTPS traffic and routes to the Node.js server
   - Manages SSL certificates automatically
   - Provides security headers and basic caching

## Network Configuration
All services are connected via the `matchmaker-network` bridge network, allowing them to communicate using service names as hostnames.

## Volume Configuration
The Docker Compose setup includes three persistent volumes:
- `postgres_data`: Stores PostgreSQL database files
- `caddy_data`: Stores Caddy SSL certificates and other data
- `caddy_config`: Stores Caddy configuration

## Environment Variables
The following environment variables can be configured in a `.env` file:
- `NODE_ENV`: Application environment (development, production)
- `DB_PASSWORD`: PostgreSQL database password
- `JWT_SECRET`: Secret for JWT authentication
- `REFRESH_TOKEN_SECRET`: Secret for refresh tokens

## Running the Application

### Starting the Services
```bash
docker-compose up -d
```

### Viewing Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
```

### Stopping the Services
```bash
docker-compose down
```

### Rebuilding Services
```bash
docker-compose build
docker-compose up -d
```

## Development Workflow
For development:
1. Make changes to the server code
2. The Node.js container will automatically restart due to volume mounting
3. If you need to add dependencies, run `docker-compose exec server npm install <package>`

## Accessing the Services
- Web application: http://matchmaker.localhost
- API endpoints: http://matchmaker.localhost/api
- Database (from host): localhost:5433 (username: matchmaker, password: from .env)

## Troubleshooting
- Check logs with `docker-compose logs`
- Verify network connectivity with `docker-compose exec server ping postgres`
- Restart services with `docker-compose restart <service_name>`
- Rebuild from scratch with `docker-compose down -v && docker-compose up -d --build`
