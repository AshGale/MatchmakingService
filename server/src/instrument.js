import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: "https://1da35478488e47ec9286acd258d556d9@o4509340674228224.ingest.de.sentry.io/4509340681371728",
  
  // Setting this option to true will send default PII data to Sentry
  sendDefaultPii: true,
  
  // Set sampling rates for transactions and profiles
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  profilesSampleRate: 1.0, // Capture 100% of transactions for profiling
});

export * from '@sentry/node';
