// renderer/js/views/customers.js
// Customer & Patient Directory, Credit Limits, and Patient Histories

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.customers = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">👥 Customers & Patient Accounts</div>
          <button class="btn btn-primary btn-sm" id="btn-add-customer">+ Add New Customer</button>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
          <input type="text" id="cust-search" class="form-control" style="width: 280px;" placeholder="Search Customer Name, Phone, Code...">
          <button class="btn btn-secondary btn-sm" id="btn-search-cust">Search</button>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer / Patient Name</th>
                <th>Phone Number</th>
                <th>Type</th>
                <th>Address</th>
                <th>GSTIN</th>
                <th class="text-right">Credit Limit</th>
                <th class="text-right">Outstanding Balance</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody id="cust-tbody">
              <tr><td colspan="9" class="text-center">Loading customers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadCustomers();
  },

  bindEvents() {
    document.getElementById('btn-search-cust').addEventListener('click', () => this.loadCustomers());
    const searchInput = document.getElementById('cust-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.loadCustomers();
    });

    document.getElementById('btn-add-customer').addEventListener('click', () => this.openCustomerForm(null));
  },

  async loadCustomers() {
    const q = document.getElementById('cust-search').value.trim();
    const tbody = document.getElementById('cust-tbody');

    const customers = await window.api.parties.listCustomers(q);
    if (!customers || customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 24px; color: var(--text-muted);">No customers found matching search.</td></tr>`;
      return;
    }

    tbody.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td class="font-mono"><strong>${c.code}</strong></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone || 'N/A'}</td>
        <td><span class="badge ${c.price_group === 'WHOLESALE' ? 'purple' : 'info'}">${c.price_group}</span></td>
        <td style="font-size: 11.5px;">${c.address || c.city || 'N/A'}</td>
        <td class="font-mono">${c.gstin || 'Unregistered'}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(c.credit_limit)}</td>
        <td class="text-right font-mono" style="font-weight: 700; color: ${c.current_balance > 0 ? '#dc2626' : '#16a34a'};">
          ${MediStock.formatRupees(c.current_balance)}
        </td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="window.MediStockViews.customers.openCustomerForm(${c.id})">Edit</button>
        </td>
      </tr>
    `
      )
      .join('');
  },

  async openCustomerForm(customerId = null) {
    let cust = null;
    if (customerId) {
      const all = await window.api.parties.listCustomers();
      cust = all.find((x) => x.id === customerId);
    }

    const bodyHtml = `
      <form id="customer-form">
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Full Customer / Patient Name *:</label>
            <input type="text" id="c-name" class="form-control" value="${cust ? cust.name : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Phone Number:</label>
            <input type="text" id="c-phone" class="form-control" value="${cust ? cust.phone || '' : ''}" placeholder="10 digits">
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Price Category:</label>
            <select id="c-group" class="form-control">
              <option value="RETAIL" ${cust && cust.price_group === 'RETAIL' ? 'selected' : ''}>Retail Walk-In</option>
              <option value="WHOLESALE" ${cust && cust.price_group === 'WHOLESALE' ? 'selected' : ''}>Wholesale Clinic / Hospital</option>
              <option value="STAFF" ${cust && cust.price_group === 'STAFF' ? 'selected' : ''}>Pharmacy Staff</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Credit Limit (₹):</label>
            <input type="number" id="c-limit" class="form-control" value="${cust ? (cust.credit_limit / 100).toFixed(2) : '0.00'}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Address Line:</label>
          <input type="text" id="c-addr" class="form-control" value="${cust ? cust.address || '' : ''}">
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">City:</label>
            <input type="text" id="c-city" class="form-control" value="${cust ? cust.city || 'Mumbai' : 'Mumbai'}">
          </div>
          <div class="form-group">
            <label class="form-label">GSTIN (Optional):</label>
            <input type="text" id="c-gstin" class="form-control" value="${cust ? cust.gstin || '' : ''}" placeholder="27AAAAA0000A1Z5">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-cust">${cust ? 'Update Profile' : 'Save Customer'}</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal(cust ? `Edit Customer — ${cust.name}` : 'New Customer Account', bodyHtml, footerHtml, 'md');

    document.getElementById('btn-save-cust').addEventListener('click', async () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) {
        MediStock.toast('Customer name is required', 'warning');
        return;
      }

      const limit = Math.round(Number(document.getElementById('c-limit').value) * 100);

      try {
        await window.api.parties.saveCustomer({
          id: cust ? cust.id : undefined,
          name,
          phone: document.getElementById('c-phone').value.trim() || null,
          priceGroup: document.getElementById('c-group').value,
          creditLimit: limit,
          address: document.getElementById('c-addr').value.trim() || null,
          city: document.getElementById('c-city').value.trim() || 'Mumbai',
          gstin: document.getElementById('c-gstin').value.trim() || null,
        });

        MediStock.closeModal();
        MediStock.toast(`Customer "${name}" saved!`, 'success');
        this.loadCustomers();
      } catch (err) {
        MediStock.toast(`Error: ${err.message}`, 'error');
      }
    });
  },
};
