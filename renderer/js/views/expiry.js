// renderer/js/views/expiry.js
// Dedicated Pharmacy Expiry Control, Near-Expiry Warnings, and Supplier Expiry Returns

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.expiry = {
  currentTab: '60_DAYS',

  async render(container, params = {}) {
    if (params.tab) this.currentTab = params.tab;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⏳ Expiry Control & Supplier Return Preparation</div>
          <button class="btn btn-outline btn-sm" id="btn-export-expiry-excel">Export Expiry Report</button>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn ${this.currentTab === 'EXPIRED' ? 'active' : ''}" data-tab="EXPIRED">
            ⛔ Already Expired Stock
          </button>
          <button class="tab-btn ${this.currentTab === '30_DAYS' ? 'active' : ''}" data-tab="30_DAYS">
            ⚠️ Expiring in &lt; 30 Days
          </button>
          <button class="tab-btn ${this.currentTab === '60_DAYS' ? 'active' : ''}" data-tab="60_DAYS">
            ⚡ Expiring in &lt; 60 Days
          </button>
          <button class="tab-btn ${this.currentTab === '90_DAYS' ? 'active' : ''}" data-tab="90_DAYS">
            📅 Expiring in &lt; 90 Days
          </button>
        </div>

        <div id="expiry-alert-banner" style="margin-bottom: 14px; padding: 12px; border-radius: var(--radius);"></div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Medicine Brand</th>
                <th>Batch No</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Rack Location</th>
                <th>Supplier</th>
                <th class="text-right">Available Qty</th>
                <th class="text-right">Cost Value</th>
                <th class="text-right">MRP Value</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody id="expiry-tbody">
              <tr><td colspan="10" class="text-center">Loading expiry records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadExpiryData();
  },

  bindEvents() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab');
        this.loadExpiryData();
      });
    });

    document.getElementById('btn-export-expiry-excel').addEventListener('click', async () => {
      const records = await window.api.reports.getExpiry(this.currentTab);
      if (!records || records.length === 0) {
        MediStock.toast('No records to export', 'warning');
        return;
      }
      const data = records.map((r) => ({
        Medicine: r.brand_name,
        Batch: r.batch_number,
        Expiry: r.expiry_date,
        'Days Left': r.days_remaining,
        Rack: r.rack_location,
        Supplier: r.supplier_name,
        'Qty in Stock': r.available_qty,
        'Cost Value (₹)': (r.total_cost / 100).toFixed(2),
        'MRP Value (₹)': (r.total_mrp / 100).toFixed(2),
      }));
      const expRes = await window.api.export.exportToExcel(data, `Expiry_Report_${this.currentTab}.xlsx`);
      if (expRes.success) {
        MediStock.toast(`Exported expiry list to ${expRes.filePath}`, 'success');
      }
    });
  },

  async loadExpiryData() {
    const tbody = document.getElementById('expiry-tbody');
    const banner = document.getElementById('expiry-alert-banner');

    const records = await window.api.reports.getExpiry(this.currentTab);

    if (this.currentTab === 'EXPIRED') {
      banner.style.background = '#fee2e2';
      banner.style.border = '1px solid #fca5a5';
      banner.innerHTML = `
        <strong style="color: #991b1b;">Expired Stock Quarantine Notice:</strong>
        <span style="color: #7f1d1d; font-size: 12px;">
          These batches have crossed expiry date and are strictly barred from retail sale. Return to supplier for credit notes or write off as damage.
        </span>
      `;
    } else {
      banner.style.background = '#fef3c7';
      banner.style.border = '1px solid #fde68a';
      banner.innerHTML = `
        <strong style="color: #92400e;">Near-Expiry Alert:</strong>
        <span style="color: #78350f; font-size: 12px;">
          Prioritize dispensing these batches via First Expiry First Out (FEFO) or negotiate return replacement with suppliers.
        </span>
      `;
    }

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No batches found in ${this.currentTab} range. Stock is fresh!</td></tr>`;
      return;
    }

    tbody.innerHTML = records
      .map(
        (r) => `
      <tr>
        <td>
          <strong>${r.brand_name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${r.generic_name || ''}</div>
        </td>
        <td><span class="font-mono"><strong>${r.batch_number}</strong></span></td>
        <td>${r.expiry_date}</td>
        <td>
          <span class="badge ${r.days_remaining < 0 ? 'danger' : r.days_remaining <= 30 ? 'danger' : 'warning'}">
            ${r.days_remaining < 0 ? `Expired ${Math.abs(r.days_remaining)}d ago` : `${r.days_remaining} days remaining`}
          </span>
        </td>
        <td><span class="badge neutral">${r.rack_location || 'N/A'}</span></td>
        <td>${r.supplier_name || 'Direct Wholesale'}</td>
        <td class="text-right font-mono" style="font-weight: 700;">${r.available_qty} ${r.sale_unit}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(r.total_cost)}</td>
        <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(r.total_mrp)}</td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick="window.MediStockViews.expiry.openSupplierReturnModal(${r.id}, '${r.brand_name.replace(/'/g, "\\'")}', '${r.batch_number}', ${r.available_qty})">
            Return to Supplier
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  },

  async openSupplierReturnModal(batchId, brandName, batchNumber, currentQty) {
    const suppliers = await window.api.parties.listSuppliers();

    const bodyHtml = `
      <div>
        <p style="margin-bottom: 12px; font-size: 13px;">
          Initiate Purchase Return / Debit Note for:
          <br><strong>${brandName}</strong> (Batch: <strong>${batchNumber}</strong>)
          <br>Available Returnable Stock: <strong>${currentQty}</strong>
        </p>

        <div class="form-group">
          <label class="form-label">Return to Supplier:</label>
          <select id="pr-supplier" class="form-control">
            ${suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Quantity to Return:</label>
          <input type="number" id="pr-qty" class="form-control" min="1" max="${currentQty}" value="${currentQty}">
        </div>

        <div class="form-group">
          <label class="form-label">Return Reason:</label>
          <input type="text" id="pr-reason" class="form-control" value="Expired / Near-expiry stock return for supplier credit note">
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-danger" id="btn-confirm-supplier-return">Issue Debit Note & Return</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal('Supplier Expiry Return', bodyHtml, footerHtml, 'md');

    document.getElementById('btn-confirm-supplier-return').addEventListener('click', async () => {
      const supId = Number(document.getElementById('pr-supplier').value);
      const qty = Number(document.getElementById('pr-qty').value);
      const reason = document.getElementById('pr-reason').value.trim();

      if (!supId || qty <= 0) {
        MediStock.toast('Please check supplier and return quantity', 'warning');
        return;
      }

      try {
        const res = await window.api.returns.processPurchaseReturn({
          supplierId: supId,
          reason,
          items: [{ batchId, quantity: qty }],
          userId: MediStock.currentUser ? MediStock.currentUser.id : null,
        });

        if (res.success) {
          MediStock.closeModal();
          MediStock.toast(`Debit Note ${res.returnNumber} generated! Value: ${MediStock.formatRupees(res.grandTotal)}`, 'success');
          this.loadExpiryData();
        }
      } catch (err) {
        MediStock.toast(`Return failed: ${err.message}`, 'error');
      }
    });
  },
};
