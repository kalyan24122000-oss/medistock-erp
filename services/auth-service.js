// services/auth-service.js
// Authentication, Session management, and Role-Based Access Control

const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/db');

/**
 * Authenticates user credentials.
 * @param {string} username
 * @param {string} password
 * @returns {object|null} Sanitized user profile with role & branch details
 */
function login(username, password) {
  const db = getDatabase();

  const user = db.prepare(`
    SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.phone,
           u.role_id, u.branch_id, u.is_active,
           r.name as role_name, b.name as branch_name, b.code as branch_code
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.username = ?
  `).get(username.trim());

  if (!user) {
    return { success: false, message: 'Invalid username or password' };
  }

  if (!user.is_active) {
    return { success: false, message: 'This user account is inactive. Please contact administrator.' };
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return { success: false, message: 'Invalid username or password' };
  }

  // Update last login timestamp
  db.prepare(`
    UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(user.id);

  // Fetch active company & financial year
  const company = db.prepare('SELECT id, code, name, trade_name, gstin FROM companies LIMIT 1').get();
  const financialYear = db.prepare('SELECT id, code, start_date, end_date FROM financial_years WHERE is_active = 1 LIMIT 1').get();

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      roleId: user.role_id,
      roleName: user.role_name,
      branchId: user.branch_id,
      branchName: user.branch_name,
      branchCode: user.branch_code,
      company: company || null,
      financialYear: financialYear || null,
    },
  };
}

/**
 * Change password for a user.
 */
function changePassword(userId, oldPassword, newPassword) {
  const db = getDatabase();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return { success: false, message: 'Current password does not match' };
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, userId);

  return { success: true, message: 'Password updated successfully' };
}

/**
 * List all users.
 */
function listUsers() {
  const db = getDatabase();
  return db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login_at,
           r.name as role_name, b.name as branch_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.id ASC
  `).all();
}

/**
 * List roles.
 */
function listRoles() {
  const db = getDatabase();
  return db.prepare('SELECT id, name, description FROM roles ORDER BY id ASC').all();
}

/**
 * Create a new user.
 */
function createUser(userData) {
  const db = getDatabase();
  const { username, password, fullName, email, phone, roleId, branchId } = userData;

  if (!username || !password || !fullName || !roleId) {
    throw new Error('Username, password, full name, and role are required');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    throw new Error(`Username "${username}" already exists`);
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, email, phone, role_id, branch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username.trim(), hash, fullName.trim(), email || null, phone || null, roleId, branchId || null);

  return { success: true, id: result.lastInsertRowid };
}

module.exports = {
  login,
  changePassword,
  listUsers,
  listRoles,
  createUser,
};
