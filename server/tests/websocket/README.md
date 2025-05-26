# WebSocket Tests

This directory contains tests for the WebSocket functionality of the MatchmakingService.

The tests validate:
- Authentication middleware
- Basic WebSocket server functionality
- Lobby event handling
- Game state event handling
- Connection management and error handling

## Running the tests

These tests are automatically included when running:

```bash
npm test
```

Or you can run them individually with:

```bash
node ../run-single-test.js websocket/websocket.test.js
```
