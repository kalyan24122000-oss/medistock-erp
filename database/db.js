// database/db.js
// Persistent SQLite Database Connection Manager with WAL mode & Foreign Keys

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;
let currentDbPath = null;

function getDataDir() {
  if (process.env.APPDATA_DIR) {
    return process.env.APPDATA_DIR;
  }
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && app.getPath) {
      return path.join(app.getPath('userData'), 'data');
    }
  } catch (e) {}
  return path.join(__dirname, '..', 'data');
}

/**
 * Get or initialize the database connection.
 * @param {string} [customPath] - Optional custom path for test/backup/production
 * @returns {Database.Database}
 */
function getDatabase(customPath) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const defaultDir = getDataDir();
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const dbPath = customPath || path.join(defaultDir, 'medistock.db');

  // Copy bundle template DB if userData db is fresh
  const templateDb = path.join(__dirname, '..', 'data', 'medistock.db');
  if (!customPath && !fs.existsSync(dbPath) && fs.existsSync(templateDb)) {
    try {
      fs.copyFileSync(templateDb, dbPath);
    } catch (e) {
      console.warn('Note copying template database:', e.message);
    }
  }

  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      console.warn('Error closing prior database instance:', e.message);
    }
  }

  const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    timeout: 7000,
  });

  // Enable WAL mode for high concurrency and performance
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints strictly
  db.pragma('foreign_keys = ON');
  // Safe synchronous setting with WAL
  db.pragma('synchronous = NORMAL');
  // Busy timeout for concurrency handling
  db.pragma('busy_timeout = 7000');
  // Optimization
  db.pragma('temp_store = MEMORY');

  dbInstance = db;
  currentDbPath = dbPath;

  return db;
}

/**
 * Close database connection safely
 */
function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
    } catch (err) {
      console.error('Error closing database:', err.message);
    } finally {
      dbInstance = null;
      currentDbPath = null;
    }
  }
}

/**
 * Get current DB path
 */
function getDatabasePath() {
  return currentDbPath;
}

module.exports = {
  getDatabase,
  closeDatabase,
  getDatabasePath,
};
