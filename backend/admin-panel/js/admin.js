// admin-panel/js/admin.js
// Client logic for MediStock Licensing Authority & Remote Management Portal

const API_BASE = (window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? window.location.origin
  : 'https://medistock-erp-01tu.onrender.com';

window.AdminApp = {
  currentAdmin: null,
  token: localStorage.getItem('medistock_admin_token') || null,
  licenses: [],
  plans: [],

  init() {
    this.checkAuth();
    this.bindEvents();
  },

  async apiRequest(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = { method, headers };
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }
      return json;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-box';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  showModal(title, bodyHtml, footerHtml = '') {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="admin-modal-overlay">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="AdminApp.closeModal()">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;

    document.getElementById('admin-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'admin-modal-overlay') {
        AdminApp.closeModal();
      }
    });
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
  },

  checkAuth() {
    const savedAdmin = localStorage.getItem('medistock_admin_user');
    if (savedAdmin && this.token) {
      try {
        this.currentAdmin = JSON.parse(savedAdmin);
        const nameElem = document.getElementById('admin-display-name');
        if (nameElem) nameElem.textContent = this.currentAdmin.fullName || this.currentAdmin.username;
        this.loadDashboard();
      } catch (e) {
        this.showLoginModal();
      }
    } else {
      this.showLoginModal();
    }
  },

  showLoginModal() {
    const bodyHtml = `
      <form id="admin-login-form">
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
          Enter master authority credentials to manage software keys, client activations, and machine bindings.
        </p>

        <div class="form-group">
          <label class="form-label">Master Username</label>
          <input type="text" id="login-username" class="form-control" value="superadmin" required autofocus>
        </div>

        <div class="form-group">
          <label class="form-label">Master Password</label>
          <input type="password" id="login-password" class="form-control" value="masteradmin123" required>
        </div>

        <div style="background: rgba(99, 102, 241, 0.1); border: 1px dashed var(--primary); padding: 10px; border-radius: var(--radius); font-size: 11px; margin-bottom: 14px; color: #a5b4fc;">
          <strong>Demo Master Credentials:</strong><br>
          Username: <code>superadmin</code> | Password: <code>masteradmin123</code>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px;">
          🔐 Sign In to Authority Portal
        </button>
      </form>
    `;

    this.showModal('🔐 SuperAdmin Security Login', bodyHtml, '');

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await this.apiRequest('/api/admin/login', 'POST', { username, password });
        if (res.success) {
          this.token = res.token;
          this.currentAdmin = res.admin;
          localStorage.setItem('medistock_admin_token', res.token);
          localStorage.setItem('medistock_admin_user', JSON.stringify(res.admin));

          const nameElem = document.getElementById('admin-display-name');
          if (nameElem) nameElem.textContent = res.admin.fullName;

          this.toast(`Authenticated as ${res.admin.fullName}`, 'success');
          this.closeModal();
          this.loadDashboard();
        }
      } catch (err) {
        this.toast(`Authentication failed: ${err.message}`, 'error');
      }
    });
  },

  logout() {
    this.token = null;
    this.currentAdmin = null;
    localStorage.removeItem('medistock_admin_token');
    localStorage.removeItem('medistock_admin_user');
    this.toast('Signed out from authority portal', 'info');
    this.showLoginModal();
  },

  async loadDashboard() {
    try {
      await Promise.all([
        this.loadOverviewStats(),
        this.loadLicenses(),
        this.loadLogs(),
      ]);
    } catch (err) {
      console.warn('Dashboard load warning:', err.message);
    }
  },

  async loadOverviewStats() {
    try {
      const res = await this.apiRequest('/api/admin/overview');
      if (res.success) {
        document.getElementById('kpi-total-licenses').textContent = res.stats.total;
        document.getElementById('kpi-active-licenses').textContent = res.stats.active;
        document.getElementById('kpi-expired-licenses').textContent = res.stats.expired;
        document.getElementById('kpi-revoked-licenses').textContent = res.stats.revoked;
        document.getElementById('kpi-heartbeats').textContent = res.stats.todayHeartbeats;
        this.plans = res.plans || [];
      }
    } catch (e) {
      document.getElementById('server-status-pill').style.background = '#7f1d1d';
      document.getElementById('server-status-pill').style.color = '#fecaca';
      document.getElementById('server-status-text').textContent = 'Backend Offline';
    }
  },

  async loadLicenses() {
    const search = document.getElementById('license-search-input').value.trim();
    const status = document.getElementById('status-filter-select').value;

    const tbody = document.getElementById('licenses-table-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Fetching licenses...</td></tr>';

    try {
      const query = `?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
      const res = await this.apiRequest(`/api/admin/licenses${query}`);
      this.licenses = res.licenses || [];

      document.getElementById('table-count-label').textContent = `Showing ${this.licenses.length} registered license(s)`;

      if (this.licenses.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 28px; color: var(--text-muted);">
              No licenses match your search criteria. Click "+ Generate New License Key" above to issue one.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = this.licenses.map(lic => {
        const badgeClass = lic.computedStatus === 'ACTIVE' ? 'active' : lic.computedStatus === 'EXPIRED' ? 'expired' : 'revoked';
        const hwidDisplay = lic.hardware_id
          ? `<span style="font-family: var(--font-mono); color: #38bdf8;">${lic.hardware_id}</span>`
          : `<span style="color: #fbbf24; font-style: italic;">Unbound (Any PC)</span>`;

        return `
          <tr>
            <td>
              <div class="key-code">
                <span>${lic.license_key}</span>
                <button class="copy-mini-btn" onclick="AdminApp.copyText('${lic.license_key}', 'License Key')" title="Copy key">📋</button>
              </div>
            </td>
            <td>
              <strong>${lic.pharmacy_name}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${lic.contact_person || 'N/A'} ${lic.phone ? '• ' + lic.phone : ''}</div>
            </td>
            <td><span class="badge plan">${lic.plan_code}</span></td>
            <td><strong>${lic.max_branches}</strong></td>
            <td>${hwidDisplay}</td>
            <td>
              <div>${lic.expires_at ? lic.expires_at.split('T')[0] : 'N/A'}</div>
              <div style="font-size: 10.5px; color: ${lic.remainingDays > 30 ? 'var(--success)' : 'var(--warning)'}; font-weight: 600;">
                ${lic.remainingDays > 0 ? lic.remainingDays + ' days left' : 'Expired'}
              </div>
            </td>
            <td><span class="badge ${badgeClass}">${lic.computedStatus}</span></td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 4px; justify-content: flex-end;">
                ${lic.hardware_id ? `<button class="btn btn-outline btn-sm" onclick="AdminApp.resetHwid(${lic.id})" title="Allow client to activate on new machine">🔄 Reset HWID</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick="AdminApp.openRenewModal(${lic.id})" title="Extend validity">➕ Renew</button>
                ${lic.status === 'ACTIVE'
                  ? `<button class="btn btn-danger btn-sm" onclick="AdminApp.changeStatus(${lic.id}, 'REVOKED')" title="Revoke access">⛔ Revoke</button>`
                  : `<button class="btn btn-success btn-sm" onclick="AdminApp.changeStatus(${lic.id}, 'ACTIVE')" title="Reactivate license">✅ Activate</button>`
                }
                <button class="btn btn-outline btn-sm" onclick="AdminApp.showCertificate(${lic.id})" title="View Certificate">📜 Cert</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 20px;">Failed to load licenses: ${err.message}</td></tr>`;
    }
  },

  async loadLogs() {
    const tbody = document.getElementById('audit-logs-body');
    try {
      const res = await this.apiRequest('/api/admin/logs');
      const logs = res.logs || [];

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 18px; color: var(--text-muted);">No telemetry events recorded yet.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-size: 11px; color: var(--text-muted);">${l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : ''}</td>
          <td><span class="badge ${l.event_type === 'ACTIVATION' ? 'active' : l.event_type === 'HEARTBEAT' ? 'plan' : 'revoked'}">${l.event_type}</span></td>
          <td><strong>${l.pharmacy_name || 'System / Unassigned'}</strong> ${l.license_key ? `<br><code style="font-size: 10px;">${l.license_key}</code>` : ''}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;">${l.hardware_id || '-'}</td>
          <td style="font-size: 11px;">${l.ip_address || '127.0.0.1'}</td>
          <td style="font-size: 11.5px; color: #cbd5e1;">${l.details || ''}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Error loading logs:', e);
    }
  },

  openGenerateModal() {
    const bodyHtml = `
      <form id="generate-license-form">
        <div class="form-group">
          <label class="form-label">Pharmacy / Hospital / Store Name *</label>
          <input type="text" id="gen-pharmacy" class="form-control" placeholder="e.g. Sunrise Chemist & Druggist" required autofocus>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contact Person</label>
            <input type="text" id="gen-contact" class="form-control" placeholder="Owner / Pharmacist Name">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="gen-phone" class="form-control" placeholder="+91 98765 43210">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Client Email</label>
          <input type="email" id="gen-email" class="form-control" placeholder="billing@sunrisechemist.local">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">License Plan</label>
            <select id="gen-plan" class="form-control">
              <option value="RETAIL_STARTER">Retail Starter (1 Year - Single Counter)</option>
              <option value="PRO_ENTERPRISE" selected>Professional ERP (1 Year - Multi-Branch)</option>
              <option value="LIFETIME_ULTRA">Enterprise Lifetime (Unlimited)</option>
              <option value="TRIAL">14-Day Free Evaluation Trial</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Allowed Branches</label>
            <input type="number" id="gen-branches" class="form-control" value="1" min="1" max="100">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Validity Duration (Days)</label>
          <div style="display: flex; gap: 8px; margin-bottom: 6px;">
            <button type="button" class="btn btn-outline btn-sm duration-btn" data-days="14">14 Days</button>
            <button type="button" class="btn btn-outline btn-sm duration-btn" data-days="365">1 Year</button>
            <button type="button" class="btn btn-outline btn-sm duration-btn" data-days="1095">3 Years</button>
            <button type="button" class="btn btn-outline btn-sm duration-btn" data-days="36500">Lifetime</button>
          </div>
          <input type="number" id="gen-days" class="form-control" value="365" min="1" required>
        </div>

        <div class="form-group">
          <label class="form-label">Internal Vendor Notes</label>
          <input type="text" id="gen-notes" class="form-control" placeholder="Invoice #, representative notes...">
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px; margin-top: 10px;">
          ✨ Generate Secure Key & Activate
        </button>
      </form>
    `;

    this.showModal('✨ Generate Customer Software License', bodyHtml, '');

    // Duration quick click
    document.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('gen-days').value = btn.dataset.days;
      });
    });

    document.getElementById('generate-license-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        pharmacyName: document.getElementById('gen-pharmacy').value.trim(),
        contactPerson: document.getElementById('gen-contact').value.trim(),
        phone: document.getElementById('gen-phone').value.trim(),
        email: document.getElementById('gen-email').value.trim(),
        planCode: document.getElementById('gen-plan').value,
        maxBranches: parseInt(document.getElementById('gen-branches').value, 10) || 1,
        durationDays: parseInt(document.getElementById('gen-days').value, 10) || 365,
        notes: document.getElementById('gen-notes').value.trim(),
      };

      try {
        const res = await this.apiRequest('/api/admin/licenses', 'POST', payload);
        if (res.success) {
          this.toast('License key generated successfully!', 'success');
          this.closeModal();
          this.showCertificate(res.license.id);
          this.loadDashboard();
        }
      } catch (err) {
        this.toast(`Failed to generate key: ${err.message}`, 'error');
      }
    });
  },

  showCertificate(licenseId) {
    const lic = this.licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const bodyHtml = `
      <div class="cert-card">
        <div class="cert-header">
          <div>
            <h4 style="font-size: 15px; color: #fff;">MediStock ERP — Software License Certificate</h4>
            <span style="font-size: 11px; color: #a5b4fc;">Official Customer Activation Voucher</span>
          </div>
          <span class="badge active">${lic.plan_code}</span>
        </div>

        <div style="font-size: 12px; line-height: 1.6; margin-bottom: 12px;">
          <div><strong>Licensed Pharmacy:</strong> ${lic.pharmacy_name}</div>
          <div><strong>Contact Person:</strong> ${lic.contact_person || 'Owner'} (${lic.phone || 'N/A'})</div>
          <div><strong>Valid Until:</strong> ${lic.expires_at ? lic.expires_at.split('T')[0] : 'Perpetual'}</div>
          <div><strong>Branch Limit:</strong> ${lic.max_branches} Store(s)</div>
        </div>

        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Customer License Key:</div>
        <div class="cert-key" id="cert-key-val">${lic.license_key}</div>

        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px;">
          <button class="btn btn-primary" onclick="AdminApp.copyText('${lic.license_key}', 'License Key')">
            📋 Copy Key
          </button>
          <button class="btn btn-outline" onclick="AdminApp.copyClientTemplate(${lic.id})">
            📱 Copy WhatsApp / Email Notice
          </button>
        </div>
      </div>
    `;

    this.showModal(`License Certificate — ${lic.pharmacy_name}`, bodyHtml, '<button class="btn btn-outline" onclick="AdminApp.closeModal()">Close</button>');
  },

  openRenewModal(licenseId) {
    const lic = this.licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const bodyHtml = `
      <div>
        <p style="font-size: 12.5px; margin-bottom: 12px;">
          Extend validity for <strong>${lic.pharmacy_name}</strong> (Current Expiry: <code>${lic.expires_at ? lic.expires_at.split('T')[0] : ''}</code>).
        </p>

        <div class="form-group">
          <label class="form-label">Extension Duration</label>
          <select id="renew-days" class="form-control">
            <option value="30">+30 Days Extension</option>
            <option value="90">+90 Days (Quarterly Renewal)</option>
            <option value="365" selected>+1 Year (365 Days Standard Renewal)</option>
            <option value="1095">+3 Years (Extended Contract)</option>
          </select>
        </div>

        <button class="btn btn-success" style="width: 100%; margin-top: 8px;" onclick="AdminApp.submitRenew(${lic.id})">
          Confirm Renewal
        </button>
      </div>
    `;

    this.showModal(`Renew Subscription — ${lic.pharmacy_name}`, bodyHtml, '');
  },

  async submitRenew(licenseId) {
    const addDays = parseInt(document.getElementById('renew-days').value, 10);
    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/renew`, 'PUT', { addDays });
      if (res.success) {
        this.toast(res.message, 'success');
        this.closeModal();
        this.loadDashboard();
      }
    } catch (err) {
      this.toast(`Renewal failed: ${err.message}`, 'error');
    }
  },

  async changeStatus(licenseId, status) {
    const confirmMsg = status === 'REVOKED'
      ? 'Are you sure you want to REVOKE this license? The customer desktop app will block transactions immediately.'
      : 'Reactivate this customer license?';

    if (!confirm(confirmMsg)) return;

    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/status`, 'PUT', { status });
      if (res.success) {
        this.toast(res.message, 'success');
        this.loadDashboard();
      }
    } catch (err) {
      this.toast(`Failed: ${err.message}`, 'error');
    }
  },

  async resetHwid(licenseId) {
    if (!confirm('Clear bound Hardware ID? The customer will be able to activate their key on a new computer.')) return;

    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/reset-hardware`, 'PUT', {});
      if (res.success) {
        this.toast(res.message, 'success');
        this.loadDashboard();
      }
    } catch (err) {
      this.toast(`Reset failed: ${err.message}`, 'error');
    }
  },

  copyText(text, label = 'Text') {
    navigator.clipboard.writeText(text);
    this.toast(`${label} copied to clipboard!`, 'success');
  },

  copyClientTemplate(licenseId) {
    const lic = this.licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const text = `*MEDISTOCK ERP SOFTWARE ACTIVATION CERTIFICATE*
---------------------------------------
Dear ${lic.contact_person || lic.pharmacy_name},
Thank you for choosing MediStock ERP for your pharmacy management.

Pharmacy: ${lic.pharmacy_name}
Plan: ${lic.plan_code}
Valid Until: ${lic.expires_at ? lic.expires_at.split('T')[0] : 'Perpetual'}

*YOUR LICENSE KEY:*
${lic.license_key}

*How to Activate:*
1. Launch MediStock ERP on your Windows desktop.
2. Enter your License Key when prompted.
3. Click "Activate License" to start billing immediately.

For technical support: support@medistock-erp.local
---------------------------------------`;

    this.copyText(text, 'Customer activation template');
  },

  bindEvents() {
    const btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => this.logout());

    const btnRefresh = document.getElementById('btn-refresh-list');
    if (btnRefresh) btnRefresh.addEventListener('click', () => this.loadLicenses());

    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', () => this.loadLogs());

    const btnOpenGen = document.getElementById('btn-open-generate-modal');
    if (btnOpenGen) btnOpenGen.addEventListener('click', () => this.openGenerateModal());

    const searchInput = document.getElementById('license-search-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.loadLicenses(), 300);
      });
    }

    const filterSelect = document.getElementById('status-filter-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => this.loadLicenses());
    }

    // Auto-refresh telemetry every 30 seconds
    setInterval(() => {
      if (this.token) {
        this.loadOverviewStats();
        this.loadLogs();
      }
    }, 30000);
  },
};

// Bootstrap Admin App on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.AdminApp.init();
});
