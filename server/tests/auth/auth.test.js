// server/tests/auth/auth.test.js
import supertest from 'supertest';
import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import db from '../../src/db.js';

// The app needs to be loaded from the correct path
let app;

// Test data
const testUser = {
  username: `testuser_${Date.now()}`,
  password: 'TestPass123'
};

let accessToken;
let refreshToken;
let userId;

describe('Authentication API', () => {
  before(async () => {
    try {
      // Import app dynamically to ensure environment is set up
      const appModule = await import('../../src/app.js');
      app = appModule.default;
      
      // Clean up any existing test users that might have been left from previous test runs
      await db('refresh_tokens').where('user_id', 'like', '%testuser%').delete();
      await db('users').where('username', 'like', '%testuser%').delete();
    } catch (error) {
      console.error('Test setup failed:', error);
    }
  });

  after(async () => {
    // Clean up test data after tests
    try {
      await db('refresh_tokens').where('user_id', 'like', '%testuser%').delete();
      await db('users').where('username', 'like', '%testuser%').delete();
      await db.destroy();
    } catch (error) {
      console.error('Test cleanup failed:', error);
    }
  });

  describe('Registration', () => {
    it('should register a new user', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('accessToken');
      expect(res.body).to.have.property('refreshToken');
      expect(res.body.user).to.have.property('username', testUser.username);
      
      // Save tokens and user ID for later tests
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
      userId = res.body.user.id;
    });
    
    it('should not allow duplicate usernames', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('message', 'Username already exists');
    });
    
    it('should validate password requirements', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'weak'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('errors');
    });
  });
  
  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send(testUser);
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      expect(res.body).to.have.property('refreshToken');
      
      // Update tokens
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
    
    it('should reject invalid credentials', async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('message', 'Invalid credentials');
    });
  });
  
  describe('Protected Routes', () => {
    it('should access protected route with valid token', async () => {
      const res = await supertest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('username', testUser.username);
    });
    
    it('should reject requests without token', async () => {
      const res = await supertest(app)
        .get('/api/auth/me');
      
      expect(res.status).to.equal(401);
    });

    it('should reject requests with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');
      
      expect(res.status).to.equal(401);
    });
  });
  
  describe('Token Refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const res = await supertest(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      expect(res.body).to.have.property('refreshToken');
      
      // Update tokens
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
    
    it('should reject invalid refresh tokens', async () => {
      const res = await supertest(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      expect(res.status).to.equal(403);
    });
  });
  
  describe('Logout', () => {
    it('should logout successfully', async () => {
      const res = await supertest(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('message', 'Logout successful');
    });
    
    it('should not allow using the refresh token after logout', async () => {
      const res = await supertest(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(res.status).to.equal(403);
    });
  });
  
  describe('Password Security', () => {
    it('should store passwords as Argon2 hashes', async () => {
      // Register a test user for password checking
      const pwTestUser = {
        username: `pw_testuser_${Date.now()}`,
        password: 'SecurePass123'
      };
      
      await supertest(app)
        .post('/api/auth/register')
        .send(pwTestUser);
      
      // Get the user from the database directly
      const user = await db('users')
        .where('username', pwTestUser.username)
        .first();
      
      // Verify it's an Argon2 hash
      expect(user.password).to.match(/^\$argon2id\$/);
      
      // Verify the original password can't be determined from the hash
      expect(user.password).to.not.include('SecurePass123');
      
      // Verify the hash works with argon2.verify
      const isMatch = await argon2.verify(user.password, pwTestUser.password);
      expect(isMatch).to.be.true;
    });
  });
});
