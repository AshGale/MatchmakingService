# Authentication System Tests

This directory contains automated and manual tests for the MatchmakingService authentication system.

## Test Files

- `auth.test.js` - Automated tests for the complete authentication flow
- `manual-test.js` - Interactive CLI tool for manual testing

## Running Automated Tests

The automated tests use SuperTest, Chai, and Mocha to verify all aspects of the authentication system:

```bash
# From the server directory
npm test -- tests/auth/auth.test.js
```

This will test:
- User registration with validation
- Login functionality
- Protected route access
- Token refresh mechanism
- Logout and token invalidation
- Password security (Argon2 hashing)

## Using the Manual Test CLI

The manual test script provides an interactive way to test the authentication system:

```bash
# From the server directory
node tests/auth/manual-test.js
```

The CLI menu allows you to:
1. Register a new user
2. Login with credentials
3. Access the protected user profile
4. Refresh your access token
5. Logout

## Prerequisites

Make sure the following services are running:
- PostgreSQL database (available via Docker)
- Node.js server (available via Docker)

## Docker Environment

The easiest way to test is to use the Docker environment:

```bash
# From the project root
docker-compose up -d
```

## Environment Variables

The tests will use the following environment variables if present:
- `API_URL` - Base URL for the API (default: http://localhost:3000/api)
- `JWT_SECRET` - Secret for JWT tokens
- `REFRESH_TOKEN_SECRET` - Secret for refresh tokens

## Test User Cleanup

The automated tests will automatically clean up any test users created during testing.
