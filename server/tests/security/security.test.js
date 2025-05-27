// server/tests/security/security.test.js
import * as chai from 'chai';
import chaiHttp from 'chai-http';
import { createServer } from 'http';
import express from 'express';
import { securityMiddleware, handleValidationErrors, authValidation, lobbyValidation } from '../../src/middleware/security.js';
import { body } from 'express-validator';

const { expect } = chai;
chai.use(chaiHttp);

describe('Security Middleware Tests', () => {
  let app, server;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityMiddleware);
    
    // Test routes
    app.get('/test', (req, res) => res.status(200).json({ message: 'Success' }));
    
    // Validation test routes
    app.post('/test-validation', [
      body('name').isString().isLength({ min: 3 }),
      handleValidationErrors
    ], (req, res) => res.status(200).json({ message: 'Validation passed' }));
    
    // SQL injection test route
    app.get('/test-sql-injection', (req, res) => res.status(200).json({ message: 'No injection detected' }));
    
    // Request body size test
    app.post('/test-body-size', (req, res) => res.status(200).json({ message: 'Body size acceptable' }));
    
    server = createServer(app);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('Security Headers', () => {
    it('should set appropriate security headers', async () => {
      const res = await chai.request(app).get('/test');
      
      expect(res).to.have.status(200);
      expect(res.headers).to.have.property('content-security-policy');
      expect(res.headers).to.have.property('x-content-type-options');
      expect(res.headers).to.have.property('x-frame-options');
      expect(res.headers).to.have.property('strict-transport-security');
      expect(res.headers).to.have.property('referrer-policy');
    });
  });

  describe('Request Body Size Limits', () => {
    it('should reject oversized JSON payloads', async () => {
      // Create a payload just over 10kb
      const largePayload = { data: 'x'.repeat(11 * 1024) };
      
      const res = await chai.request(app)
        .post('/test-body-size')
        .send(largePayload);
      
      expect(res).to.have.status(413); // Payload too large
    });

    it('should accept normal-sized JSON payloads', async () => {
      const normalPayload = { data: 'x'.repeat(1024) }; // 1kb
      
      const res = await chai.request(app)
        .post('/test-body-size')
        .send(normalPayload);
      
      expect(res).to.have.status(200);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block requests with SQL injection patterns in query params', async () => {
      const res = await chai.request(app)
        .get('/test-sql-injection')
        .query({ param: "' OR 1=1; --" });
      
      expect(res).to.have.status(403);
    });

    it('should allow normal query parameters', async () => {
      const res = await chai.request(app)
        .get('/test-sql-injection')
        .query({ param: 'normal-value' });
      
      expect(res).to.have.status(200);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid inputs', async () => {
      const res = await chai.request(app)
        .post('/test-validation')
        .send({ name: 'ab' }); // Too short
      
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('errors');
    });

    it('should accept valid inputs', async () => {
      const res = await chai.request(app)
        .post('/test-validation')
        .send({ name: 'valid-name' });
      
      expect(res).to.have.status(200);
    });
  });
});

describe('Validation Rules Tests', () => {
  describe('Auth Validation', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {} };
      res = {
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.data = data; return this; }
      };
      next = () => { this.nextCalled = true; };
    });

    it('should validate registration with strong password', () => {
      req.body = {
        username: 'validuser',
        password: 'StrongPass1!'
      };

      // Apply all validators
      authValidation.register.forEach(validator => validator(req, res, next));

      // No validation errors should exist
      const result = validationResult(req);
      expect(result.isEmpty()).to.be.true;
    });

    it('should reject weak passwords', () => {
      req.body = {
        username: 'validuser',
        password: 'weakpass' // Missing uppercase, number, and special char
      };

      // Apply all validators
      authValidation.register.forEach(validator => validator(req, res, next));

      // Validation errors should exist
      const result = validationResult(req);
      expect(result.isEmpty()).to.be.false;
    });

    it('should reject invalid usernames', () => {
      req.body = {
        username: 'invalid user!', // Contains space and special char
        password: 'StrongPass1!'
      };

      // Apply all validators
      authValidation.register.forEach(validator => validator(req, res, next));

      // Validation errors should exist
      const result = validationResult(req);
      expect(result.isEmpty()).to.be.false;
    });
  });

  describe('Lobby Validation', () => {
    it('should validate proper lobby creation params', () => {
      const req = {
        body: {
          name: 'Test Lobby',
          gameType: 'chess',
          maxPlayers: 2,
          isPrivate: true
        }
      };

      // Apply all validators
      lobbyValidation.create.forEach(validator => validator(req, {}));

      // No validation errors should exist
      const result = validationResult(req);
      expect(result.isEmpty()).to.be.true;
    });

    it('should reject invalid game types', () => {
      const req = {
        body: {
          name: 'Test Lobby',
          gameType: 'invalid-game', // Not in allowed list
          maxPlayers: 2
        }
      };

      // Apply all validators
      lobbyValidation.create.forEach(validator => validator(req, {}));

      // Validation errors should exist
      const result = validationResult(req);
      expect(result.isEmpty()).to.be.false;
    });
  });
});

// Helper function to get validation results
function validationResult(req) {
  const errors = [];
  
  if (req._validationErrors) {
    return {
      isEmpty: () => req._validationErrors.length === 0,
      array: () => req._validationErrors
    };
  }
  
  return {
    isEmpty: () => true,
    array: () => []
  };
}
