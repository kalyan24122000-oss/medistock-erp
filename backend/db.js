// backend/db.js
// Central SQLite Database connection and schema for the MediStock Licensing Authority

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'license_master.db');

let dbInstance = null;

function getLicenseDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  initLicenseSchema(dbInstance);
  return dbInstance;
}

function initLicenseSchema(db) {
  db.exec(`
    -- Superadmins for Licensing Portal
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    -- License Plans
    CREATE TABLE IF NOT EXISTS license_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      max_branches INTEGER NOT NULL DEFAULT 1,
      price_inr INTEGER NOT NULL DEFAULT 0,
      description TEXT
    );

    -- Customer Licenses
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL UNIQUE,
      pharmacy_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      plan_code TEXT NOT NULL,
      max_branches INTEGER NOT NULL DEFAULT 1,
      hardware_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED, SUSPENDED
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_heartbeat_at DATETIME,
      client_version TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES admins(id)
    );

    -- Audit Logs & Telemetry
    CREATE TABLE IF NOT EXISTS license_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER REFERENCES licenses(id),
      event_type TEXT NOT NULL, -- ACTIVATION, HEARTBEAT, VERIFY_FAIL, REVOKED, EXTENDED, HWID_RESET
      hardware_id TEXT,
      ip_address TEXT,
      client_info TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default superadmin if not exists
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('superadmin');
  if (!adminExists) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('masteradmin123', salt);
    db.prepare(`
      INSERT INTO admins (username, password_hash, full_name, email)
      VALUES (?, ?, ?, ?)
    `).run('superadmin', hash, 'MediStock Global Authority SuperAdmin', 'admin@medistock-licensing.local');
  }

  // Seed standard license plans
  const planExists = db.prepare('SELECT id FROM license_plans LIMIT 1').get();
  if (!planExists) {
    const plans = [
      { code: 'TRIAL', name: '14-Day Free Trial', days: 14, branches: 1, price: 0, desc: 'Full retail POS and inventory evaluation' },
      { code: 'RETAIL_STARTER', name: 'Retail Starter (1 Year)', days: 365, branches: 1, price: 499900, desc: 'Single-counter pharmacy POS, FEFO, and GST invoicing' },
      { code: 'PRO_ENTERPRISE', name: 'Professional ERP (1 Year)', days: 365, branches: 5, price: 999900, desc: 'Multi-branch sync, wholesale, double-entry accounting and analytics' },
      { code: 'LIFETIME_ULTRA', name: 'Enterprise Lifetime License', days: 36500, branches: 25, price: 2999900, desc: 'Perpetual unlimited license with priority phone support' },
    ];
    const insertPlan = db.prepare(`
      INSERT INTO license_plans (code, name, duration_days, max_branches, price_inr, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const p of plans) {
      insertPlan.run(p.code, p.name, p.days, p.branches, p.price, p.desc);
    }
  }

  // Seed initial demo licenses for testing
  const licExists = db.prepare('SELECT id FROM licenses LIMIT 1').get();
  if (!licExists) {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const insertLic = db.prepare(`
      INSERT INTO licenses (
        license_key, pharmacy_name, contact_person, phone, email,
        plan_code, max_branches, status, expires_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Pre-generated ready-to-use Professional License for Apex Pharmacy
    insertLic.run(
      'MEDI-APEX-2026-PRO9-8877',
      'Apex Pharmacy & Healthcare',
      'Rajesh Patel',
      '+91 98200 98200',
      'contact@apexpharmacy.local',
      'PRO_ENTERPRISE',
      5,
      'ACTIVE',
      oneYearLater,
      'Official Master License for Primary Store'
    );

    // 2. A 14-day evaluation license
    insertLic.run(
      'MEDI-DEMO-2026-TRIL-1400',
      'City Health Chemist',
      'Amit Shah',
      '+91 98111 22334',
      'amit@cityhealth.local',
      'TRIAL',
      1,
      'ACTIVE',
      twoWeeksLater,
      '14-Day Evaluation Key'
    );
  }
}

module.exports = {
  getLicenseDatabase,
  DB_PATH,
};
