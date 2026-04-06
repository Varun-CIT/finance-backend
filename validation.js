const Joi = require('joi');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('viewer', 'analyst', 'admin').default('viewer')
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  update: Joi.object({
    username: Joi.string().alphanum().min(3).max(30),
    email: Joi.string().email(),
    role: Joi.string().valid('viewer', 'analyst', 'admin'),
    status: Joi.string().valid('active', 'inactive')
  }).min(1)
};

// Financial record validation schemas
const recordSchemas = {
  create: Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    type: Joi.string().valid('income', 'expense').required(),
    category: Joi.string().min(1).max(50).required(),
    date: Joi.date().iso().required(),
    description: Joi.string().max(500).allow('')
  }),

  update: Joi.object({
    amount: Joi.number().positive().precision(2),
    type: Joi.string().valid('income', 'expense'),
    category: Joi.string().min(1).max(50),
    date: Joi.date().iso(),
    description: Joi.string().max(500).allow('')
  }).min(1),

  filter: Joi.object({
    type: Joi.string().valid('income', 'expense'),
    category: Joi.string(),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso().min(Joi.ref('date_from')),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

// Dashboard filter validation
const dashboardSchemas = {
  summary: Joi.object({
    period: Joi.string().valid('week', 'month', 'year', 'all').default('month'),
    user_id: Joi.number().integer().positive()
  })
};

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details
      });
    }

    req.body = value;
    next();
  };
}

// Query parameter validation
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Query validation failed',
        details
      });
    }

    req.query = value;
    next();
  };
}

module.exports = {
  validate,
  validateQuery,
  userSchemas,
  recordSchemas,
  dashboardSchemas
};
