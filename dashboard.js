const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateQuery, dashboardSchemas } = require('../middleware/validation');

const router = express.Router();

// Get dashboard summary
router.get('/summary', authenticateToken, requirePermission('read_dashboard'), validateQuery(dashboardSchemas.summary), (req, res, next) => {
  try {
    const db = getDatabase();
    const { period, user_id } = req.query;
    
    // Build WHERE clause based on period and user access
    const whereConditions = [];
    const values = [];
    
    // Determine date filter based on period
    let dateCondition = '';
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateCondition = "date >= date('now', '-7 days')";
        break;
      case 'month':
        dateCondition = "date >= date('now', '-1 month')";
        break;
      case 'year':
        dateCondition = "date >= date('now', '-1 year')";
        break;
      case 'all':
      default:
        dateCondition = null;
        break;
    }
    
    if (dateCondition) {
      whereConditions.push(dateCondition);
    }
    
    // User access control
    if (req.user.role !== 'admin') {
      whereConditions.push('user_id = ?');
      values.push(req.user.id);
    } else if (user_id) {
      whereConditions.push('user_id = ?');
      values.push(user_id);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get summary statistics
    const summarySQL = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT category) as unique_categories
      FROM financial_records
      ${whereClause}
    `;
    
    db.get(summarySQL, values, (err, summary) => {
      if (err) {
        return next(err);
      }
      
      // Calculate net balance
      const net_balance = (summary.total_income || 0) - (summary.total_expenses || 0);
      
      // Get category-wise totals
      const categorySQL = `
        SELECT 
          category,
          type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM financial_records
        ${whereClause}
        GROUP BY category, type
        ORDER BY total DESC
      `;
      
      db.all(categorySQL, values, (err, categories) => {
        if (err) {
          return next(err);
        }
        
        // Get monthly/weekly trends
        let trendSQL, trendGroup;
        
        switch (period) {
          case 'week':
            trendSQL = `
              SELECT 
                strftime('%Y-%m-%d', date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
              FROM financial_records
              ${whereClause}
              GROUP BY strftime('%Y-%m-%d', date)
              ORDER BY period
            `;
            break;
          case 'year':
            trendSQL = `
              SELECT 
                strftime('%Y-%m', date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
              FROM financial_records
              ${whereClause}
              GROUP BY strftime('%Y-%m', date)
              ORDER BY period
            `;
            break;
          case 'month':
          default:
            trendSQL = `
              SELECT 
                strftime('%Y-%m-%d', date) as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
              FROM financial_records
              ${whereClause}
              GROUP BY strftime('%Y-%m-%d', date)
              ORDER BY period
            `;
            break;
        }
        
        db.all(trendSQL, values, (err, trends) => {
          if (err) {
            return next(err);
          }
          
          // Get recent activity
          const recentSQL = `
            SELECT 
              fr.id,
              fr.amount,
              fr.type,
              fr.category,
              fr.date,
              fr.description,
              fr.created_at,
              u.username as created_by
            FROM financial_records fr
            JOIN users u ON fr.user_id = u.id
            ${whereClause}
            ORDER BY fr.created_at DESC
            LIMIT 5
          `;
          
          db.all(recentSQL, values, (err, recent) => {
            if (err) {
              return next(err);
            }
            
            res.json({
              summary: {
                total_income: summary.total_income || 0,
                total_expenses: summary.total_expenses || 0,
                net_balance: net_balance,
                total_transactions: summary.total_transactions || 0,
                unique_categories: summary.unique_categories || 0
              },
              categories,
              trends,
              recent_activity: recent,
              period
            });
          });
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed analytics
router.get('/analytics', authenticateToken, requirePermission('read_analytics'), (req, res, next) => {
  try {
    const db = getDatabase();
    const { user_id } = req.query;
    
    // Build WHERE clause
    const whereConditions = [];
    const values = [];
    
    if (req.user.role !== 'admin') {
      whereConditions.push('user_id = ?');
      values.push(req.user.id);
    } else if (user_id) {
      whereConditions.push('user_id = ?');
      values.push(user_id);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get spending by category (last 30 days)
    const categorySpendingSQL = `
      SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount
      FROM financial_records
      ${whereClause}
      AND type = 'expense'
      AND date >= date('now', '-30 days')
      GROUP BY category
      ORDER BY total_amount DESC
    `;
    
    // Get income sources (last 30 days)
    const incomeSourcesSQL = `
      SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount
      FROM financial_records
      ${whereClause}
      AND type = 'income'
      AND date >= date('now', '-30 days')
      GROUP BY category
      ORDER BY total_amount DESC
    `;
    
    // Get monthly comparison
    const monthlyComparisonSQL = `
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        COUNT(*) as transactions
      FROM financial_records
      ${whereClause}
      AND date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
    `;
    
    // Get daily averages
    const dailyAveragesSQL = `
      SELECT 
        type,
        AVG(amount) as daily_average,
        COUNT(*) as days_with_transactions
      FROM financial_records
      ${whereClause}
      AND date >= date('now', '-30 days')
      GROUP BY type
    `;
    
    // Execute all queries in parallel
    db.all(categorySpendingSQL, values, (err, categorySpending) => {
      if (err) return next(err);
      
      db.all(incomeSourcesSQL, values, (err, incomeSources) => {
        if (err) return next(err);
        
        db.all(monthlyComparisonSQL, values, (err, monthlyComparison) => {
          if (err) return next(err);
          
          db.all(dailyAveragesSQL, values, (err, dailyAverages) => {
            if (err) return next(err);
            
            res.json({
              category_spending: categorySpending,
              income_sources: incomeSources,
              monthly_comparison: monthlyComparison,
              daily_averages: dailyAverages
            });
          });
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get user statistics (admin only)
router.get('/users/stats', authenticateToken, requirePermission('manage_users'), (req, res, next) => {
  try {
    const db = getDatabase();
    
    const sql = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.created_at as user_created,
        r.name as role,
        COUNT(fr.id) as total_records,
        SUM(CASE WHEN fr.type = 'income' THEN fr.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN fr.type = 'expense' THEN fr.amount ELSE 0 END) as total_expenses,
        MAX(fr.created_at) as last_activity
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN financial_records fr ON u.id = fr.user_id
      GROUP BY u.id, u.username, u.email, u.created_at, r.name
      ORDER BY u.created_at DESC
    `;
    
    db.all(sql, [], (err, userStats) => {
      if (err) {
        return next(err);
      }
      
      // Calculate net balance for each user
      userStats.forEach(user => {
        user.net_balance = (user.total_income || 0) - (user.total_expenses || 0);
      });
      
      res.json({ user_statistics: userStats });
    });
  } catch (error) {
    next(error);
  }
});

// Get system overview (admin only)
router.get('/system/overview', authenticateToken, requirePermission('manage_users'), (req, res, next) => {
  try {
    const db = getDatabase();
    
    const overviewSQL = `
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM financial_records) as total_records,
        (SELECT COUNT(*) FROM financial_records WHERE type = 'income') as total_income_records,
        (SELECT COUNT(*) FROM financial_records WHERE type = 'expense') as total_expense_records,
        (SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) FROM financial_records) as total_system_income,
        (SELECT SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) FROM financial_records) as total_system_expenses,
        (SELECT COUNT(*) FROM roles) as total_roles
    `;
    
    db.get(overviewSQL, [], (err, overview) => {
      if (err) {
        return next(err);
      }
      
      // Calculate system net balance
      overview.net_balance = (overview.total_system_income || 0) - (overview.total_system_expenses || 0);
      
      res.json({ system_overview: overview });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
