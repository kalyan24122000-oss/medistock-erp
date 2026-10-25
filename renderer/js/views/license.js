// renderer/js/views/license.js
// MediStock ERP License Activation & Machine Registration View

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.license = {
  async render(container) {
    let hwid = 'Loading...';
    try {
      hwid = await window.api.license.getHardwareId();
    } catch (e) {
      hwid = 'HWID-GEN-2026-APEX';
    }

    container.innerHTML = `
      <div class="auth-fullscreen-container">
        <div class="auth-card-panel license-card-panel">
          <div class="auth-header">
            <div class="auth-brand-logo">
              <img src="assets/logo.png" class="auth-header-logo" alt="PharmaDesk">
            </div>
            <h2 class="auth-title">PharmaDesk — Software Activation</h2>
            <p class="auth-subtitle">Pharmacy Management ERP & POS • Machine Hardware Binding</p>
          </div>

          <!-- Machine Fingerprint Card -->
          <div class="hwid-info-box">
            <div class="hwid-label">This Computer's Unique Hardware ID (HWID):</div>
            <div class="hwid-val-row">
              <span class="hwid-code" id="display-hwid">${hwid}</span>
              <button type="button" class="btn btn-outline btn-sm" id="btn-copy-hwid" title="Copy Hardware ID to Clipboard">
                📋 Copy HWID
              </button>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Your license key will be securely bound to this computer.
            </div>
          </div>

          <!-- License Activation Form -->
          <form id="license-activation-form" style="margin-top: 16px;">
            <div class="form-group">
              <label class="form-label">Software License Key *</label>
              <input type="text" id="input-license-key" class="form-control font-mono"
                     placeholder="Enter your license key (e.g. MEDI-XXXX-YYYY-ZZZZ-CCCC)"
                     style="font-size: 13.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;"
                     required autofocus>
            </div>

            <div class="form-group">
              <label class="form-label">Licensing Backend Server URL</label>
              <input type="text" id="input-server-url" class="form-control font-mono"
                     value="http://localhost:5000"
                     style="font-size: 12px;">
            </div>

            <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-activate" style="width: 100%; margin-top: 6px;">
              🔑 Activate License Online
            </button>
          </form>

          <div class="auth-card-footer">
            Proud Production of ByteSphere
          </div>
        </div>
      </div>
    `;

    // Copy HWID button
    document.getElementById('btn-copy-hwid').addEventListener('click', () => {
      navigator.clipboard.writeText(hwid);
      MediStock.toast('Hardware ID copied to clipboard!', 'success');
    });

    // Handle form submit
    const form = document.getElementById('license-activation-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('input-license-key').value.trim();
      const serverUrl = document.getElementById('input-server-url').value.trim() || 'http://localhost:5000';
      const btn = document.getElementById('btn-submit-activate');

      btn.disabled = true;
      btn.textContent = '⏳ Verifying with License Server...';

      try {
        const res = await window.api.license.activate(key, serverUrl);
        if (res.success) {
          MediStock.toast(res.message || 'License activated successfully!', 'success');
          // Proceed to login screen!
          setTimeout(() => {
            MediStock.showLoginScreen();
          }, 800);
        } else {
          MediStock.toast(`Activation Failed: ${res.message}`, 'error');
          btn.disabled = false;
          btn.textContent = '🔑 Activate License Online';
        }
      } catch (err) {
        MediStock.toast(`Activation Error: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '🔑 Activate License Online';
      }
    });
  },
};
