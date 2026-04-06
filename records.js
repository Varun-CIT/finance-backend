const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requirePermission, canAccessRecord } = require('../middleware/auth');
const { validate, validateQuery, recordSchemas } = require('../middleware/validation');

const router = express.Router();

// Create a new financial record
router.post('/', authenticateToken, requirePermission('create_records'), validate(recordSchemas.create), (req, res, next) => {
  try {
    const db = getDatabase();
    const { amount, type, category, date, description } = req.body;

    const sql = `
      INSERT INTO financial_records (user_id, amount, type, category, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [req.user.id, amount, type, category, date, description], function(err) {
      if (err) {
        return next(err);
      }

      res.status(201).json({
        message: 'Financial record created successfully',
        record: {
          id: this.lastID,
          user_id: req.user.id,
          amount,
          type,
          category,
          date,
          description,
          created_at: new Date().toISOString()
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get financial records with filtering
router.get('/', authenticateToken, requirePermission('read_records'), validateQuery(recordSchemas.filter), (req, res, next) => {
  try {
    const db = getDatabase();
    const { type, category, date_from, date_to, limit, offset } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const values = [];

    // Non-admin users can only see their own records
    if (req.user.role !== 'admin') {
      whereConditions.push('fr.user_id = ?');
      values.push(req.user.id);
    }

    if (type) {
      whereConditions.push('fr.type = ?');
      values.push(type);
    }

    if (category) {
      whereConditions.push('fr.category LIKE ?');
      values.push(`%${category}%`);
    }

    if (date_from) {
      whereConditions.push('fr.date >= ?');
      values.push(date_from);
    }

    if (date_to) {
      whereConditions.push('fr.date <= ?');
      values.push(date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sql = `
      SELECT fr.id, fr.amount, fr.type, fr.category, fr.date, fr.description,
             fr.created_at, fr.updated_at,
             u.username as created_by
      FROM financial_records fr
      JOIN users u ON fr.user_id = u.id
      ${whereClause}
      ORDER BY fr.date DESC, fr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    values.push(limit, offset);

    db.all(sql, values, (err, records) => {
      if (err) {
        return next(err);
      }

      // Get total count for pagination
      const countSql = `
        SELECT COUNT(*) as total
        FROM financial_records fr
        ${whereClause}
      `;

      const countValues = values.slice(0, -2); // Remove limit and offset

      db.get(countSql, countValues, (err, countResult) => {
        if (err) {
          return next(err);
        }

        res.json({
          records,
          pagination: {
            total: countResult.total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: (parseInt(offset) + parseInt(limit)) < countResult.total
          }
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific financial record
router.get('/:id', authenticateToken, requirePermission('read_records'), canAccessRecord('read'), (req, res, next) => {
  try {
    const db = getDatabase();
    const recordId = req.params.id;

    const sql = `
      SELECT fr.id, fr.amount, fr.type, fr.category, fr.date, fr.description,
             fr.created_at, fr.updated_at,
             u.username as created_by
      FROM financial_records fr
      JOIN users u ON fr.user_id = u.id
      WHERE fr.id = ?
    `;

    db.get(sql, [recordId], (err, record) => {
      if (err) {
        return next(err);
      }

      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({ record });
    });
  } catch (error) {
    next(error);
  }
});

// Update a financial record
router.put('/:id', authenticateToken, canAccessRecord('write'), validate(recordSchemas.update), (req, res, next) => {
  try {
    const db = getDatabase();
    const recordId = req.params.id;
    const { amount, type, category, date, description } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(amount);
    }

    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (date !== undefined) {
      updates.push('date = ?');
      values.push(date);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(recordId);

    const sql = `UPDATE financial_records SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, values, function(err) {
      if (err) {
        return next(err);
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({ message: 'Financial record updated successfully' });
    });
  } catch (error) {
    next(error);
  }
});

// Delete a financial record
router.delete('/:id', authenticateToken, canAccessRecord('delete'), (req, res, next) => {
  try {
    const db = getDatabase();
    const recordId = req.params.id;

    const sql = 'DELETE FROM financial_records WHERE id = ?';

    db.run(sql, [recordId], function(err) {
      if (err) {
        return next(err);
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      res.json({ message: 'Financial record deleted successfully' });
    });
  } catch (error) {
    next(error);
  }
});

// Get categories for a user
router.get('/categories/list', authenticateToken, requirePermission('read_records'), (req, res, next) => {
  try {
    const db = getDatabase();

    const sql = `
      SELECT DISTINCT category, COUNT(*) as record_count
      FROM financial_records
      WHERE user_id = ?
      GROUP BY category
      ORDER BY category
    `;

    db.all(sql, [req.user.id], (err, categories) => {
      if (err) {
        return next(err);
      }

      res.json({ categories });
    });
  } catch (error) {
    next(error);
  }
});

// Get recent activity
router.get('/activity/recent', authenticateToken, requirePermission('read_records'), (req, res, next) => {
  try {
    const db = getDatabase();
    const { limit = 10 } = req.query;

    const sql = `
      SELECT fr.id, fr.amount, fr.type, fr.category, fr.date, fr.description,
             fr.created_at,
             u.username as created_by
      FROM financial_records fr
      JOIN users u ON fr.user_id = u.id
      WHERE fr.user_id = ? OR u.id = ?
      ORDER BY fr.created_at DESC
      LIMIT ?
    `;

    db.all(sql, [req.user.id, req.user.id], (err, activities) => {
      if (err) {
        return next(err);
      }

      res.json({ activities });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
