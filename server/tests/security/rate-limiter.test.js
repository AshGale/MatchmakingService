// server/tests/security/rate-limiter.test.js
import * as chai from 'chai';
import chaiHttp from 'chai-http';
import { createServer } from 'http';
import express from 'express';
import { authLimiter, loginLimiter, registrationLimiter, apiLimiter } from '../../src/middleware/rateLimiter.js';

const { expect } = chai;
chai.use(chaiHttp);

describe('Rate Limiter Tests', () => {
  let app, server;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Test routes with different rate limiters
    app.post('/api/auth', authLimiter, (req, res) => res.status(200).json({ message: 'Auth route' }));
    app.post('/api/login', loginLimiter, (req, res) => res.status(200).json({ message: 'Login route' }));
    app.post('/api/register', registrationLimiter, (req, res) => res.status(200).json({ message: 'Registration route' }));
    app.get('/api/general', apiLimiter, (req, res) => res.status(200).json({ message: 'General API route' }));
    
    server = createServer(app);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('Auth Rate Limiter', () => {
    it('should allow requests under the limit', async () => {
      // Make several requests, but under the limit
      for (let i = 0; i < 3; i++) {
        const res = await chai.request(app).post('/api/auth');
        expect(res).to.have.status(200);
      }
    });

    it('should include rate limit headers', async () => {
      const res = await chai.request(app).post('/api/auth');
      
      expect(res.headers).to.have.property('ratelimit-limit');
      expect(res.headers).to.have.property('ratelimit-remaining');
      expect(res.headers).to.have.property('ratelimit-reset');
    });
  });

  describe('Login Rate Limiter', () => {
    it('should be more strict than general auth limiter', async () => {
      // This test checks that the limiter configurations are working as expected
      // We compare the remaining requests after one call to each endpoint
      
      const authRes = await chai.request(app).post('/api/auth');
      const loginRes = await chai.request(app).post('/api/login');
      
      // Login limiter should be more strict (lower remaining value)
      const authRemaining = parseInt(authRes.headers['ratelimit-remaining'], 10);
      const loginRemaining = parseInt(loginRes.headers['ratelimit-remaining'], 10);
      
      // We expect the login remaining to be less than auth remaining
      // because login limiter is set to 5 per hour while auth is 10 per 15 minutes
      expect(loginRemaining).to.be.lessThan(authRemaining);
    });
  });

  describe('Registration Rate Limiter', () => {
    it('should be more strict than general auth limiter', async () => {
      const authRes = await chai.request(app).post('/api/auth');
      const regRes = await chai.request(app).post('/api/register');
      
      const authRemaining = parseInt(authRes.headers['ratelimit-remaining'], 10);
      const regRemaining = parseInt(regRes.headers['ratelimit-remaining'], 10);
      
      // Registration limiter is set to 3 per hour while auth is 10 per 15 minutes
      expect(regRemaining).to.be.lessThan(authRemaining);
    });
  });

  describe('General API Rate Limiter', () => {
    it('should be less strict than auth limiters', async () => {
      const apiRes = await chai.request(app).get('/api/general');
      const authRes = await chai.request(app).post('/api/auth');
      
      const apiRemaining = parseInt(apiRes.headers['ratelimit-remaining'], 10);
      const authRemaining = parseInt(authRes.headers['ratelimit-remaining'], 10);
      
      // General API limiter is 100 per 15 minutes, which is higher than auth limiter
      expect(apiRemaining).to.be.greaterThan(authRemaining);
    });
  });
});
