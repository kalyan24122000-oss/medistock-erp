// renderer/js/views/suppliers.js
// Pharmaceutical Distributors & Supplier Directory

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.suppliers = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏭 Pharmaceutical Suppliers & Wholesalers</div>
          <button class="btn btn-primary btn-sm" id="btn-add-supplier">+ Add New Supplier</button>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
          <input type="text" id="sup-search" class="form-control" style="width: 280px;" placeholder="Search Supplier Name, Phone, GSTIN...">
          <button class="btn btn-secondary btn-sm" id="btn-search-sup">Search</button>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Supplier / Distributor Name</th>
                <th>Contact Person</th>
                <th>Phone Number</th>
                <th>GSTIN</th>
                <th>Drug License</th>
                <th>Credit Days</th>
                <th class="text-right">Outstanding Payable</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody id="sup-tbody">
              <tr><td colspan="9" class="text-center">Loading suppliers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadSuppliers();
  },

  bindEvents() {
    document.getElementById('btn-search-sup').addEventListener('click', () => this.loadSuppliers());
    const searchInput = document.getElementById('sup-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.loadSuppliers();
    });

    document.getElementById('btn-add-supplier').addEventListener('click', () => this.openSupplierForm(null));
  },

  async loadSuppliers() {
    const q = document.getElementById('sup-search').value.trim();
    const tbody = document.getElementById('sup-tbody');

    const suppliers = await window.api.parties.listSuppliers(q);
    if (!suppliers || suppliers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: var(--text-muted);">No suppliers found matching search.</td></tr>`;
      return;
    }

    tbody.innerHTML = suppliers
      .map(
        (s) => `
      <tr>
        <td class="font-mono"><strong>${s.code}</strong></td>
        <td><strong>${s.name}</strong></td>
        <td>${s.contact_person || 'N/A'}</td>
        <td>${s.phone || 'N/A'}</td>
        <td class="font-mono">${s.gstin || 'N/A'}</td>
        <td>${s.drug_license_no || 'N/A'}</td>
        <td>${s.payment_terms_days || 30} Days</td>
        <td class="text-right font-mono" style="font-weight: 700; color: ${s.current_balance > 0 ? '#b91c1c' : '#15803d'};">
          ${MediStock.formatRupees(s.current_balance)}
        </td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="window.MediStockViews.suppliers.openSupplierForm(${s.id})">Edit</button>
        </td>
      </tr>
    `
      )
      .join('');
  },

  async openSupplierForm(supplierId = null) {
    let sup = null;
    if (supplierId) {
      const all = await window.api.parties.listSuppliers();
      sup = all.find((x) => x.id === supplierId);
    }

    const bodyHtml = `
      <form id="supplier-form">
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Supplier Agency / Agency Name *:</label>
            <input type="text" id="s-name" class="form-control" value="${sup ? sup.name : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Person:</label>
            <input type="text" id="s-contact" class="form-control" value="${sup ? sup.contact_person || '' : ''}">
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Phone Number:</label>
            <input type="text" id="s-phone" class="form-control" value="${sup ? sup.phone || '' : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address:</label>
            <input type="email" id="s-email" class="form-control" value="${sup ? sup.email || '' : ''}">
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">GSTIN *:</label>
            <input type="text" id="s-gstin" class="form-control" value="${sup ? sup.gstin || '' : ''}" placeholder="27AABCM8901F1Z2">
          </div>
          <div class="form-group">
            <label class="form-label">Drug License No:</label>
            <input type="text" id="s-dl" class="form-control" value="${sup ? sup.drug_license_no || '' : ''}" placeholder="MH-DIST-1011">
          </div>
          <div class="form-group">
            <label class="form-label">Credit Terms (Days):</label>
            <input type="number" id="s-terms" class="form-control" value="${sup ? sup.payment_terms_days : 30}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Office / Godown Address:</label>
          <input type="text" id="s-addr" class="form-control" value="${sup ? sup.address || '' : ''}">
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-sup">${sup ? 'Update Supplier' : 'Save Supplier'}</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal(sup ? `Edit Supplier — ${sup.name}` : 'New Supplier / Distributor', bodyHtml, footerHtml, 'lg');

    document.getElementById('btn-save-sup').addEventListener('click', async () => {
      const name = document.getElementById('s-name').value.trim();
      if (!name) {
        MediStock.toast('Supplier name is required', 'warning');
        return;
      }

      try {
        await window.api.parties.saveSupplier({
          id: sup ? sup.id : undefined,
          name,
          contactPerson: document.getElementById('s-contact').value.trim() || null,
          phone: document.getElementById('s-phone').value.trim() || null,
          email: document.getElementById('s-email').value.trim() || null,
          gstin: document.getElementById('s-gstin').value.trim() || null,
          drugLicenseNo: document.getElementById('s-dl').value.trim() || null,
          terms: Number(document.getElementById('s-terms').value) || 30,
          address: document.getElementById('s-addr').value.trim() || null,
        });

        MediStock.closeModal();
        MediStock.toast(`Supplier "${name}" saved!`, 'success');
        this.loadSuppliers();
      } catch (err) {
        MediStock.toast(`Error: ${err.message}`, 'error');
      }
    });
  },
};
