const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/finance.db');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }
  return db;
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    // Create tables
    const createTables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )`,
      
      // Roles table
      `CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Financial records table
      `CREATE TABLE IF NOT EXISTS financial_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        category VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    let completed = 0;
    const total = createTables.length;

    createTables.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error(`Error creating table ${index + 1}:`, err.message);
          reject(err);
          return;
        }
        
        completed++;
        if (completed === total) {
          // Insert default roles if they don't exist
          insertDefaultRoles()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  });
}

async function insertDefaultRoles() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const defaultRoles = [
      {
        name: 'viewer',
        description: 'Can only view dashboard data',
        permissions: JSON.stringify(['read_dashboard', 'read_records'])
      },
      {
        name: 'analyst',
        description: 'Can view records and access insights',
        permissions: JSON.stringify(['read_dashboard', 'read_records', 'read_analytics'])
      },
      {
        name: 'admin',
        description: 'Full management access',
        permissions: JSON.stringify(['read_dashboard', 'read_records', 'read_analytics', 'create_records', 'update_records', 'delete_records', 'manage_users'])
      }
    ];

    let completed = 0;
    const total = defaultRoles.length;

    defaultRoles.forEach((role) => {
      const sql = `INSERT OR IGNORE INTO roles (name, description, permissions) VALUES (?, ?, ?)`;
      db.run(sql, [role.name, role.description, role.permissions], (err) => {
        if (err) {
          console.error('Error inserting default role:', err.message);
          reject(err);
          return;
        }
        
        completed++;
        if (completed === total) {
          console.log('Default roles inserted successfully');
          resolve();
        }
      });
    });
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
