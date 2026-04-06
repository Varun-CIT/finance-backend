const express = require('express');

const router = express.Router();

// Root endpoint with API information
router.get('/', (req, res) => {
  res.json({
    name: 'Finance Data Processing and Access Control Backend',
    version: '1.0.0',
    description: 'A comprehensive backend system for managing financial records with role-based access control',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      authentication: '/api/auth',
      users: '/api/users',
      financial_records: '/api/records',
      dashboard: '/api/dashboard'
    },
    documentation: {
      readme: '/README.md',
      api_docs: 'See README.md for complete API documentation'
    },
    examples: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      create_record: 'POST /api/records',
      get_summary: 'GET /api/dashboard/summary'
    }
  });
});

module.exports = router;
