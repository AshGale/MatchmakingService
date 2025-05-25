# MatchmakingService Test Suite

This directory contains all tests for the MatchmakingService application, organized by feature area.

## Test Structure

- `auth/` - Authentication system tests
- `lobby/` - Lobby and matchmaking API tests
- `sentry/` - Sentry integration tests
- `run-all-tests.js` - Main test runner script

## Running Tests

### Running All Tests

To run all tests in the test suite:

```bash
cd server/tests
npm install  # Only needed first time
npm test
```

Or directly:

```bash
cd server/tests
node run-all-tests.js
```

### Docker Container Management

The test runner automatically handles Docker container management:

1. If containers are already running, it will use them
2. If containers are not running, it will start them and wait 30 seconds for initialization
3. If it started the containers, it will automatically stop them after tests complete

You can also explicitly run with Docker management:

```bash
npm run test:docker
```

### Running Individual Test Groups

You can run individual test files directly:

```bash
node auth/auth.test.js
node auth/api-test.js
node lobby/test-lobby-api.js
node sentry/test-sentry.js
```

## Test Reports

The test runner will provide a summary report showing:
- Total test suites executed
- Number of passed tests
- Number of failed tests (with details)
- Number of skipped tests
- Total execution time

## Adding New Tests

When adding new tests:

1. Create test files in the appropriate feature directory
2. If adding a new test group, update the `testGroups` array in `run-all-tests.js`
3. Follow ES module syntax for all new tests
4. Ensure your test returns appropriate exit codes (0 for success, non-zero for failure)
