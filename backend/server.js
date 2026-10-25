// backend/server.js
// MediStock Central Licensing & Remote Administration REST API Server

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getLicenseDatabase } = require('./db');
const { generateLicenseKey, signLicensePayload } = require('./license-generator');

const PORT = process.env.PORT || 5000;
const ADMIN_PANEL_DIR = path.join(__dirname, '..', 'admin-panel');

// In-memory admin session storage (simple token -> admin object)
const activeAdminSessions = new Map();

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end(JSON.stringify(data));
}

function handleCors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end();
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function serveStaticFile(req, res, filePath) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// REST API Route Dispatcher
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle Preflight CORS
  if (method === 'OPTIONS') {
    return handleCors(res);
  }

  const db = getLicenseDatabase();

  try {
    // ==============================================================
    // 1. CLIENT DESKTOP ERP LICENSING ENDPOINTS
    // ==============================================================

    // POST /api/license/verify
    if (method === 'POST' && pathname === '/api/license/verify') {
      const body = await parseJsonBody(req);
      const { licenseKey, hardwareId } = body;

      if (!licenseKey) {
        return sendJson(res, 400, { success: false, message: 'License key is required' });
      }

      const lic = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey.trim());
      if (!lic) {
        return sendJson(res, 404, { success: false, message: 'License key not found in central registry' });
      }

      if (lic.status === 'REVOKED') {
        return sendJson(res, 403, { success: false, message: 'This license has been REVOKED by MediStock licensing authority' });
      }

      if (lic.status === 'SUSPENDED') {
        return sendJson(res, 403, { success: false, message: 'This license is temporarily SUSPENDED. Please contact your vendor.' });
      }

      const now = new Date();
      const expiresAt = new Date(lic.expires_at);
      if (expiresAt < now) {
        db.prepare("UPDATE licenses SET status = 'EXPIRED' WHERE id = ?").run(lic.id);
        return sendJson(res, 403, {
          success: false,
          isExpired: true,
          message: `License expired on ${lic.expires_at.split('T')[0]}. Please renew.`,
          expiresAt: lic.expires_at,
        });
      }

      // Check hardware binding
      if (lic.hardware_id && hardwareId && lic.hardware_id !== hardwareId) {
        db.prepare(`
          INSERT INTO license_logs (license_id, event_type, hardware_id, ip_address, details)
          VALUES (?, 'VERIFY_FAIL', ?, ?, ?)
        `).run(lic.id, hardwareId, getClientIp(req), `Hardware mismatch: Bound to ${lic.hardware_id}`);

        return sendJson(res, 403, {
          success: false,
          hardwareMismatch: true,
          message: 'License key is registered to a different computer. Please reset machine binding in Admin Panel.',
        });
      }

      const diffMs = expiresAt - now;
      const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return sendJson(res, 200, {
        success: true,
        valid: true,
        license: {
          key: lic.license_key,
          pharmacyName: lic.pharmacy_name,
          planCode: lic.plan_code,
          maxBranches: lic.max_branches,
          expiresAt: lic.expires_at,
          remainingDays,
          status: lic.status,
        },
      });
    }

    // POST /api/license/activate
    if (method === 'POST' && pathname === '/api/license/activate') {
      const body = await parseJsonBody(req);
      const { licenseKey, hardwareId, clientInfo } = body;

      if (!licenseKey || !hardwareId) {
        return sendJson(res, 400, { success: false, message: 'License key and Hardware ID are required' });
      }

      const lic = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey.trim());
      if (!lic) {
        return sendJson(res, 404, { success: false, message: 'Invalid license key. Check your invoice or purchase confirmation.' });
      }

      if (lic.status === 'REVOKED') {
        return sendJson(res, 403, { success: false, message: 'This license has been REVOKED by the administrator.' });
      }

      const now = new Date();
      const expiresAt = new Date(lic.expires_at);
      if (expiresAt < now) {
        return sendJson(res, 403, { success: false, message: `License has expired on ${lic.expires_at.split('T')[0]}.` });
      }

      // If already bound to another hardware ID
      if (lic.hardware_id && lic.hardware_id !== hardwareId) {
        return sendJson(res, 403, {
          success: false,
          message: `License is already activated on another machine (${lic.hardware_id}). Reset machine binding from the Admin Panel to transfer.`,
        });
      }

      // Bind machine and update heartbeat
      db.prepare(`
        UPDATE licenses
        SET hardware_id = ?, last_heartbeat_at = CURRENT_TIMESTAMP, status = 'ACTIVE'
        WHERE id = ?
      `).run(hardwareId, lic.id);

      // Audit log
      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, hardware_id, ip_address, client_info, details)
        VALUES (?, 'ACTIVATION', ?, ?, ?, ?)
      `).run(lic.id, hardwareId, getClientIp(req), JSON.stringify(clientInfo || {}), 'Machine activated successfully');

      const diffMs = expiresAt - now;
      const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Create signed activation payload for secure offline verification
      const rawPayload = {
        licenseKey: lic.license_key,
        pharmacyName: lic.pharmacy_name,
        planCode: lic.plan_code,
        maxBranches: lic.max_branches,
        hardwareId,
        issuedAt: lic.issued_at,
        expiresAt: lic.expires_at,
        activatedAt: now.toISOString(),
      };
      const signedPayload = signLicensePayload(rawPayload);

      return sendJson(res, 200, {
        success: true,
        message: 'License activated successfully! Welcome to MediStock ERP.',
        signedPayload,
        license: {
          key: lic.license_key,
          pharmacyName: lic.pharmacy_name,
          planCode: lic.plan_code,
          maxBranches: lic.max_branches,
          expiresAt: lic.expires_at,
          remainingDays,
          status: 'ACTIVE',
        },
      });
    }

    // POST /api/license/heartbeat
    if (method === 'POST' && pathname === '/api/license/heartbeat') {
      const body = await parseJsonBody(req);
      const { licenseKey, hardwareId, clientVersion } = body;

      if (!licenseKey) {
        return sendJson(res, 400, { success: false, message: 'License key is required' });
      }

      const lic = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey.trim());
      if (!lic) {
        return sendJson(res, 404, { success: false, message: 'License not found' });
      }

      // Update heartbeat
      db.prepare(`
        UPDATE licenses
        SET last_heartbeat_at = CURRENT_TIMESTAMP, client_version = ?
        WHERE id = ?
      `).run(clientVersion || '1.0.0', lic.id);

      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, hardware_id, ip_address, details)
        VALUES (?, 'HEARTBEAT', ?, ?, ?)
      `).run(lic.id, hardwareId || null, getClientIp(req), `Client heartbeat ping v${clientVersion || '1.0.0'}`);

      const now = new Date();
      const expiresAt = new Date(lic.expires_at);
      const isExpired = expiresAt < now;
      const diffMs = expiresAt - now;
      const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return sendJson(res, 200, {
        success: true,
        valid: !isExpired && lic.status === 'ACTIVE',
        status: isExpired ? 'EXPIRED' : lic.status,
        expiresAt: lic.expires_at,
        remainingDays,
      });
    }

    // ==============================================================
    // 2. ADMIN PORTAL ENDPOINTS
    // ==============================================================

    // POST /api/admin/login
    if (method === 'POST' && pathname === '/api/admin/login') {
      const body = await parseJsonBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJson(res, 400, { success: false, message: 'Username and password required' });
      }

      const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim());
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return sendJson(res, 401, { success: false, message: 'Invalid master admin credentials' });
      }

      // Generate session token
      const token = 'ADM-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      activeAdminSessions.set(token, {
        adminId: admin.id,
        username: admin.username,
        fullName: admin.full_name,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      db.prepare('UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

      return sendJson(res, 200, {
        success: true,
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          fullName: admin.full_name,
          email: admin.email,
        },
      });
    }

    // GET /api/admin/overview
    if (method === 'GET' && pathname === '/api/admin/overview') {
      const total = db.prepare('SELECT COUNT(*) as count FROM licenses').get().count;
      const active = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'ACTIVE' AND datetime(expires_at) > datetime('now')").get().count;
      const expired = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'EXPIRED' OR datetime(expires_at) <= datetime('now')").get().count;
      const revoked = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'REVOKED'").get().count;
      const todayHeartbeats = db.prepare("SELECT COUNT(*) as count FROM license_logs WHERE event_type = 'HEARTBEAT' AND date(created_at) = date('now')").get().count;

      const plans = db.prepare('SELECT * FROM license_plans ORDER BY price_inr ASC').all();
      const recentLogs = db.prepare(`
        SELECT l.*, lic.pharmacy_name, lic.license_key
        FROM license_logs l
        LEFT JOIN licenses lic ON l.license_id = lic.id
        ORDER BY l.id DESC
        LIMIT 10
      `).all();

      return sendJson(res, 200, {
        success: true,
        stats: {
          total,
          active,
          expired,
          revoked,
          todayHeartbeats,
        },
        plans,
        recentLogs,
      });
    }

    // GET /api/admin/licenses
    if (method === 'GET' && pathname === '/api/admin/licenses') {
      const search = parsedUrl.query.search || '';
      const statusFilter = parsedUrl.query.status || '';

      let query = 'SELECT * FROM licenses WHERE 1=1';
      const params = [];

      if (search) {
        query += ' AND (license_key LIKE ? OR pharmacy_name LIKE ? OR phone LIKE ? OR contact_person LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      if (statusFilter && statusFilter !== 'ALL') {
        query += ' AND status = ?';
        params.push(statusFilter);
      }

      query += ' ORDER BY id DESC';
      const licenses = db.prepare(query).all(...params);

      // Enhance with remaining days calculation
      const now = new Date();
      const enriched = licenses.map(lic => {
        const exp = new Date(lic.expires_at);
        const diffMs = exp - now;
        const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isExp = exp < now;

        return {
          ...lic,
          remainingDays: isExp ? 0 : remainingDays,
          computedStatus: lic.status === 'REVOKED' ? 'REVOKED' : isExp ? 'EXPIRED' : lic.status,
        };
      });

      return sendJson(res, 200, { success: true, licenses: enriched });
    }

    // POST /api/admin/licenses (Create fresh license key)
    if (method === 'POST' && pathname === '/api/admin/licenses') {
      const body = await parseJsonBody(req);
      const {
        pharmacyName,
        contactPerson = '',
        phone = '',
        email = '',
        planCode = 'RETAIL_STARTER',
        durationDays = 365,
        maxBranches = 1,
        notes = '',
        customKey = null,
      } = body;

      if (!pharmacyName) {
        return sendJson(res, 400, { success: false, message: 'Pharmacy name is required' });
      }

      const finalKey = customKey ? customKey.trim().toUpperCase() : generateLicenseKey('MEDI');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (Number(durationDays) || 365) * 24 * 60 * 60 * 1000).toISOString();

      const insertRes = db.prepare(`
        INSERT INTO licenses (
          license_key, pharmacy_name, contact_person, phone, email,
          plan_code, max_branches, status, expires_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        finalKey, pharmacyName.trim(), contactPerson.trim(), phone.trim(), email.trim(),
        planCode, Number(maxBranches) || 1, expiresAt, notes || 'Generated via Central Admin Portal'
      );

      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, details)
        VALUES (?, 'ACTIVATION', ?)
      `).run(insertRes.lastInsertRowid, `License created for "${pharmacyName}" (${planCode}, ${durationDays} days)`);

      const newLic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(insertRes.lastInsertRowid);
      return sendJson(res, 201, {
        success: true,
        message: 'License key successfully created!',
        license: newLic,
      });
    }

    // PUT /api/admin/licenses/renew
    if (method === 'PUT' && pathname.startsWith('/api/admin/licenses/') && pathname.endsWith('/renew')) {
      const parts = pathname.split('/');
      const id = parseInt(parts[4], 10);
      const body = await parseJsonBody(req);
      const addDays = Number(body.addDays) || 365;

      const lic = db.prepare('SELECT * FROM licenses WHERE id = ?').get(id);
      if (!lic) return sendJson(res, 404, { success: false, message: 'License not found' });

      const currentExpiry = new Date(lic.expires_at);
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString();

      db.prepare("UPDATE licenses SET expires_at = ?, status = 'ACTIVE' WHERE id = ?").run(newExpiry, id);
      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, details)
        VALUES (?, 'EXTENDED', ?)
      `).run(id, `License extended by ${addDays} days until ${newExpiry.split('T')[0]}`);

      return sendJson(res, 200, { success: true, message: `License renewed until ${newExpiry.split('T')[0]}`, newExpiry });
    }

    // PUT /api/admin/licenses/status
    if (method === 'PUT' && pathname.startsWith('/api/admin/licenses/') && pathname.endsWith('/status')) {
      const parts = pathname.split('/');
      const id = parseInt(parts[4], 10);
      const body = await parseJsonBody(req);
      const { status } = body;

      if (!status || !['ACTIVE', 'REVOKED', 'SUSPENDED'].includes(status)) {
        return sendJson(res, 400, { success: false, message: 'Invalid status' });
      }

      db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run(status, id);
      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, details)
        VALUES (?, 'REVOKED', ?)
      `).run(id, `Status updated to ${status}`);

      return sendJson(res, 200, { success: true, message: `License status changed to ${status}` });
    }

    // PUT /api/admin/licenses/reset-hardware
    if (method === 'PUT' && pathname.startsWith('/api/admin/licenses/') && pathname.endsWith('/reset-hardware')) {
      const parts = pathname.split('/');
      const id = parseInt(parts[4], 10);

      db.prepare('UPDATE licenses SET hardware_id = NULL WHERE id = ?').run(id);
      db.prepare(`
        INSERT INTO license_logs (license_id, event_type, details)
        VALUES (?, 'HWID_RESET', 'Machine binding cleared by administrator')
      `).run(id);

      return sendJson(res, 200, { success: true, message: 'Hardware binding cleared. Customer can now activate on a new machine.' });
    }

    // GET /api/admin/logs
    if (method === 'GET' && pathname === '/api/admin/logs') {
      const logs = db.prepare(`
        SELECT l.*, lic.pharmacy_name, lic.license_key
        FROM license_logs l
        LEFT JOIN licenses lic ON l.license_id = lic.id
        ORDER BY l.id DESC
        LIMIT 50
      `).all();
      return sendJson(res, 200, { success: true, logs });
    }

    // ==============================================================
    // 3. STATIC FILE SERVER FOR ADMIN PANEL SPA
    // ==============================================================

    if (pathname === '/' || pathname === '/admin' || pathname === '/admin/') {
      return serveStaticFile(req, res, path.join(ADMIN_PANEL_DIR, 'index.html'));
    }

    // Serve CSS, JS, Assets
    let staticFilePath = path.join(ADMIN_PANEL_DIR, pathname.replace(/^\/admin\//, '/'));
    if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
      return serveStaticFile(req, res, staticFilePath);
    }

    // Fallback 404
    sendJson(res, 404, { success: false, message: `Route ${pathname} not found on license server` });
  } catch (err) {
    console.error('License Server Error:', err);
    sendJson(res, 500, { success: false, message: `Internal server error: ${err.message}` });
  }
});

function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[MediStock Licensing Backend] Server active at http://localhost:${port}`);
      console.log(`[MediStock Admin Portal] Open in browser: http://localhost:${port}/admin`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
};
