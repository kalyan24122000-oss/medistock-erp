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
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">⚙️ System Settings & Administration</h2>
            <p style="font-size: 11.5px; color: #64748b; margin: 2px 0 0;">Manage pharmacy profile, users, safe SQLite backups, keyboard shortcuts, and 15 navigation tabs.</p>
          </div>
          <div style="display: flex; gap: 6px;" id="settings-tab-buttons">
            <button class="btn btn-sm ${this.activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}" data-tab="profile">🏢 Company Profile</button>
            <button class="btn btn-sm ${this.activeTab === 'users' ? 'btn-primary' : 'btn-outline'}" data-tab="users">👥 Users & Security</button>
            <button class="btn btn-sm ${this.activeTab === 'backup' ? 'btn-primary' : 'btn-outline'}" data-tab="backup">💾 Backup & Restore</button>
            <button class="btn btn-sm ${this.activeTab === 'shortcuts' ? 'btn-primary' : 'btn-outline'}" data-tab="shortcuts">⌨️ Shortcuts & Help</button>
            <button class="btn btn-sm ${this.activeTab === 'tabs' ? 'btn-primary' : 'btn-outline'}" data-tab="tabs">📑 Active 15 Tabs</button>
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
      { num: 15, id: 'settings', name: 'Settings & Administration', section: 'Administration', desc: 'All-in-one hub: Pharmacy Profile, Users, SQLite Hot Backups, and Shortcuts' }
    ];

    subContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📑 Active 15 Tabs Architecture</div>
          <span class="badge success" style="font-size: 12px; padding: 4px 10px;">Configured to Exactly 15 Navigation Tabs</span>
        </div>
        <p style="font-size: 12.5px; color: #475569; margin-bottom: 14px;">
          The MediStock ERP sidebar navigation has been streamlined to <strong>exactly 15 focused tabs</strong>, grouping administrative utilities (Profile, Users, Backups, and Shortcuts) cleanly under Tab 15.
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
