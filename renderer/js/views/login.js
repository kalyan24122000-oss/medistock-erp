// renderer/js/views/login.js
// Pharmacy Operator Authentication & Role Login View

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.login = {
  async render(container) {
    let companyName = 'Apex Pharmacy';
    let dlBadge = 'DL: MH-WZ-123456';
    let licenseBadge = 'Licensed';

    try {
      const comp = await window.api.settings.getCompany();
      if (comp) {
        companyName = comp.trade_name || comp.name || 'Apex Pharmacy';
        dlBadge = `DL: ${comp.drug_license_no_1 || 'MH-WZ-123456'} | GSTIN: ${comp.gstin || ''}`;
      }

      const licStatus = await window.api.license.getStatus();
      if (licStatus && licStatus.license) {
        licenseBadge = `✨ ${licStatus.license.planCode} (${licStatus.license.remainingDays} days remaining)`;
      }
    } catch (e) {
      console.warn('Login metadata load warning:', e.message);
    }

    const rememberedUser = localStorage.getItem('medistock_remembered_username') || 'admin';

    container.innerHTML = `
      <div class="auth-fullscreen-container">
        <div class="auth-card-panel login-card-panel">
          <div class="auth-header">
            <div class="auth-brand-logo">
              <div class="auth-logo-badge">M</div>
            </div>
            <h2 class="auth-title">${companyName}</h2>
            <p class="auth-subtitle">${dlBadge}</p>
            <div style="margin-top: 6px;">
              <span class="badge success" style="font-size: 10.5px;">${licenseBadge}</span>
            </div>
          </div>

          <!-- Login Form -->
          <form id="pharmacy-login-form" style="margin-top: 18px;">
            <div class="form-group">
              <label class="form-label">Operator Username *</label>
              <input type="text" id="login-username-input" class="form-control"
                     value="${rememberedUser}" placeholder="Enter username (e.g. admin, cashier)" required autofocus>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Password *</label>
                <button type="button" id="btn-toggle-password" style="background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer;">
                  Show Password
                </button>
              </div>
              <input type="password" id="login-password-input" class="form-control"
                     value="admin123" placeholder="Enter password" required>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 11.5px; color: var(--text-muted);">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="chk-remember-user" checked> Remember Username
              </label>
              <span style="font-size: 11px; color: #64748b;">Role-based Security</span>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" id="btn-login-submit" style="width: 100%;">
              🔐 Sign In to Counter (Enter)
            </button>
          </form>

          <!-- Quick Operator Switcher Pills -->
          <div class="auth-presets-box" style="margin-top: 18px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
              Quick Shift / Demo Operator Login:
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
              <button type="button" class="btn btn-outline btn-sm op-preset" data-user="admin" data-pass="admin123">
                👑 Admin
              </button>
              <button type="button" class="btn btn-outline btn-sm op-preset" data-user="pharmacist" data-pass="pharma123">
                💊 Pharmacist
              </button>
              <button type="button" class="btn btn-outline btn-sm op-preset" data-user="cashier" data-pass="cashier123">
                🧾 Cashier
              </button>
            </div>
            <div style="margin-top: 12px; font-size: 11px; color: #64748b; text-align: center;">
              MediStock ERP v1.0.0 • Offline-First Pharmacy Architecture
            </div>
          </div>
        </div>
      </div>
    `;

    // Eye toggle
    let isShowingPass = false;
    const btnToggle = document.getElementById('btn-toggle-password');
    const passInput = document.getElementById('login-password-input');
    btnToggle.addEventListener('click', () => {
      isShowingPass = !isShowingPass;
      passInput.type = isShowingPass ? 'text' : 'password';
      btnToggle.textContent = isShowingPass ? 'Hide Password' : 'Show Password';
    });

    // Preset operator switcher
    document.querySelectorAll('.op-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('login-username-input').value = btn.dataset.user;
        document.getElementById('login-password-input').value = btn.dataset.pass;
        document.getElementById('btn-login-submit').focus();
      });
    });

    // Handle form submit
    const form = document.getElementById('pharmacy-login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username-input').value.trim();
      const password = document.getElementById('login-password-input').value;
      const remember = document.getElementById('chk-remember-user').checked;
      const btn = document.getElementById('btn-login-submit');

      btn.disabled = true;
      btn.textContent = '⏳ Authenticating...';

      try {
        const res = await window.api.auth.login(username, password);
        if (res.success) {
          if (remember) {
            localStorage.setItem('medistock_remembered_username', username);
          } else {
            localStorage.removeItem('medistock_remembered_username');
          }

          MediStock.toast(`Welcome, ${res.user.fullName}!`, 'success');
          MediStock.onLoginSuccess(res.user);
        } else {
          MediStock.toast(res.message || 'Authentication failed', 'error');
          btn.disabled = false;
          btn.textContent = '🔐 Sign In to Counter (Enter)';
        }
      } catch (err) {
        MediStock.toast(`Login error: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '🔐 Sign In to Counter (Enter)';
      }
    });
  },
};
