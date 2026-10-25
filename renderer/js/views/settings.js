// renderer/js/views/settings.js
// Settings & System Administration — Central hub for Profile, Users, Backups, Shortcuts & 15 Tabs

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.settings = {
  activeTab: 'profile',

  async render(container, preselectedTab) {
    if (preselectedTab) this.activeTab = preselectedTab;

    container.innerHTML = `
      <div class="card" style="margin-bottom: 12px; padding: 12px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">⚙️ System Settings & Store Preferences</h2>
            <p style="font-size: 11.5px; color: #64748b; margin: 2px 0 0;">Manage pharmacy profile, store staff, safe SQLite backups, keyboard shortcuts, and UI preferences.</p>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="settings-tab-buttons">
            <button class="btn btn-sm ${this.activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}" data-tab="profile">🏢 Company Profile</button>
            <button class="btn btn-sm ${this.activeTab === 'themes' ? 'btn-primary' : 'btn-outline'}" data-tab="themes">🎨 Themes & Prints</button>
            <button class="btn btn-sm ${this.activeTab === 'users' ? 'btn-primary' : 'btn-outline'}" data-tab="users">👥 Users & Security</button>
            <button class="btn btn-sm ${this.activeTab === 'backup' ? 'btn-primary' : 'btn-outline'}" data-tab="backup">💾 Backup & Restore</button>
            <button class="btn btn-sm ${this.activeTab === 'shortcuts' ? 'btn-primary' : 'btn-outline'}" data-tab="shortcuts">⌨️ Shortcuts & Help</button>
            <button class="btn btn-sm ${this.activeTab === 'tabs' ? 'btn-primary' : 'btn-outline'}" data-tab="tabs">📑 Active 15 Tabs</button>
            <button class="btn btn-sm ${this.activeTab === 'license' ? 'btn-primary' : 'btn-outline'}" data-tab="license">🔑 License & Subscription</button>
          </div>
        </div>
      </div>

      <div id="settings-subview-container"></div>
    `;

    // Bind sub-tab button clicks
    container.querySelectorAll('#settings-tab-buttons button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.dataset.tab;
        container.querySelectorAll('#settings-tab-buttons button').forEach((b) => {
          b.className = `btn btn-sm ${b.dataset.tab === this.activeTab ? 'btn-primary' : 'btn-outline'}`;
        });
        this.renderSubTab(document.getElementById('settings-subview-container'));
      });
    });

    this.renderSubTab(document.getElementById('settings-subview-container'));
  },

  async renderSubTab(subContainer) {
    if (this.activeTab === 'profile') {
      await this.renderProfileTab(subContainer);
    } else if (this.activeTab === 'themes') {
      this.renderThemesAndPrintsTab(subContainer);
    } else if (this.activeTab === 'users') {
      if (window.MediStockViews.users) {
        window.MediStockViews.users.render(subContainer);
      }
    } else if (this.activeTab === 'backup') {
      if (window.MediStockViews.backup) {
        window.MediStockViews.backup.render(subContainer);
      }
    } else if (this.activeTab === 'shortcuts') {
      if (window.MediStockViews.about) {
        window.MediStockViews.about.render(subContainer);
      }
    } else if (this.activeTab === 'tabs') {
      this.renderTabsGuide(subContainer);
    } else if (this.activeTab === 'license') {
      await this.renderLicenseTab(subContainer);
    }
  },

  async renderProfileTab(subContainer) {
    const company = await window.api.settings.getCompany();
    const settings = await window.api.settings.getAppSettings();

    subContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏢 Pharmacy Profile, Drug Licenses & Tax Rules</div>
          <button class="btn btn-primary btn-sm" id="btn-save-company-profile">Save Company Changes</button>
        </div>

        <form id="company-profile-form">
          <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin-bottom: 12px;">Legal Pharmacy Entity & Licensing</h4>
          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Registered Legal Name:</label>
              <input type="text" id="set-name" class="form-control" value="${company.name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Trade / Board Name (Appears on Bills):</label>
              <input type="text" id="set-trade" class="form-control" value="${company.trade_name || ''}">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Drug License No 1 (20B):</label>
              <input type="text" id="set-dl1" class="form-control" value="${company.drug_license_no_1 || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Drug License No 2 (21B):</label>
              <input type="text" id="set-dl2" class="form-control" value="${company.drug_license_no_2 || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN:</label>
              <input type="text" id="set-gstin" class="form-control" value="${company.gstin || ''}">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Pharmacy Address Line:</label>
              <input type="text" id="set-addr" class="form-control" value="${company.address_line1 || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">City:</label>
              <input type="text" id="set-city" class="form-control" value="${company.city || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Pincode:</label>
              <input type="text" id="set-pin" class="form-control" value="${company.pincode || ''}">
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Contact Phone Number:</label>
              <input type="text" id="set-phone" class="form-control" value="${company.phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">UPI ID for Bill Payments:</label>
              <input type="text" id="set-upi" class="form-control" value="${company.upi_id || ''}">
            </div>
          </div>

          <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin: 18px 0 12px;">Operational ERP Rules & Thresholds</h4>
          <div class="table-container">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Configuration Key</th>
                  <th>Description</th>
                  <th>Value</th>
                  <th class="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                ${settings
                  .map(
                    (s) => `
                  <tr>
                    <td class="font-mono"><strong>${s.setting_key}</strong></td>
                    <td>${s.description}</td>
                    <td><input type="text" id="setting-${s.setting_key}" class="form-control" value="${s.setting_value}" style="width: 200px;"></td>
                    <td class="text-center">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MediStockViews.settings.saveSetting('${s.setting_key}')">Save</button>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    `;

    document.getElementById('btn-save-company-profile').addEventListener('click', async () => {
      const payload = {
        id: company.id,
        name: document.getElementById('set-name').value.trim(),
        trade_name: document.getElementById('set-trade').value.trim(),
        drug_license_no_1: document.getElementById('set-dl1').value.trim(),
        drug_license_no_2: document.getElementById('set-dl2').value.trim(),
        gstin: document.getElementById('set-gstin').value.trim(),
        address_line1: document.getElementById('set-addr').value.trim(),
        city: document.getElementById('set-city').value.trim(),
        pincode: document.getElementById('set-pin').value.trim(),
        phone: document.getElementById('set-phone').value.trim(),
        upi_id: document.getElementById('set-upi').value.trim(),
        state: company.state,
        fssai_no: company.fssai_no,
        bank_name: company.bank_name,
        bank_account_no: company.bank_account_no,
        bank_ifsc: company.bank_ifsc,
        email: company.email,
      };

      try {
        await window.api.settings.updateCompany(payload);
        MediStock.toast('Company profile updated successfully!', 'success');
        const compDisplay = document.getElementById('company-display-name');
        if (compDisplay) compDisplay.textContent = payload.trade_name || payload.name;
      } catch (err) {
        MediStock.toast(`Update error: ${err.message}`, 'error');
      }
    });
  },

  renderTabsGuide(subContainer) {
    const tabs = [
      { num: 1, id: 'dashboard', name: 'Dashboard', section: 'Core Billing', desc: 'KPI cards, today\'s sales, low stock alerts, near-expiry count, live charts' },
      { num: 2, id: 'billing', name: 'Retail Billing (POS)', section: 'Core Billing', desc: 'High-speed keyboard billing (F1: New Bill, F2: Search Medicine), direct customer name/mobile header, loose tablets & USP' },
      { num: 3, id: 'wholesale', name: 'Wholesale Billing', section: 'Core Billing', desc: 'Bulk trade billing, clinic/hospital challans, wholesale price groups' },
      { num: 4, id: 'sales', name: 'Sales Invoices', section: 'Core Billing', desc: 'Invoice history, reprint A4/80mm bills, initiate verified sales returns' },
      { num: 5, id: 'purchase', name: 'Purchase Entry', section: 'Core Billing', desc: 'Inward supplier bills, new batch creation, free strip quantity calculations' },
      { num: 6, id: 'inventory', name: 'Batch Inventory & Stock', section: 'Inventory & Pharmacy', desc: 'Batch-wise stock levels, stock movement ledger, audited physical stock adjustments' },
      { num: 7, id: 'expiry', name: 'Expiry & Returns', section: 'Inventory & Pharmacy', desc: 'Near-expiry alerts (30/60/90 days), expired stock quarantine, supplier debit notes' },
      { num: 8, id: 'compliance', name: 'Schedule H/H1 Compliance', section: 'Inventory & Pharmacy', desc: 'Statutory Schedule H & H1 registers, doctor Rx tracking, batch recall audit' },
      { num: 9, id: 'masters', name: 'Medicine Master Catalog', section: 'Inventory & Pharmacy', desc: 'Product catalog, brand names, salt compositions, HSN codes, rack/shelf locations' },
      { num: 10, id: 'customers', name: 'Customers & Patients', section: 'Stakeholders & Books', desc: 'Customer directory, patient contact info, credit balances, purchase histories' },
      { num: 11, id: 'suppliers', name: 'Suppliers Directory', section: 'Stakeholders & Books', desc: 'Pharmaceutical distributor records, DL/GSTIN numbers, outstanding payables' },
      { num: 12, id: 'accounts', name: 'Double-Entry Accounts', section: 'Stakeholders & Books', desc: 'Chart of Accounts, Journal Vouchers, strictly balanced Trial Balance, P&L' },
      { num: 13, id: 'gst', name: 'GST & Tax Reports', section: 'Stakeholders & Books', desc: 'GSTR-1 outward supplies (B2B/B2C), GSTR-3B tax offset, HSN summary' },
      { num: 14, id: 'reports', name: 'Analytics & Reports', section: 'Stakeholders & Books', desc: 'Fast/slow moving medicines, auto-reorder recommendations, gross profit' },
      { num: 15, id: 'settings', name: 'Settings & Preferences', section: 'System', desc: 'All-in-one hub: Pharmacy Profile, Store Staff, SQLite Hot Backups, and Shortcuts' }
    ];

    subContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📑 Active 15 Tabs Architecture</div>
          <span class="badge success" style="font-size: 12px; padding: 4px 10px;">Configured to Exactly 15 Navigation Tabs</span>
        </div>
        <p style="font-size: 12.5px; color: #475569; margin-bottom: 14px;">
          The PharmaDesk ERP sidebar navigation has been streamlined to <strong>exactly 15 focused tabs</strong>, grouping store configuration utilities (Profile, Staff, Backups, and Shortcuts) cleanly under Tab 15.
        </p>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th style="width: 60px;">Tab #</th>
                <th style="width: 140px;">Section</th>
                <th style="width: 180px;">Tab Name</th>
                <th>Description & Functionality</th>
                <th style="width: 90px;" class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${tabs.map(t => `
                <tr>
                  <td class="font-mono"><strong>#${t.num}</strong></td>
                  <td><span class="badge neutral" style="font-size: 10px;">${t.section}</span></td>
                  <td><strong>${t.name}</strong></td>
                  <td style="font-size: 11.5px; color: #334155;">${t.desc}</td>
                  <td class="text-center">
                    <button class="btn btn-outline btn-xs" onclick="MediStock.navigate('${t.id}')">Open &rarr;</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderThemesAndPrintsTab(subContainer) {
    const currentTheme = localStorage.getItem('medistock_theme') || 'classic';
    const currentFormat = localStorage.getItem('medistock_bill_format') || '80mm';

    const themes = [
      { id: 'classic', name: 'Classic Slate', desc: 'Default sky blue accents with slate gray navigation', sidebar: '#0f172a', primary: '#0284c7', icon: '🔵' },
      { id: 'navy', name: 'Navy Blue Theme', desc: 'Deep executive navy sidebar with royal blue accents', sidebar: '#0a192f', primary: '#1d4ed8', icon: '🔷' },
      { id: 'red', name: 'Medical Crimson Red', desc: 'Clinical emergency red with ruby wine sidebar', sidebar: '#2b0707', primary: '#dc2626', icon: '🔴' },
      { id: 'emerald', name: 'Emerald Pharmacy Green', desc: 'Natural herbal healthcare green with forest pine sidebar', sidebar: '#04271d', primary: '#059669', icon: '🟢' },
      { id: 'dark', name: 'Modern Dark Mode', desc: 'Midnight OLED slate theme with high-contrast text', sidebar: '#070a12', primary: '#38bdf8', icon: '🌙' },
    ];

    const formats = [
      { id: '80mm', name: '80mm Thermal Receipt (POS Roll)', icon: '🧾', desc: 'Standard 3-inch roll format for thermal receipt printers (Epson, TVS, Posiflex). Fast, clear, paper-efficient.', width: '76mm' },
      { id: 'a4', name: 'A4 Full GST Tax Invoice', icon: '📄', desc: 'Formal tax invoice with complete 14-column breakdown, HSN Tax summary, bank details, and drug licenses.', width: 'Full A4 Sheet' },
      { id: 'a5', name: 'A5 Chemist Half-Page Bill', icon: '📑', desc: 'The ubiquitous Indian chemist bill book format (148×210mm) for dot-matrix and laser half-page stationery.', width: '148 × 210 mm' },
      { id: '58mm', name: '58mm Mini Thermal Slip', icon: '🧾', desc: 'Ultra-compact 2-inch format for portable Bluetooth and compact counter thermal printers.', width: '52mm' },
    ];

    subContainer.innerHTML = `
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">🎨 Visual UI Themes (Red, Navy Blue, Emerald, Dark, Classic)</div>
          <span class="badge info">Active: ${currentTheme.toUpperCase()}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">Select your preferred color scheme. The entire ERP interface (sidebar, buttons, highlights, badges, and headers) adapts instantly.</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;" id="theme-cards-container">
          ${themes.map(t => `
            <div class="card" style="margin: 0; padding: 14px; border: 2px solid ${currentTheme === t.id ? t.primary : 'var(--border)'}; border-radius: var(--radius); cursor: pointer; transition: all 0.2s;" data-theme-id="${t.id}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 13.5px; font-weight: 700;">${t.icon} ${t.name}</span>
                ${currentTheme === t.id ? `<span class="badge success" style="font-size: 10px;">Active</span>` : ''}
              </div>
              <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; min-height: 30px;">${t.desc}</p>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 28px; height: 28px; border-radius: 4px; background: ${t.sidebar}; border: 1px solid #ccc;" title="Sidebar Color"></div>
                <div style="width: 28px; height: 28px; border-radius: 4px; background: ${t.primary}; border: 1px solid #ccc;" title="Accent Primary Color"></div>
                <div style="font-size: 10.5px; font-family: var(--font-mono); color: var(--text-muted);">${t.primary}</div>
              </div>
              <button class="btn btn-sm ${currentTheme === t.id ? 'btn-primary' : 'btn-outline'}" style="width: 100%;">
                ${currentTheme === t.id ? '✓ Activated' : 'Apply Theme'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🖨️ Bill Print Formats & Default Layout</div>
          <span class="badge success">Default: ${currentFormat.toUpperCase()}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">Choose the default print format for sales invoices. You can always switch formats dynamically on the preview screen before printing.</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 16px;" id="format-cards-container">
          ${formats.map(f => `
            <div class="card" style="margin: 0; padding: 14px; border: 2px solid ${currentFormat === f.id ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius); cursor: pointer;" data-format-id="${f.id}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 700;">${f.icon} ${f.name}</span>
                ${currentFormat === f.id ? `<span class="badge success" style="font-size: 10px;">Default</span>` : ''}
              </div>
              <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; min-height: 38px;">${f.desc}</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge neutral" style="font-size: 10px;">Width: ${f.width}</span>
                <button class="btn btn-sm ${currentFormat === f.id ? 'btn-primary' : 'btn-outline'}">
                  ${currentFormat === f.id ? '✓ Default' : 'Set as Default'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius);">
          <div>
            <strong>Quick Preview:</strong>
            <span style="font-size: 11.5px; color: var(--text-muted); margin-left: 6px;">Test the print templates using your most recent bill.</span>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-test-print-preview">👁️ Open Sample Print Preview</button>
        </div>
      </div>
    `;

    // Theme card clicks
    subContainer.querySelectorAll('#theme-cards-container [data-theme-id]').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.themeId;
        MediStock.setTheme(themeId);
        MediStock.toast(`Theme updated to ${themeId.toUpperCase()}`, 'success');
        this.renderThemesAndPrintsTab(subContainer);
      });
    });

    // Format card clicks
    subContainer.querySelectorAll('#format-cards-container [data-format-id]').forEach(card => {
      card.addEventListener('click', () => {
        const formatId = card.dataset.formatId;
        localStorage.setItem('medistock_bill_format', formatId);
        MediStock.toast(`Default bill format updated to: ${formatId.toUpperCase()}`, 'success');
        this.renderThemesAndPrintsTab(subContainer);
      });
    });

    // Test print preview button
    const btnTest = subContainer.querySelector('#btn-test-print-preview');
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        try {
          const invoices = await window.api.sales.listInvoices({ limit: 1 });
          if (invoices && invoices.length > 0) {
            MediStock.viewInvoiceDetails(invoices[0].id);
          } else {
            MediStock.toast('No sales invoices found yet. Create a bill first!', 'warning');
          }
        } catch (e) {
          MediStock.toast(`Cannot preview: ${e.message}`, 'error');
        }
      });
    }
  },

  async renderLicenseTab(subContainer) {
    let licStatus = { isLicensed: false };
    let hwid = 'Loading...';
    try {
      licStatus = await window.api.license.getStatus();
      hwid = await window.api.license.getHardwareId();
    } catch (e) {
      console.warn('Could not query license status:', e);
    }

    const isLicensed = licStatus && licStatus.isLicensed;
    const lic = (licStatus && licStatus.license) || null;

    subContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔑 Software License & Subscription Management</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-sync-license-server">🔄 Sync with Server</button>
            <button class="btn btn-danger btn-sm" id="btn-deactivate-license">🔓 Deactivate / Change Key</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 10px;">
          <div>
            <!-- Current License Status Banner -->
            <div style="background: ${isLicensed ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isLicensed ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="badge ${isLicensed ? 'success' : 'danger'}" style="font-size: 12px; padding: 4px 10px;">
                    ${isLicensed ? '✅ LICENSE ACTIVE & VALID' : '⚠️ UNLICENSED / EXPIRED'}
                  </span>
                  <h3 style="font-size: 18px; font-weight: 800; margin: 8px 0 2px; color: ${isLicensed ? '#15803d' : '#b91c1c'};">
                    ${lic ? lic.pharmacyName : (licStatus.pharmacyName || 'No Registered Pharmacy')}
                  </h3>
                  <div style="font-size: 12px; color: #64748b;">
                    Plan: <strong>${lic ? lic.planCode : 'None'}</strong> • Multi-Branch Limit: <strong>${lic ? lic.maxBranches : 1} Branch</strong>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 28px; font-weight: 900; color: ${isLicensed ? '#16a34a' : '#dc2626'};">
                    ${lic ? lic.remainingDays : 0}
                  </div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">
                    Days Remaining
                  </div>
                </div>
              </div>
            </div>

            <!-- License Details Grid -->
            <div class="table-container">
              <table class="data-table">
                <tbody>
                  <tr>
                    <th style="width: 200px;">License Key</th>
                    <td><code style="font-weight: 700; color: #0284c7; font-size: 13px;">${lic ? lic.key : (licStatus.licenseKey || 'N/A')}</code></td>
                  </tr>
                  <tr>
                    <th>Issued Date</th>
                    <td>${lic && lic.issuedAt ? lic.issuedAt.split('T')[0] : 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>Expiration Date</th>
                    <td><strong>${lic && lic.expiresAt ? lic.expiresAt.split('T')[0] : (licStatus.expiresAt ? licStatus.expiresAt.split('T')[0] : 'N/A')}</strong></td>
                  </tr>
                  <tr>
                    <th>Last Server Sync</th>
                    <td>${lic && lic.lastVerifiedAt ? new Date(lic.lastVerifiedAt).toLocaleString('en-IN') : 'Initial Offline Activation'}</td>
                  </tr>
                  <tr>
                    <th>Licensing Server</th>
                    <td><code style="font-size: 11px;">${lic ? lic.serverUrl : 'https://medistock-erp-01tu.onrender.com'}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <!-- Machine Fingerprint Card -->
            <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0; height: 100%;">
              <h4 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">🖥️ Machine Hardware ID (HWID)</h4>
              <p style="font-size: 11.5px; color: #64748b; line-height: 1.4;">
                This installation is cryptographically bound to this computer's CPU and network interface:
              </p>
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin: 10px 0; text-align: center;">
                <code style="font-weight: 800; font-size: 13.5px; color: #0f172a; display: block;" id="settings-hwid-display">${hwid}</code>
                <button class="btn btn-outline btn-sm" id="btn-settings-copy-hwid" style="margin-top: 8px; width: 100%;">
                  📋 Copy Hardware ID
                </button>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 10px; line-height: 1.4;">
                💡 To transfer this license to another computer or renew, contact your ByteSphere licensing representative with this Hardware ID.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Copy HWID
    const btnCopyHwid = subContainer.querySelector('#btn-settings-copy-hwid');
    if (btnCopyHwid) {
      btnCopyHwid.addEventListener('click', () => {
        navigator.clipboard.writeText(hwid);
        MediStock.toast('Hardware ID copied to clipboard!', 'success');
      });
    }

    // Server Sync
    const btnSync = subContainer.querySelector('#btn-sync-license-server');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        btnSync.disabled = true;
        btnSync.textContent = '⏳ Syncing...';
        try {
          const res = await window.api.license.sync();
          if (res.success) {
            MediStock.toast('License synchronized with server successfully!', 'success');
            await this.renderLicenseTab(subContainer);
          } else {
            MediStock.toast(`Sync failed: ${res.message}`, 'warning');
            btnSync.disabled = false;
            btnSync.textContent = '🔄 Sync with Server';
          }
        } catch (err) {
          MediStock.toast(`Sync error: ${err.message}`, 'error');
          btnSync.disabled = false;
          btnSync.textContent = '🔄 Sync with Server';
        }
      });
    }

    // Deactivate / Change Key
    const btnDeactivate = subContainer.querySelector('#btn-deactivate-license');
    if (btnDeactivate) {
      btnDeactivate.addEventListener('click', async () => {
        const confirmed = window.confirm('Are you sure you want to deactivate the license on this machine? You will be prompted to enter a new license key to continue using MediStock.');
        if (!confirmed) return;

        try {
          await window.api.license.deactivate();
          MediStock.toast('License deactivated. Please enter a valid license key.', 'info');
          MediStock.showLicenseScreen();
        } catch (err) {
          MediStock.toast(`Deactivation failed: ${err.message}`, 'error');
        }
      });
    }
  },

  async saveSetting(key) {
    const input = document.getElementById(`setting-${key}`);
    if (!input) return;
    const val = input.value.trim();

    try {
      await window.api.settings.updateAppSetting(key, val);
      MediStock.toast(`Setting "${key}" updated!`, 'success');
    } catch (e) {
      MediStock.toast(`Error updating setting: ${e.message}`, 'error');
    }
  },
};
