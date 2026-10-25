// superadmin-desktop/renderer/js/app.js
// Client Controller for MediStock SuperAdmin GUI Desktop Software

const BACKEND_URL = 'http://localhost:5000';

window.SuperAdminApp = {
  currentAdmin: null,
  token: localStorage.getItem('sa_token') || null,
  activeView: 'dashboard',
  licenses: [],
  plans: [],
  stats: null,

  async init() {
    this.initClock();
    this.bindNavigation();
    this.bindShortcuts();
    await this.checkServerStatus();

    // Check login session
    if (this.token && localStorage.getItem('sa_admin_user')) {
      try {
        this.currentAdmin = JSON.parse(localStorage.getItem('sa_admin_user'));
        this.updateAdminHeader();
        await this.navigate(this.activeView);
      } catch (e) {
        this.showLoginModal();
      }
    } else {
      this.showLoginModal();
    }
  },

  async checkServerStatus() {
    const pill = document.getElementById('sa-server-status-pill');
    const text = document.getElementById('sa-server-status-text');

    try {
      if (window.superadminApi && window.superadminApi.checkBackendStatus) {
        const res = await window.superadminApi.checkBackendStatus();
        if (res.online) {
          pill.className = 'sa-server-status';
          text.textContent = `Backend Online: ${res.url}`;
          return true;
        }
      }
      // Fallback direct fetch
      const resp = await fetch(`${BACKEND_URL}/api/admin/overview`);
      if (resp.ok) {
        pill.className = 'sa-server-status';
        text.textContent = `Backend Online: ${BACKEND_URL}`;
        return true;
      }
    } catch (e) {
      pill.className = 'sa-server-status offline';
      text.textContent = 'Backend Offline (Retrying...)';
      return false;
    }
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

    const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || `Server returned HTTP ${res.status}`);
    }
    return json;
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('sa-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `sa-toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  showModal(title, bodyHtml, footerHtml = '', size = 'md') {
    const container = document.getElementById('sa-modal-container');
    const sizeClass = size === 'lg' ? 'modal-lg' : '';

    container.innerHTML = `
      <div class="modal-overlay" id="active-sa-modal">
        <div class="modal-dialog ${sizeClass}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="SuperAdminApp.closeModal()">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;

    document.getElementById('active-sa-modal').addEventListener('click', (e) => {
      if (e.target.id === 'active-sa-modal') SuperAdminApp.closeModal();
    });
  },

  closeModal() {
    const container = document.getElementById('sa-modal-container');
    if (container) container.innerHTML = '';
  },

  updateAdminHeader() {
    const nameElem = document.getElementById('sa-display-name');
    if (nameElem && this.currentAdmin) {
      nameElem.textContent = this.currentAdmin.fullName || this.currentAdmin.username;
    }
  },

  initClock() {
    const clock = document.getElementById('sa-live-clock');
    if (!clock) return;
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString('en-IN', { hour12: true });
    };
    tick();
    setInterval(tick, 1000);
  },

  bindNavigation() {
    document.querySelectorAll('.sa-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) this.navigate(view);
      });
    });

    const btnQuick = document.getElementById('btn-quick-issue-license');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => this.navigate('generator'));
    }

    const btnLogout = document.getElementById('btn-sa-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }
  },

  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.altKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        this.navigate('generator');
      } else if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  async navigate(viewName) {
    this.activeView = viewName;
    document.querySelectorAll('.sa-nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    const content = document.getElementById('sa-content');
    if (!content) return;

    content.innerHTML = `<div style="text-align: center; padding: 60px; color: var(--text-muted);">
      <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
      Loading ${viewName}...
    </div>`;

    try {
      if (viewName === 'dashboard') await this.renderDashboard(content);
      else if (viewName === 'consumers') await this.renderConsumers(content);
      else if (viewName === 'generator') await this.renderGenerator(content);
      else if (viewName === 'hardware') await this.renderHardware(content);
      else if (viewName === 'settings') await this.renderSettings(content);
    } catch (err) {
      content.innerHTML = `<div class="card" style="border-color: var(--danger);">
        <h3 style="color: var(--danger);">Failed to load ${viewName}</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">${err.message}</p>
        <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SuperAdminApp.navigate('${viewName}')">🔄 Retry</button>
      </div>`;
    }
  },

  showLoginModal() {
    const bodyHtml = `
      <form id="sa-login-form">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="assets/logo.png" style="max-width: 180px; margin: 0 auto 12px; display: block; background: #ffffff; border-radius: 8px; padding: 4px;">
          <h2 style="font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 6px;">SuperAdmin Console Login</h2>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">PharmaDesk Technologies • Licensing Authority</p>
        </div>

        <div class="form-group">
          <label class="form-label">SuperAdmin Username</label>
          <input type="text" id="sa-login-user" class="form-control" placeholder="Enter SuperAdmin username" required autofocus>
        </div>

        <div class="form-group">
          <label class="form-label">Master Password</label>
          <input type="password" id="sa-login-pass" class="form-control" placeholder="Enter master password" required>
        </div>

        <button type="submit" class="btn btn-gold btn-lg" style="width: 100%; margin-top: 10px;" id="btn-sa-login-submit">
          🔐 Unlock SuperAdmin Console
        </button>

        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11px; font-weight: 700; color: var(--primary); text-align: center; text-transform: uppercase;">
          Proud Production of ByteSphere
        </div>
      </form>
    `;

    this.showModal('SuperAdmin Authentication', bodyHtml, '', 'sm');

    const form = document.getElementById('sa-login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('sa-login-user').value.trim();
        const password = document.getElementById('sa-login-pass').value;
        const btn = document.getElementById('btn-sa-login-submit');

        btn.disabled = true;
        btn.textContent = '⏳ Verifying Credentials...';

        try {
          const res = await this.apiRequest('/api/admin/login', 'POST', { username, password });
          if (res.success) {
            this.token = res.token;
            this.currentAdmin = res.admin;
            localStorage.setItem('sa_token', res.token);
            localStorage.setItem('sa_admin_user', JSON.stringify(res.admin));

            this.toast(`Welcome, ${res.admin.fullName || res.admin.username}!`, 'success');
            this.updateAdminHeader();
            this.closeModal();
            this.navigate('dashboard');
          }
        } catch (err) {
          this.toast(err.message || 'Login failed', 'error');
          btn.disabled = false;
          btn.textContent = '🔐 Unlock SuperAdmin Console';
        }
      });
    }
  },

  logout() {
    this.token = null;
    this.currentAdmin = null;
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_admin_user');
    this.toast('Signed out of SuperAdmin console', 'info');
    this.showLoginModal();
  },

  // ==============================================================
  // VIEW 1: EXECUTIVE DASHBOARD
  // ==============================================================
  async renderDashboard(container) {
    const data = await this.apiRequest('/api/admin/overview');
    this.stats = data.stats;
    this.plans = data.plans;

    const estimatedRevenue = (data.stats.total * 8500).toLocaleString('en-IN');

    container.innerHTML = `
      <div class="card" style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(245, 158, 11, 0.05)); border-color: rgba(14, 165, 233, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase; letter-spacing: 1px;">
              👑 Company Owner Master Portal
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 4px;">
              MediStock Licensing & Fleet Command
            </h2>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Manage consumer pharmacy licenses, machine hardware bindings, and subscription tiers.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-gold btn-sm" onclick="SuperAdminApp.navigate('generator')">
              ➕ Issue New License
            </button>
            <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.navigate('consumers')">
              🏢 View Consumers
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Statistics Grid -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-left: 4px solid var(--primary);">
          <div class="kpi-label">Total Issued Licenses</div>
          <div class="kpi-value">${data.stats.total}</div>
          <div class="kpi-sub">Registered Pharmacy Consumers</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--success);">
          <div class="kpi-label">Active Deployments</div>
          <div class="kpi-value" style="color: #34d399;">${data.stats.active}</div>
          <div class="kpi-sub">Authorized & In Validity</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--warning);">
          <div class="kpi-label">Expired Licenses</div>
          <div class="kpi-value" style="color: #fbbf24;">${data.stats.expired}</div>
          <div class="kpi-sub">Pending Subscription Renewal</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--danger);">
          <div class="kpi-label">Revoked / Suspended</div>
          <div class="kpi-value" style="color: #f87171;">${data.stats.revoked}</div>
          <div class="kpi-sub">Access Terminated by Owner</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--gold);">
          <div class="kpi-label">Telemetry Pings (Today)</div>
          <div class="kpi-value" style="color: #f59e0b;">${data.stats.todayHeartbeats}</div>
          <div class="kpi-sub">Active Machine Heartbeats</div>
        </div>
      </div>

      <!-- Plans & Recent Activity Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Standard Plans -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📦 Commercial License Packages</div>
            <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.navigate('generator')">Issue Package &rarr;</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${(data.plans || []).map(p => `
              <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${p.name}</div>
                  <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                    Validity: ${p.duration_days} Days • Max Counters: ${p.max_branches}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 14px; font-weight: 800; color: var(--gold);">
                    ${p.price_inr === 0 ? 'FREE TRIAL' : '₹ ' + (p.price_inr / 100).toLocaleString('en-IN')}
                  </div>
                  <span class="badge info" style="font-size: 9.5px;">${p.code}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Recent Audit & Heartbeats -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🛰️ Recent Telemetry & Fleet Events</div>
            <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.navigate('hardware')">All Logs &rarr;</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(data.recentLogs || []).slice(0, 6).map(l => `
              <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                <div>
                  <span class="badge ${l.event_type === 'ACTIVATION' ? 'success' : l.event_type === 'HWID_RESET' ? 'warning' : 'info'}" style="margin-right: 6px;">
                    ${l.event_type}
                  </span>
                  <strong style="color: #ffffff;">${l.pharmacy_name || 'Consumer'}</strong>
                  <span style="color: var(--text-dim); margin-left: 6px;">${l.details || ''}</span>
                </div>
                <div style="color: var(--text-dim); font-size: 10.5px; font-family: var(--font-mono);">
                  ${new Date(l.created_at).toLocaleTimeString('en-IN')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // ==============================================================
  // VIEW 2: CONSUMER PHARMACIES DIRECTORY
  // ==============================================================
  async renderConsumers(container) {
    const res = await this.apiRequest('/api/admin/licenses');
    this.licenses = res.licenses || [];

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🏢 Consumer Pharmacies & Active Deployments</div>
            <p style="font-size: 11.5px; color: var(--text-dim); margin-top: 2px;">
              Total Registered Consumers: <strong>${this.licenses.length}</strong>
            </p>
          </div>
          <button class="btn btn-gold btn-sm" onclick="SuperAdminApp.navigate('generator')">
            ➕ Issue License to Consumer
          </button>
        </div>

        <!-- Search & Filter Bar -->
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
          <input type="text" id="consumer-search-input" class="form-control" style="max-width: 380px;"
                 placeholder="Search by Pharmacy, Owner Name, Phone, or Key...">
          <div style="display: flex; gap: 6px;" id="filter-status-buttons">
            <button class="btn btn-primary btn-sm status-filter active" data-filter="ALL">All Consumers</button>
            <button class="btn btn-outline btn-sm status-filter" data-filter="ACTIVE">Active</button>
            <button class="btn btn-outline btn-sm status-filter" data-filter="EXPIRED">Expired</button>
            <button class="btn btn-outline btn-sm status-filter" data-filter="REVOKED">Revoked</button>
          </div>
        </div>

        <!-- Directory Table -->
        <div class="table-container">
          <table class="data-table" id="consumers-table">
            <thead>
              <tr>
                <th>Consumer Pharmacy / Client</th>
                <th>Plan Tier</th>
                <th>License Key</th>
                <th>Hardware ID (Machine Binding)</th>
                <th>Remaining</th>
                <th>Status</th>
                <th style="text-align: right;">Owner Actions</th>
              </tr>
            </thead>
            <tbody id="consumers-table-body">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.renderConsumerRows(this.licenses);

    // Bind search
    const searchInp = document.getElementById('consumer-search-input');
    searchInp.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const filtered = this.licenses.filter(l => 
        (l.pharmacy_name && l.pharmacy_name.toLowerCase().includes(term)) ||
        (l.contact_person && l.contact_person.toLowerCase().includes(term)) ||
        (l.phone && l.phone.includes(term)) ||
        (l.license_key && l.license_key.toLowerCase().includes(term)) ||
        (l.hardware_id && l.hardware_id.toLowerCase().includes(term))
      );
      this.renderConsumerRows(filtered);
    });

    // Bind filter buttons
    document.querySelectorAll('.status-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-filter').forEach(b => b.className = 'btn btn-outline btn-sm status-filter');
        btn.className = 'btn btn-primary btn-sm status-filter active';
        const filter = btn.dataset.filter;
        if (filter === 'ALL') {
          this.renderConsumerRows(this.licenses);
        } else {
          this.renderConsumerRows(this.licenses.filter(l => l.computedStatus === filter));
        }
      });
    });
  },

  renderConsumerRows(licenses) {
    const tbody = document.getElementById('consumers-table-body');
    if (!tbody) return;

    if (!licenses || licenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-dim);">No consumer licenses found matching filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = licenses.map(l => {
      const isBound = !!l.hardware_id;
      const hwidBadge = isBound
        ? `<span class="key-code" style="font-size: 10.5px; color: #38bdf8;" title="Locked to this machine">${l.hardware_id}</span>`
        : `<span class="badge warning" style="font-size: 9.5px;">Unbound (Transferable)</span>`;

      const statusBadge = l.computedStatus === 'ACTIVE'
        ? `<span class="badge success">Active</span>`
        : l.computedStatus === 'REVOKED'
        ? `<span class="badge danger">Revoked</span>`
        : `<span class="badge warning">Expired</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #ffffff; font-size: 13px;">${l.pharmacy_name}</div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
              ${l.contact_person || 'Owner'} • ${l.phone || 'No Phone'}
            </div>
          </td>
          <td>
            <span class="badge info">${l.plan_code}</span>
            <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${l.max_branches} Counter(s)</div>
          </td>
          <td>
            <span class="key-code">${l.license_key}</span>
            <button class="btn btn-outline btn-sm" style="padding: 2px 6px; margin-left: 4px;" onclick="SuperAdminApp.copyToClipboard('${l.license_key}', 'License Key copied!')" title="Copy Key">
              📋
            </button>
          </td>
          <td>${hwidBadge}</td>
          <td>
            <div style="font-weight: 800; font-size: 13px; color: ${l.remainingDays > 15 ? '#34d399' : '#f87171'};">
              ${l.remainingDays} Days
            </div>
            <div style="font-size: 10px; color: var(--text-dim);">Expires ${l.expires_at ? l.expires_at.split('T')[0] : 'N/A'}</div>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 4px;">
              ${isBound ? `
                <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.resetHwid(${l.id}, '${l.pharmacy_name}')" title="Clear Machine Binding to allow PC Transfer">
                  🔄 Reset HWID
                </button>
              ` : ''}
              <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.promptRenew(${l.id}, '${l.pharmacy_name}')" title="Extend validity">
                ⏳ Renew
              </button>
              <button class="btn btn-sm ${l.status === 'REVOKED' ? 'btn-primary' : 'btn-danger'}" onclick="SuperAdminApp.toggleStatus(${l.id}, '${l.status}')" title="${l.status === 'REVOKED' ? 'Reinstate' : 'Revoke'}">
                ${l.status === 'REVOKED' ? 'Reinstate' : 'Revoke'}
              </button>
              <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.viewCertificateModal(${l.id})" title="View Certificate & WhatsApp Slip">
                📜
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==============================================================
  // VIEW 3: ISSUE LICENSE ENGINE
  // ==============================================================
  async renderGenerator(container) {
    container.innerHTML = `
      <div class="card" style="max-width: 860px; margin: 0 auto;">
        <div class="card-header">
          <div>
            <div class="card-title">🔑 Issue New License to Consumer Pharmacy</div>
            <p style="font-size: 11.5px; color: var(--text-dim); margin-top: 2px;">
              Generates a cryptographically signed Base32 key with embedded HMAC checksum for offline/online activation.
            </p>
          </div>
          <span class="badge info" style="font-size: 11px;">Authority Generator</span>
        </div>

        <form id="sa-issue-license-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Consumer Pharmacy / Client Name *</label>
              <input type="text" id="gen-pharmacy-name" class="form-control" placeholder="e.g. Apollo Chemist & Healthcare" required autofocus>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Person (Owner / Pharmacist) *</label>
              <input type="text" id="gen-contact-person" class="form-control" placeholder="e.g. Ramesh Gupta" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Mobile Phone (For WhatsApp Delivery) *</label>
              <input type="tel" id="gen-phone" class="form-control" placeholder="e.g. 9820011223" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (Optional)</label>
              <input type="email" id="gen-email" class="form-control" placeholder="e.g. info@apollochemist.com">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">License Plan Tier *</label>
              <select id="gen-plan-code" class="form-control">
                <option value="RETAIL_STARTER">🏢 Retail Starter POS (1 Year) — ₹4,999</option>
                <option value="PRO_ENTERPRISE" selected>🚀 Professional ERP (1 Year) — ₹9,999</option>
                <option value="TRIAL">🧪 14-Day Free Evaluation — ₹0</option>
                <option value="LIFETIME_ULTRA">👑 Lifetime Perpetual License — ₹29,999</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Duration (Days) *</label>
              <input type="number" id="gen-duration-days" class="form-control" value="365" min="1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Max Counters / Branches</label>
              <input type="number" id="gen-max-branches" class="form-control" value="1" min="1" max="25" required>
            </div>
          </div>

          <!-- Quick Duration Presets -->
          <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-sm duration-preset" data-days="14">14 Days Trial</button>
            <button type="button" class="btn btn-outline btn-sm duration-preset" data-days="30">30 Days</button>
            <button type="button" class="btn btn-outline btn-sm duration-preset" data-days="90">90 Days</button>
            <button type="button" class="btn btn-outline btn-sm duration-preset active" data-days="365">1 Year (365)</button>
            <button type="button" class="btn btn-outline btn-sm duration-preset" data-days="730">2 Years (730)</button>
            <button type="button" class="btn btn-outline btn-sm duration-preset" data-days="36500">Perpetual (100 Yrs)</button>
          </div>

          <div class="form-group">
            <label class="form-label">Order Notes / Invoice Reference</label>
            <input type="text" id="gen-notes" class="form-control" placeholder="e.g. Invoice #INV-2026-889 • Paid via UPI">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
            <button type="button" class="btn btn-outline" onclick="SuperAdminApp.navigate('consumers')">Cancel</button>
            <button type="submit" class="btn btn-gold btn-lg" id="btn-submit-generate">
              ✨ Issue Official License to Consumer
            </button>
          </div>
        </form>
      </div>
    `;

    // Presets
    document.querySelectorAll('.duration-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.duration-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('gen-duration-days').value = btn.dataset.days;
      });
    });

    // Form submit
    const form = document.getElementById('sa-issue-license-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pharmacyName = document.getElementById('gen-pharmacy-name').value.trim();
      const contactPerson = document.getElementById('gen-contact-person').value.trim();
      const phone = document.getElementById('gen-phone').value.trim();
      const email = document.getElementById('gen-email').value.trim();
      const planCode = document.getElementById('gen-plan-code').value;
      const durationDays = parseInt(document.getElementById('gen-duration-days').value, 10);
      const maxBranches = parseInt(document.getElementById('gen-max-branches').value, 10);
      const notes = document.getElementById('gen-notes').value.trim();

      const btn = document.getElementById('btn-submit-generate');
      btn.disabled = true;
      btn.textContent = '⏳ Generating Cryptographic Key...';

      try {
        const res = await this.apiRequest('/api/admin/licenses', 'POST', {
          pharmacyName,
          contactPerson,
          phone,
          email,
          planCode,
          durationDays,
          maxBranches,
          notes,
        });

        if (res.success && res.license) {
          this.toast('License created successfully!', 'success');
          this.showSuccessModal(res.license);
        }
      } catch (err) {
        this.toast(`Creation failed: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '✨ Issue Official License to Consumer';
      }
    });
  },

  showSuccessModal(lic) {
    const bodyHtml = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 36px;">🎉</div>
        <h3 style="font-size: 18px; font-weight: 800; color: #ffffff;">License Successfully Generated!</h3>
        <p style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">
          Ready to deliver to <strong>${lic.pharmacy_name}</strong>
        </p>
      </div>

      <div style="background: #0f172a; border: 2px dashed #0284c7; border-radius: var(--radius); padding: 16px; text-align: center; margin: 16px 0;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Consumer Software License Key</div>
        <div class="key-code" style="font-size: 20px; color: #38bdf8; margin: 8px 0; display: inline-block;">
          ${lic.license_key}
        </div>
        <div style="font-size: 11.5px; color: var(--text-dim);">Valid until: <strong>${lic.expires_at.split('T')[0]}</strong> • Plan: <strong>${lic.plan_code}</strong></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn btn-primary" onclick="SuperAdminApp.copyWhatsAppTemplate('${lic.license_key}', '${lic.pharmacy_name}', '${lic.expires_at.split('T')[0]}')">
          📱 Copy WhatsApp Delivery Template
        </button>
        <button class="btn btn-outline" onclick="SuperAdminApp.copyEmailTemplate('${lic.license_key}', '${lic.pharmacy_name}', '${lic.expires_at.split('T')[0]}')">
          📧 Copy Official Email Template
        </button>
        <button class="btn btn-outline" onclick="SuperAdminApp.viewCertificateModal(${lic.id})">
          📜 View Printable Certificate
        </button>
      </div>
    `;

    this.showModal('License Generated', bodyHtml, `
      <button class="btn btn-primary" onclick="SuperAdminApp.closeModal(); SuperAdminApp.navigate('consumers');">
        Go to Consumers Directory
      </button>
    `);
  },

  // ==============================================================
  // VIEW 4: HARDWARE & TELEMETRY LOGS
  // ==============================================================
  async renderHardware(container) {
    const res = await this.apiRequest('/api/admin/logs');
    const logs = res.logs || [];

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🛰️ Fleet Hardware & Telemetry Logs</div>
            <p style="font-size: 11.5px; color: var(--text-dim); margin-top: 2px;">
              Live stream of consumer activations, machine heartbeats, and hardware transfers.
            </p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="SuperAdminApp.renderHardware(document.getElementById('sa-content'))">
            🔄 Refresh Logs
          </button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Consumer Pharmacy</th>
                <th>Hardware ID (HWID)</th>
                <th>IP Address</th>
                <th>Event Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);">
                    ${new Date(l.created_at).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span class="badge ${l.event_type === 'ACTIVATION' ? 'success' : l.event_type === 'HWID_RESET' ? 'warning' : 'info'}">
                      ${l.event_type}
                    </span>
                  </td>
                  <td><strong style="color: #ffffff;">${l.pharmacy_name || 'Consumer'}</strong></td>
                  <td><code style="color: #38bdf8; font-size: 11px;">${l.hardware_id || 'N/A'}</code></td>
                  <td><span style="font-family: var(--font-mono); font-size: 11px;">${l.ip_address || '127.0.0.1'}</span></td>
                  <td style="font-size: 12px; color: var(--text-muted);">${l.details || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==============================================================
  // VIEW 5: SETTINGS & OWNER PROFILE
  // ==============================================================
  async renderSettings(container) {
    container.innerHTML = `
      <div class="card" style="max-width: 780px; margin: 0 auto;">
        <div class="card-header">
          <div class="card-title">⚙️ SuperAdmin Profile & System Configuration</div>
          <span class="badge warning">Master Authority</span>
        </div>

        <div style="display: flex; gap: 20px; align-items: center; background: #0f172a; padding: 18px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 20px;">
          <div class="owner-avatar" style="width: 56px; height: 56px; font-size: 22px;">👑</div>
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #ffffff;">Rajesh Patel</h3>
            <p style="font-size: 12px; color: var(--gold); font-weight: 700;">Company Founder & Software Owner</p>
            <p style="font-size: 11.5px; color: var(--text-dim); margin-top: 2px;">MediStock Technologies ERP Systems Ltd • Global License Authority</p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Licensing Backend Server Endpoint</label>
          <input type="text" class="form-control" value="${BACKEND_URL}" readonly style="font-family: var(--font-mono);">
        </div>

        <div class="form-group">
          <label class="form-label">Local Licensing Master Database</label>
          <input type="text" class="form-control" value="backend/data/license_master.db" readonly style="font-family: var(--font-mono);">
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-dim);">SuperAdmin Desktop Software v1.0.0</span>
          <button class="btn btn-danger btn-sm" onclick="SuperAdminApp.logout()">
            🚪 Sign Out of SuperAdmin
          </button>
        </div>
      </div>
    `;
  },

  // ==============================================================
  // ACTIONS: RESET HWID, RENEW, REVOKE, CERTIFICATE
  // ==============================================================
  async resetHwid(licenseId, pharmacyName) {
    const confirmed = confirm(`Are you sure you want to reset the machine hardware binding (HWID) for "${pharmacyName}"?\n\nThis will allow the pharmacy to activate the software on a new computer.`);
    if (!confirmed) return;

    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/reset-hardware`, 'PUT');
      if (res.success) {
        this.toast('Hardware binding cleared. Consumer can now activate on a new PC.', 'success');
        await this.renderConsumers(document.getElementById('sa-content'));
      }
    } catch (err) {
      this.toast(`Reset failed: ${err.message}`, 'error');
    }
  },

  async promptRenew(licenseId, pharmacyName) {
    const daysStr = prompt(`Renew / Extend license for "${pharmacyName}".\nEnter additional validity in days:`, '365');
    if (!daysStr) return;

    const addDays = parseInt(daysStr, 10);
    if (isNaN(addDays) || addDays <= 0) {
      alert('Please enter a valid positive number of days.');
      return;
    }

    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/renew`, 'PUT', { addDays });
      if (res.success) {
        this.toast(res.message || 'License extended successfully!', 'success');
        await this.renderConsumers(document.getElementById('sa-content'));
      }
    } catch (err) {
      this.toast(`Renewal failed: ${err.message}`, 'error');
    }
  },

  async toggleStatus(licenseId, currentStatus) {
    const newStatus = currentStatus === 'REVOKED' ? 'ACTIVE' : 'REVOKED';
    const actionLabel = newStatus === 'REVOKED' ? 'REVOKE and BLOCK' : 'REINSTATE';
    const confirmed = confirm(`Are you sure you want to ${actionLabel} this consumer license?`);
    if (!confirmed) return;

    try {
      const res = await this.apiRequest(`/api/admin/licenses/${licenseId}/status`, 'PUT', { status: newStatus });
      if (res.success) {
        this.toast(`Status updated to ${newStatus}`, 'success');
        await this.renderConsumers(document.getElementById('sa-content'));
      }
    } catch (err) {
      this.toast(`Action failed: ${err.message}`, 'error');
    }
  },

  viewCertificateModal(licenseId) {
    const lic = this.licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const bodyHtml = `
      <div class="license-certificate" id="printable-cert-card">
        <div class="cert-header">
          <img src="assets/logo.png" style="height: 50px; margin: 0 auto 8px; display: block;">
          <div class="cert-brand-logo">PHARMADESK TECHNOLOGIES</div>
          <div class="cert-title">Official Pharmacy Software License Certificate</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Issued by Central Licensing & Machine Verification Authority • ByteSphere</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; font-size: 13px;">
          <div>
            <strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Licensed Consumer:</strong>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${lic.pharmacy_name}</div>
            <div style="font-size: 12px; color: #475569;">Contact: ${lic.contact_person || 'Proprietor'} (${lic.phone || 'N/A'})</div>
          </div>
          <div style="text-align: right;">
            <strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Plan Tier:</strong>
            <div style="font-size: 15px; font-weight: 800; color: #0284c7;">${lic.plan_code}</div>
            <div style="font-size: 12px; color: #475569;">Max Branches: ${lic.max_branches} Counter(s)</div>
          </div>
        </div>

        <div class="cert-key-box">
          <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Customer Activation Key</div>
          <div class="cert-key">${lic.license_key}</div>
          <div style="font-size: 11.5px; color: #15803d; margin-top: 4px;">Cryptographically Verified Base32 Checksum</div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <div>Validity: <strong>Active until ${lic.expires_at ? lic.expires_at.split('T')[0] : 'N/A'}</strong></div>
          <div>Bound Machine: <code>${lic.hardware_id || 'Transferable'}</code></div>
        </div>

        <div class="cert-seal">
          <div>PHARMADESK</div>
          <div style="font-size: 7px;">BYTESPHERE</div>
          <div>OFFICIAL</div>
        </div>
      </div>
    `;

    this.showModal('Official License Certificate', bodyHtml, `
      <button class="btn btn-primary" onclick="SuperAdminApp.copyWhatsAppTemplate('${lic.license_key}', '${lic.pharmacy_name}', '${lic.expires_at ? lic.expires_at.split('T')[0] : ''}')">
        📱 Copy WhatsApp Slip
      </button>
      <button class="btn btn-outline" onclick="window.print()">
        🖨️ Print Certificate
      </button>
    `, 'lg');
  },

  copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text);
    this.toast(successMsg || 'Copied to clipboard!', 'success');
  },

  copyWhatsAppTemplate(key, pharmacy, expiry) {
    const text = `🏥 *PHARMADESK ERP & POS — SOFTWARE LICENSE ACTIVATION*\n\n` +
      `Dear *${pharmacy}*,\n` +
      `Your official pharmacy management software license has been issued by ByteSphere.\n\n` +
      `🔑 *License Key:* ${key}\n` +
      `📅 *Valid Until:* ${expiry}\n` +
      `🖥️ *Binding:* 1 Primary Counter PC (HWID Protected)\n\n` +
      `*How to activate:*\n` +
      `1. Open PharmaDesk on your billing computer\n` +
      `2. Paste your License Key\n` +
      `3. Click "Activate License Online"\n\n` +
      `For customer support & training, contact: +91 98200 98200\n` +
      `_PharmaDesk — Proud Production of ByteSphere_`;

    this.copyToClipboard(text, 'WhatsApp Delivery message copied!');
  },

  copyEmailTemplate(key, pharmacy, expiry) {
    const text = `Subject: PharmaDesk ERP — Official License Key for ${pharmacy}\n\n` +
      `Dear ${pharmacy} Team,\n\n` +
      `Thank you for choosing PharmaDesk ERP & POS. Your software license has been successfully generated.\n\n` +
      `License Key: ${key}\n` +
      `Expiration Date: ${expiry}\n` +
      `Server: http://localhost:5000\n\n` +
      `Please enter this key on your computer to activate your counter.\n\n` +
      `Best regards,\n` +
      `SuperAdmin | ByteSphere Licensing Authority • PharmaDesk`;

    this.copyToClipboard(text, 'Email Template copied!');
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SuperAdminApp.init();
});
