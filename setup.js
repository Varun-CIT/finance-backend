// Test setup file
const { initializeDatabase } = require('../src/database/init');

// Initialize test database before running tests
beforeAll(async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Failed to initialize test database:', error);
  }
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
