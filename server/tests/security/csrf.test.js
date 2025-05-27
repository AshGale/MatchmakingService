// server/tests/security/csrf.test.js
import * as chai from 'chai';
import chaiHttp from 'chai-http';
import { createServer } from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { csrfProtection, generateToken, provideCsrfToken } from '../../src/middleware/csrf.js';

const { expect } = chai;
chai.use(chaiHttp);

describe('CSRF Protection Tests', () => {
  let app, server;
  const userId = '12345';
  
  // Create mock auth middleware
  const mockAuth = (req, res, next) => {
    // Simulate authenticated user
    req.user = { id: userId, username: 'testuser' };
    next();
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Public route - no CSRF needed
    app.get('/public', (req, res) => res.json({ message: 'Public route' }));
    
    // Get token route - provides CSRF token
    app.get('/get-token', mockAuth, provideCsrfToken, (req, res) => {
      res.json({ message: 'Token provided in header' });
    });
    
    // Protected route - requires CSRF token
    app.post('/protected', mockAuth, csrfProtection, (req, res) => {
      res.json({ message: 'Protected route access successful' });
    });
    
    // Another protected route
    app.put('/protected-resource', mockAuth, csrfProtection, (req, res) => {
      res.json({ message: 'Resource updated' });
    });
    
    server = createServer(app);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('CSRF Token Generation', () => {
    it('should generate a valid CSRF token', () => {
      const token = generateToken(userId);
      expect(token).to.be.a('string');
      expect(token).to.have.length(64); // 32 bytes in hex = 64 chars
    });
  });

  describe('Token Provision', () => {
    it('should provide a CSRF token in response header', async () => {
      const res = await chai.request(app).get('/get-token');
      
      expect(res).to.have.status(200);
      expect(res.headers).to.have.property('x-csrf-token');
      expect(res.headers['x-csrf-token']).to.be.a('string');
    });
  });

  describe('Protected Routes', () => {
    it('should reject POST requests without a CSRF token', async () => {
      const res = await chai.request(app)
        .post('/protected')
        .send({ data: 'test' });
      
      expect(res).to.have.status(403);
      expect(res.body).to.have.property('message', 'CSRF token validation failed');
    });
    
    it('should allow POST requests with a valid CSRF token', async () => {
      // First get a token
      const tokenRes = await chai.request(app).get('/get-token');
      const csrfToken = tokenRes.headers['x-csrf-token'];
      
      // Then use it in a protected request
      const res = await chai.request(app)
        .post('/protected')
        .set('X-CSRF-Token', csrfToken)
        .send({ data: 'test' });
      
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Protected route access successful');
    });
    
    it('should reject requests with an invalid CSRF token', async () => {
      const res = await chai.request(app)
        .post('/protected')
        .set('X-CSRF-Token', 'invalid-token')
        .send({ data: 'test' });
      
      expect(res).to.have.status(403);
    });
  });

  describe('HTTP Method Exemptions', () => {
    it('should not require CSRF token for GET requests', async () => {
      const res = await chai.request(app).get('/public');
      expect(res).to.have.status(200);
    });
  });
});
