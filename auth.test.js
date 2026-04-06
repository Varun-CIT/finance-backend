const request = require('supertest');
const app = require('../src/app');
const { getDatabase } = require('../src/database/init');

describe('Authentication Endpoints', () => {
  let db;
  
  beforeAll(async () => {
    db = getDatabase();
    // Clean up any existing test data
    db.run('DELETE FROM users WHERE username LIKE "test_%"');
  });

  afterAll(async () => {
    // Clean up test data
    db.run('DELETE FROM users WHERE username LIKE "test_%"');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'test_user',
        email: 'test@example.com',
        password: 'password123',
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', userData.username);
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('role', userData.role);
    });

    it('should reject registration with duplicate username', async () => {
      const userData = {
        username: 'test_user',
        email: 'test2@example.com',
        password: 'password123',
        role: 'analyst'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Username or email already exists');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        username: 'test_user2',
        email: 'invalid-email',
        password: 'password123',
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        username: 'test_user3',
        email: 'test3@example.com',
        password: '123',
        role: 'viewer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        username: 'test_user',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('username', loginData.username);
    });

    it('should reject login with invalid username', async () => {
      const loginData = {
        username: 'nonexistent_user',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        username: 'test_user',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/verify', () => {
    let token;

    beforeAll(async () => {
      // Get token by logging in
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test_user',
          password: 'password123'
        });
      
      token = loginResponse.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body.user).toHaveProperty('username', 'test_user');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'No token provided');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid_token')
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });
});
