// c:\Users\ashga\Documents\Code\MatchmakingService\server\tests\sentry\test-sentry.js
import * as Sentry from '../../src/instrument.js';
import { exit } from 'process';

// Test capturing a basic error
function testSentryCapture() {
  try {
    // Intentionally throw an error
    throw new Error('Test Sentry Error');
  } catch (e) {
    console.log('Capturing test error in Sentry...');
    Sentry.captureException(e);
    console.log('Error captured. Check your Sentry dashboard to verify it was received.');
  }
}

// Test capturing a message
function testSentryMessage() {
  console.log('Sending test message to Sentry...');
  Sentry.captureMessage('Test message from MatchmakingService');
  console.log('Message sent. Check your Sentry dashboard to verify it was received.');
}

// Run the tests
testSentryCapture();
testSentryMessage();

// Allow time for Sentry to send events before exiting
setTimeout(() => {
  console.log('Test complete. Exiting...');
  exit(0);
}, 2000);
