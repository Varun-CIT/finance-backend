const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate, userSchemas } = require('../middleware/validation');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requirePermission('manage_users'), (req, res, next) => {
  try {
    const db = getDatabase();
    const { limit = 20, offset = 0 } = req.query;

    const sql = `
      SELECT u.id, u.username, u.email, u.status, u.created_at,
             r.name as role, r.description as role_description
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.all(sql, [limit, offset], (err, users) => {
      if (err) {
        return next(err);
      }

      res.json({
        users,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res, next) => {
  try {
    const db = getDatabase();

    const sql = `
      SELECT u.id, u.username, u.email, u.status, u.created_at,
             r.name as role, r.description as role_description,
             r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    db.get(sql, [req.user.id], (err, user) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Parse permissions for client
      user.permissions = JSON.parse(user.permissions);

      res.json({ user });
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, requirePermission('manage_users'), (req, res, next) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;

    const sql = `
      SELECT u.id, u.username, u.email, u.status, u.created_at,
             r.name as role, r.description as role_description,
             r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    db.get(sql, [userId], (err, user) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.permissions = JSON.parse(user.permissions);

      res.json({ user });
    });
  } catch (error) {
    next(error);
  }
});

// Update user (admin can update any user, others can only update themselves)
router.put('/:id', authenticateToken, validate(userSchemas.update), (req, res, next) => {
  try {
    const db = getDatabase();
    const targetUserId = req.params.id;
    const { username, email, role, status } = req.body;

    // Check permissions
    const isSelf = req.user.id === parseInt(targetUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Can only update your own profile' });
    }

    // Non-admins can only update username and email
    if (!isAdmin && (role || status)) {
      return res.status(403).json({ error: 'Cannot change role or status' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    if (role && isAdmin) {
      updates.push('role_id = (SELECT id FROM roles WHERE name = ?)');
      values.push(role);
    }

    if (status && isAdmin) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetUserId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, values, function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Username or email already exists' });
        }
        return next(err);
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User updated successfully' });
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requirePermission('manage_users'), (req, res, next) => {
  try {
    const db = getDatabase();
    const userId = req.params.id;

    // Prevent self-deletion
    if (req.user.id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Start transaction to delete user and related records
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Delete user's financial records
      db.run('DELETE FROM financial_records WHERE user_id = ?', [userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return next(err);
        }

        // Delete user
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return next(err);
          }

          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
          }

          db.run('COMMIT', (err) => {
            if (err) {
              return next(err);
            }

            res.json({ message: 'User deleted successfully' });
          });
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get available roles
router.get('/roles/list', authenticateToken, requirePermission('read_dashboard'), (req, res, next) => {
  try {
    const db = getDatabase();

    const sql = 'SELECT id, name, description, permissions FROM roles ORDER BY name';

    db.all(sql, [], (err, roles) => {
      if (err) {
        return next(err);
      }

      // Parse permissions for each role
      roles.forEach(role => {
        role.permissions = JSON.parse(role.permissions);
      });

      res.json({ roles });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
