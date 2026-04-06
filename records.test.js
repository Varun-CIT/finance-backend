const request = require('supertest');
const app = require('../src/app');
const { getDatabase } = require('../src/database/init');

describe('Financial Records Endpoints', () => {
  let db;
  let userToken;
  let adminToken;
  let testUserId;
  let adminUserId;
  let testRecordId;

  beforeAll(async () => {
    db = getDatabase();
    
    // Clean up test data
    db.run('DELETE FROM financial_records WHERE user_id IN (SELECT id FROM users WHERE username LIKE "test_%")');
    db.run('DELETE FROM users WHERE username LIKE "test_%"');

    // Create test users
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'test_records_user',
        email: 'test_records@example.com',
        password: 'password123',
        role: 'analyst'
      });

    userToken = userResponse.body.token;
    testUserId = userResponse.body.user.id;

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'test_records_admin',
        email: 'test_admin@example.com',
        password: 'password123',
        role: 'admin'
      });

    adminToken = adminResponse.body.token;
    adminUserId = adminResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    db.run('DELETE FROM financial_records WHERE user_id IN (SELECT id FROM users WHERE username LIKE "test_%")');
    db.run('DELETE FROM users WHERE username LIKE "test_%"');
  });

  describe('POST /api/records', () => {
    it('should create a new financial record', async () => {
      const recordData = {
        amount: 1500.00,
        type: 'income',
        category: 'Salary',
        date: '2024-01-15',
        description: 'Monthly salary'
      };

      const response = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${userToken}`)
        .send(recordData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Financial record created successfully');
      expect(response.body.record).toHaveProperty('amount', recordData.amount);
      expect(response.body.record).toHaveProperty('type', recordData.type);
      expect(response.body.record).toHaveProperty('category', recordData.category);
      
      testRecordId = response.body.record.id;
    });

    it('should reject record creation without authentication', async () => {
      const recordData = {
        amount: 500.00,
        type: 'expense',
        category: 'Food',
        date: '2024-01-16',
        description: 'Groceries'
      };

      const response = await request(app)
        .post('/api/records')
        .send(recordData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should reject record creation with invalid data', async () => {
      const recordData = {
        amount: -100, // Invalid negative amount
        type: 'invalid_type',
        category: '',
        date: 'invalid-date'
      };

      const response = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${userToken}`)
        .send(recordData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/records', () => {
    it('should get user records', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.records)).toBe(true);
      expect(response.body.records.length).toBeGreaterThan(0);
    });

    it('should filter records by type', async () => {
      const response = await request(app)
        .get('/api/records?type=income')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.records.forEach(record => {
        expect(record.type).toBe('income');
      });
    });

    it('should filter records by date range', async () => {
      const response = await request(app)
        .get('/api/records?date_from=2024-01-01&date_to=2024-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.records.forEach(record => {
        expect(record.date).toBeGreaterThanOrEqual('2024-01-01');
        expect(record.date).toBeLessThanOrEqual('2024-01-31');
      });
    });

    it('should allow admin to see all records', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('records');
      expect(Array.isArray(response.body.records)).toBe(true);
    });
  });

  describe('GET /api/records/:id', () => {
    it('should get a specific record', async () => {
      const response = await request(app)
        .get(`/api/records/${testRecordId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('record');
      expect(response.body.record).toHaveProperty('id', testRecordId);
    });

    it('should reject access to non-existent record', async () => {
      const response = await request(app)
        .get('/api/records/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Record not found');
    });
  });

  describe('PUT /api/records/:id', () => {
    it('should update a record', async () => {
      const updateData = {
        amount: 1600.00,
        description: 'Updated monthly salary'
      };

      const response = await request(app)
        .put(`/api/records/${testRecordId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Financial record updated successfully');
    });

    it('should reject update with invalid data', async () => {
      const updateData = {
        amount: -100
      };

      const response = await request(app)
        .put(`/api/records/${testRecordId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('DELETE /api/records/:id', () => {
    it('should delete a record', async () => {
      // First create a new record to delete
      const createResponse = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 100.00,
          type: 'expense',
          category: 'Test',
          date: '2024-01-20',
          description: 'Record to delete'
        });

      const recordToDelete = createResponse.body.record.id;

      const response = await request(app)
        .delete(`/api/records/${recordToDelete}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Financial record deleted successfully');

      // Verify record is deleted
      await request(app)
        .get(`/api/records/${recordToDelete}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should reject deletion of non-existent record', async () => {
      const response = await request(app)
        .delete('/api/records/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Record not found');
    });
  });

  describe('GET /api/records/categories/list', () => {
    it('should get user categories', async () => {
      const response = await request(app)
        .get('/api/records/categories/list')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });
  });

  describe('GET /api/records/activity/recent', () => {
    it('should get recent activity', async () => {
      const response = await request(app)
        .get('/api/records/activity/recent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });
  });
});
