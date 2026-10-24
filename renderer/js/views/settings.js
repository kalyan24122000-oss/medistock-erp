// renderer/js/views/settings.js
// Pharmacy Profile, GSTIN, Drug License Numbers, and App Configuration Settings

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.settings = {
  async render(container) {
    const company = await window.api.settings.getCompany();
    const settings = await window.api.settings.getAppSettings();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚙️ Pharmacy Profile & System Configuration</div>
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
