const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { validate, userSchemas } = require('../middleware/validation');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register a new user
router.post('/register', validate(userSchemas.register), async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const db = getDatabase();

    // Get role ID
    db.get('SELECT id FROM roles WHERE name = ?', [role], async (err, roleRow) => {
      if (err) {
        return next(err);
      }

      if (!roleRow) {
        return res.status(400).json({ error: 'Invalid role specified' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user
      const sql = `
        INSERT INTO users (username, email, password_hash, role_id)
        VALUES (?, ?, ?, ?)
      `;

      db.run(sql, [username, email, passwordHash, roleRow.id], function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Username or email already exists' });
          }
          return next(err);
        }

        // Generate JWT token
        const token = jwt.sign(
          { 
            id: this.lastID, 
            username, 
            email, 
            role 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.status(201).json({
          message: 'User registered successfully',
          token,
          user: {
            id: this.lastID,
            username,
            email,
            role
          }
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', validate(userSchemas.login), (req, res, next) => {
  try {
    const { username, password } = req.body;
    const db = getDatabase();

    const sql = `
      SELECT u.id, u.username, u.email, u.password_hash, u.status,
             r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = ?
    `;

    db.get(sql, [username], async (err, user) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.status !== 'active') {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

// Verify token endpoint
router.get('/verify', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  });
});

module.exports = router;
