const request = require('supertest');
const app = require('../src/app');
const { getDatabase } = require('../src/database/init');

describe('Dashboard Endpoints', () => {
  let db;
  let userToken;
  let adminToken;
  let testUserId;

  beforeAll(async () => {
    db = getDatabase();
    
    // Clean up test data
    db.run('DELETE FROM financial_records WHERE user_id IN (SELECT id FROM users WHERE username LIKE "test_dashboard_%")');
    db.run('DELETE FROM users WHERE username LIKE "test_dashboard_%"');

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'test_dashboard_user',
        email: 'test_dashboard@example.com',
        password: 'password123',
        role: 'analyst'
      });

    userToken = userResponse.body.token;
    testUserId = userResponse.body.user.id;

    // Create admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'test_dashboard_admin',
        email: 'test_admin@example.com',
        password: 'password123',
        role: 'admin'
      });

    adminToken = adminResponse.body.token;

    // Create test financial records
    const testRecords = [
      {
        amount: 3000,
        type: 'income',
        category: 'Salary',
        date: '2024-01-15',
        description: 'Monthly salary'
      },
      {
        amount: 500,
        type: 'expense',
        category: 'Food',
        date: '2024-01-10',
        description: 'Groceries'
      },
      {
        amount: 1200,
        type: 'expense',
        category: 'Rent',
        date: '2024-01-01',
        description: 'Monthly rent'
      },
      {
        amount: 800,
        type: 'income',
        category: 'Freelance',
        date: '2024-01-20',
        description: 'Freelance project'
      }
    ];

    for (const record of testRecords) {
      await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${userToken}`)
        .send(record);
    }
  });

  afterAll(async () => {
    // Clean up test data
    db.run('DELETE FROM financial_records WHERE user_id IN (SELECT id FROM users WHERE username LIKE "test_dashboard_%")');
    db.run('DELETE FROM users WHERE username LIKE "test_dashboard_%"');
  });

  describe('GET /api/dashboard/summary', () => {
    it('should get dashboard summary for current user', async () => {
      const response = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('recent_activity');
      expect(response.body).toHaveProperty('period');

      // Check summary structure
      const summary = response.body.summary;
      expect(summary).toHaveProperty('total_income');
      expect(summary).toHaveProperty('total_expenses');
      expect(summary).toHaveProperty('net_balance');
      expect(summary).toHaveProperty('total_transactions');
      expect(summary).toHaveProperty('unique_categories');

      // Verify calculations
      expect(summary.total_income).toBe(3800); // 3000 + 800
      expect(summary.total_expenses).toBe(1700); // 500 + 1200
      expect(summary.net_balance).toBe(2100); // 3800 - 1700
      expect(summary.total_transactions).toBe(4);
    });

    it('should filter summary by period', async () => {
      const response = await request(app)
        .get('/api/dashboard/summary?period=month')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period', 'month');
      expect(response.body).toHaveProperty('summary');
    });

    it('should allow admin to view summary for specific user', async () => {
      const response = await request(app)
        .get(`/api/dashboard/summary?user_id=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary.total_income).toBe(3800);
    });

    it('should reject access without authentication', async () => {
      const response = await request(app)
        .get('/api/dashboard/summary')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should reject access for viewer role', async () => {
      // Create a viewer user
      const viewerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_viewer',
          email: 'viewer@example.com',
          password: 'password123',
          role: 'viewer'
        });

      const viewerToken = viewerResponse.body.token;

      const response = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200); // Viewers can access dashboard

      // Clean up viewer user
      await request(app)
        .delete(`/api/users/${viewerResponse.body.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });
  });

  describe('GET /api/dashboard/analytics', () => {
    it('should get detailed analytics for analyst user', async () => {
      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('category_spending');
      expect(response.body).toHaveProperty('income_sources');
      expect(response.body).toHaveProperty('monthly_comparison');
      expect(response.body).toHaveProperty('daily_averages');

      // Check category spending
      expect(Array.isArray(response.body.category_spending)).toBe(true);
      
      // Check income sources
      expect(Array.isArray(response.body.income_sources)).toBe(true);
      
      // Check monthly comparison
      expect(Array.isArray(response.body.monthly_comparison)).toBe(true);
      
      // Check daily averages
      expect(Array.isArray(response.body.daily_averages)).toBe(true);
    });

    it('should reject analytics access for viewer role', async () => {
      // Create a viewer user
      const viewerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test_viewer_analytics',
          email: 'viewer2@example.com',
          password: 'password123',
          role: 'viewer'
        });

      const viewerToken = viewerResponse.body.token;

      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Insufficient permissions');

      // Clean up viewer user
      await request(app)
        .delete(`/api/users/${viewerResponse.body.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });
  });

  describe('GET /api/dashboard/users/stats', () => {
    it('should get user statistics for admin', async () => {
      const response = await request(app)
        .get('/api/dashboard/users/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user_statistics');
      expect(Array.isArray(response.body.user_statistics)).toBe(true);

      // Find our test user in the statistics
      const testUserStats = response.body.user_statistics.find(
        user => user.username === 'test_dashboard_user'
      );
      
      expect(testUserStats).toBeDefined();
      expect(testUserStats).toHaveProperty('total_records');
      expect(testUserStats).toHaveProperty('total_income');
      expect(testUserStats).toHaveProperty('total_expenses');
      expect(testUserStats).toHaveProperty('net_balance');
    });

    it('should reject user statistics access for non-admin', async () => {
      const response = await request(app)
        .get('/api/dashboard/users/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('GET /api/dashboard/system/overview', () => {
    it('should get system overview for admin', async () => {
      const response = await request(app)
        .get('/api/dashboard/system/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('system_overview');
      
      const overview = response.body.system_overview;
      expect(overview).toHaveProperty('total_users');
      expect(overview).toHaveProperty('active_users');
      expect(overview).toHaveProperty('total_records');
      expect(overview).toHaveProperty('total_income_records');
      expect(overview).toHaveProperty('total_expense_records');
      expect(overview).toHaveProperty('total_system_income');
      expect(overview).toHaveProperty('total_system_expenses');
      expect(overview).toHaveProperty('net_balance');
      expect(overview).toHaveProperty('total_roles');

      expect(overview.total_users).toBeGreaterThan(0);
      expect(overview.total_roles).toBe(3); // viewer, analyst, admin
    });

    it('should reject system overview access for non-admin', async () => {
      const response = await request(app)
        .get('/api/dashboard/system/overview')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
  });
});
