// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\game-state\run-all-game-state-tests.js
import { runTests } from '../esm-test-runner.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run all game state tests
const testFiles = [
  path.join(__dirname, 'game-state.test.js')
];

runTests(testFiles, 'Game State Management Tests');
