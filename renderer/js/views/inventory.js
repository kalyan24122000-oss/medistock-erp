// renderer/js/views/inventory.js
// Batch-wise Inventory Matrix, Stock Valuation, Adjustments, and Movement Ledger

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.inventory = {
  activeTab: 'matrix', // 'matrix' or 'ledger'

  async render(container, params = {}) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📦 Batch-Wise Inventory & Stock Ledger</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-export-inventory-excel">Export to Excel</button>
            <button class="btn btn-primary btn-sm" onclick="MediStock.navigate('purchase')">+ Stock Inward / Purchase</button>
          </div>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn active" id="tab-inv-matrix">Batch Matrix & Valuation</button>
          <button class="tab-btn" id="tab-inv-ledger">Stock Movement Audit Trail</button>
        </div>

        <!-- Tab 1: Matrix View -->
        <div id="inv-matrix-panel">
          <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
            <input type="text" id="inv-search" class="form-control" style="width: 250px;" placeholder="Search Brand, Batch, Code, Barcode...">
            <select id="inv-status-filter" class="form-control" style="width: 180px;">
              <option value="ALL">All Batches</option>
              <option value="IN_STOCK" selected>In Stock (> 0)</option>
              <option value="NEAR_EXPIRY">Near Expiry (< 60 Days)</option>
              <option value="EXPIRED">Expired Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock (= 0)</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="btn-filter-inv">Search</button>
          </div>

          <div class="table-container">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Medicine Brand</th>
                  <th>Batch No</th>
                  <th>Expiry</th>
                  <th>Days Left</th>
                  <th>Rack/Shelf</th>
                  <th class="text-right">Cost Rate</th>
                  <th class="text-right">MRP</th>
                  <th class="text-right">Available Stock</th>
                  <th class="text-right">Stock Valuation</th>
                  <th class="text-center">Adjust</th>
                </tr>
              </thead>
              <tbody id="inv-tbody">
                <tr><td colspan="10" class="text-center">Loading batch stock...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Movement Ledger Panel -->
        <div id="inv-ledger-panel" style="display: none;">
          <div class="table-container">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th class="text-right">Prev Qty</th>
                  <th class="text-right">Change</th>
                  <th class="text-right">New Qty</th>
                  <th>Operator</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody id="ledger-tbody">
                <tr><td colspan="10" class="text-center">Loading movement ledger...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(params);
    this.loadBatchMatrix();
  },

  bindEvents(params) {
    const tabMatrix = document.getElementById('tab-inv-matrix');
    const tabLedger = document.getElementById('tab-inv-ledger');
    const matrixPanel = document.getElementById('inv-matrix-panel');
    const ledgerPanel = document.getElementById('inv-ledger-panel');

    tabMatrix.addEventListener('click', () => {
      tabMatrix.classList.add('active');
      tabLedger.classList.remove('active');
      matrixPanel.style.display = 'block';
      ledgerPanel.style.display = 'none';
      this.loadBatchMatrix();
    });

    tabLedger.addEventListener('click', () => {
      tabLedger.classList.add('active');
      tabMatrix.classList.remove('active');
      matrixPanel.style.display = 'none';
      ledgerPanel.style.display = 'block';
      this.loadMovementLedger();
    });

    const searchInput = document.getElementById('inv-search');
    const statusSelect = document.getElementById('inv-status-filter');

    if (params.filter === 'LOW_STOCK') {
      statusSelect.value = 'ALL';
    }

    document.getElementById('btn-filter-inv').addEventListener('click', () => this.loadBatchMatrix());
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.loadBatchMatrix();
    });

    document.getElementById('btn-export-inventory-excel').addEventListener('click', async () => {
      const res = await window.api.inventory.listBatches({ limit: 1000 });
      if (!res.rows || res.rows.length === 0) {
        MediStock.toast('No inventory to export', 'warning');
        return;
      }
      const data = res.rows.map((r) => ({
        Medicine: r.brand_name,
        'Batch No': r.batch_number,
        Expiry: r.expiry_date,
        'Days Left': Math.round(r.days_to_expiry),
        Rack: r.rack_location,
        'Cost Rate': (r.purchase_rate / 100).toFixed(2),
        MRP: (r.mrp / 100).toFixed(2),
        'Available Qty': r.available_qty,
        'Unit': r.sale_unit,
        'Valuation (₹)': (r.total_valuation / 100).toFixed(2),
      }));
      const expRes = await window.api.export.exportToExcel(data, 'Batch_Inventory_Valuation.xlsx');
      if (expRes.success) {
        MediStock.toast(`Exported inventory to ${expRes.filePath}`, 'success');
      }
    });
  },

  async loadBatchMatrix() {
    const search = document.getElementById('inv-search').value.trim();
    const status = document.getElementById('inv-status-filter').value;
    const tbody = document.getElementById('inv-tbody');

    const res = await window.api.inventory.listBatches({ search, status, limit: 100 });

    if (!res.rows || res.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No batch records match query.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.rows
      .map(
        (b) => `
      <tr>
        <td>
          <strong>${b.brand_name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${b.generic_name || ''}</div>
        </td>
        <td><span class="font-mono"><strong>${b.batch_number}</strong></span></td>
        <td>${b.expiry_date}</td>
        <td>
          <span class="badge ${b.days_to_expiry < 0 ? 'danger' : b.days_to_expiry <= 60 ? 'warning' : 'success'}">
            ${b.days_to_expiry < 0 ? 'EXPIRED' : `${Math.round(b.days_to_expiry)} days`}
          </span>
        </td>
        <td><span class="badge neutral">${b.rack_location || 'N/A'}</span></td>
        <td class="text-right font-mono">${MediStock.formatRupees(b.purchase_rate)}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(b.mrp)}</td>
        <td class="text-right font-mono" style="font-weight: 700; font-size: 13px;">
          ${b.available_qty} ${b.sale_unit}
        </td>
        <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">
          ${MediStock.formatRupees(b.total_valuation)}
        </td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="window.MediStockViews.inventory.openAdjustModal(${b.id}, '${b.brand_name.replace(/'/g, "\\'")}', '${b.batch_number}', ${b.available_qty})">
            Adjust
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  },

  async loadMovementLedger() {
    const tbody = document.getElementById('ledger-tbody');
    const movements = await window.api.inventory.getMovementLedger({ limit: 60 });

    if (!movements || movements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No stock movements recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = movements
      .map(
        (m) => `
      <tr>
        <td style="font-size: 11px;">${m.created_at}</td>
        <td><strong>${m.brand_name}</strong></td>
        <td><span class="font-mono">${m.batch_number}</span></td>
        <td><span class="badge ${m.movement_type === 'PURCHASE' ? 'success' : m.movement_type === 'SALE' ? 'info' : 'warning'}">${m.movement_type}</span></td>
        <td class="font-mono">${m.reference_id || 'N/A'}</td>
        <td class="text-right font-mono">${m.previous_qty}</td>
        <td class="text-right font-mono" style="font-weight: 700; color: ${m.new_qty >= m.previous_qty ? '#16a34a' : '#dc2626'};">
          ${m.new_qty >= m.previous_qty ? '+' : ''}${(m.new_qty - m.previous_qty).toFixed(1)}
        </td>
        <td class="text-right font-mono" style="font-weight: 700;">${m.new_qty}</td>
        <td style="font-size: 11px;">${m.operator_name || 'Pharmacist'}</td>
        <td style="font-size: 11.5px; color: var(--text-muted);">${m.remarks || ''}</td>
      </tr>
    `
      )
      .join('');
  },

  openAdjustModal(batchId, brandName, batchNumber, currentQty) {
    const bodyHtml = `
      <div>
        <p style="margin-bottom: 12px; font-size: 13px;">
          Adjust Stock for <strong>${brandName}</strong> (Batch: <strong>${batchNumber}</strong>)
          <br>Current Available Stock: <strong>${currentQty}</strong>
        </p>

        <div class="form-group">
          <label class="form-label">Adjustment Type:</label>
          <select id="adj-type" class="form-control">
            <option value="ADD">Add Stock (Found Physical Stock / Stock Check)</option>
            <option value="SUB">Subtract Stock (Physical Shortage)</option>
            <option value="DAMAGE">Mark as Damaged / Broken Units</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Quantity to Adjust:</label>
          <input type="number" id="adj-qty" class="form-control" min="0.1" step="any" value="1">
        </div>

        <div class="form-group">
          <label class="form-label">Mandatory Audit Reason:</label>
          <input type="text" id="adj-reason" class="form-control" placeholder="e.g. Broken vial during shelf restock or monthly physical count">
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-confirm-adjust">Confirm Adjustment</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal('Stock Adjustment & Audit', bodyHtml, footerHtml, 'md');

    document.getElementById('btn-confirm-adjust').addEventListener('click', async () => {
      const type = document.getElementById('adj-type').value;
      const qty = Number(document.getElementById('adj-qty').value);
      const reason = document.getElementById('adj-reason').value.trim();

      if (!reason) {
        MediStock.toast('Please provide a mandatory audit reason', 'warning');
        return;
      }

      try {
        const res = await window.api.inventory.adjustStock({
          batchId,
          adjustmentType: type,
          quantity: qty,
          reason,
          userId: MediStock.currentUser ? MediStock.currentUser.id : null,
        });

        if (res.success) {
          MediStock.closeModal();
          MediStock.toast(`Stock adjusted! New quantity: ${res.newQty}`, 'success');
          this.loadBatchMatrix();
        }
      } catch (err) {
        MediStock.toast(`Adjustment failed: ${err.message}`, 'error');
      }
    });
  },
};
