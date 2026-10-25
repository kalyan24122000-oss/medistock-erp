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

    const rememberedUser = localStorage.getItem('medistock_remembered_username') || '';

    container.innerHTML = `
      <div class="auth-fullscreen-container">
        <div class="auth-card-panel login-card-panel">
          <div class="auth-header">
            <div class="auth-brand-logo">
              <img src="assets/logo.png" class="auth-header-logo" alt="PharmaDesk">
            </div>
            <h2 class="auth-title">${companyName}</h2>
            <p class="auth-subtitle">${dlBadge}</p>
            <div style="margin-top: 6px;">
              <span class="badge success" style="font-size: 10.5px;">${licenseBadge}</span>
            </div>
          </div>

          <!-- Operator Sign-In Form -->
          <form id="pharmacy-login-form" style="margin-top: 18px;">
            <div class="form-group">
              <label class="form-label">Operator Username *</label>
              <input type="text" id="login-username-input" class="form-control"
                     value="${rememberedUser}" placeholder="Enter operator username" required autofocus>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Password *</label>
                <button type="button" id="btn-toggle-password" style="background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer;">
                  Show Password
                </button>
              </div>
              <input type="password" id="login-password-input" class="form-control"
                     value="" placeholder="Enter password" required>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 11.5px; color: var(--text-muted);">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="chk-remember-user" ${rememberedUser ? 'checked' : ''}> Remember Username
              </label>
              <span style="font-size: 11px; color: #64748b;">Role-based Security</span>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" id="btn-login-submit" style="width: 100%;">
              🔐 Sign In to Counter (Enter)
            </button>
          </form>

          <div class="auth-card-footer">
            Proud Production of ByteSphere
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

    // Handle form submit
    const form = document.getElementById('pharmacy-login-form');
    const submitBtn = document.getElementById('btn-login-submit');

    const handleLogin = async (e) => {
      if (e) e.preventDefault();

      const usernameInput = document.getElementById('login-username-input');
      const passwordInput = document.getElementById('login-password-input');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const remember = document.getElementById('chk-remember-user') ? document.getElementById('chk-remember-user').checked : false;
      const btn = document.getElementById('btn-login-submit');

      if (!username) {
        MediStock.toast('Please enter your operator username', 'warning');
        if (usernameInput) usernameInput.focus();
        return;
      }

      if (!password) {
        MediStock.toast('Please enter your password', 'warning');
        if (passwordInput) passwordInput.focus();
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Authenticating...';
      }

      try {
        const res = await window.api.auth.login(username, password);
        if (res && res.success) {
          if (remember) {
            localStorage.setItem('medistock_remembered_username', username);
          } else {
            localStorage.removeItem('medistock_remembered_username');
          }

          MediStock.toast(`Welcome, ${res.user.fullName}!`, 'success');
          MediStock.onLoginSuccess(res.user);
        } else {
          MediStock.toast(res && res.message ? res.message : 'Invalid credentials. Please verify username and password.', 'error');
          if (btn) {
            btn.disabled = false;
            btn.textContent = '🔐 Sign In to Counter (Enter)';
          }
        }
      } catch (err) {
        MediStock.toast(`Login error: ${err.message}`, 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔐 Sign In to Counter (Enter)';
        }
      }
    };

    if (form) {
      form.addEventListener('submit', handleLogin);
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        // Only trigger manually if not handled by form submit
        if (form && !form.checkValidity()) {
          handleLogin(e);
        }
      });
    }
  },
};
