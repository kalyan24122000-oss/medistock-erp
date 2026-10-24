// renderer/js/views/reports.js
// Advanced Management Reports, Fast-Moving Products, and Auto-Reorder Calculations

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.reports = {
  activeTab: 'reorder', // 'reorder', 'fast_moving'

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Management Analytics & Inventory Planning</div>
          <button class="btn btn-outline btn-sm" id="btn-export-report-excel">Export Report</button>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn ${this.activeTab === 'reorder' ? 'active' : ''}" data-tab="reorder">
            📦 Stock Reordering & Suggested PO
          </button>
          <button class="tab-btn ${this.activeTab === 'fast_moving' ? 'active' : ''}" data-tab="fast_moving">
            ⚡ Fast-Moving Medicines (Top 10)
          </button>
        </div>

        <div id="reports-content-area">
          <p>Loading analytics...</p>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderActiveTab();
  },

  bindEvents() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.getAttribute('data-tab');
        this.renderActiveTab();
      });
    });

    document.getElementById('btn-export-report-excel').addEventListener('click', async () => {
      if (this.activeTab === 'reorder') {
        const reorders = await window.api.reports.getReorder();
        const data = reorders.map((r) => ({
          Medicine: r.brand_name,
          'Current Stock': r.current_stock,
          'Reorder Level': r.reorder_level,
          'Max Level': r.max_level,
          'Suggested Order Qty': r.suggested_order_qty,
          'Preferred Supplier': r.preferred_supplier_name || 'Direct Wholesale',
          'Est. Purchase Cost (₹)': ((r.suggested_order_qty * r.purchase_rate) / 100).toFixed(2),
        }));
        const res = await window.api.export.exportToExcel(data, 'Suggested_Reorders.xlsx');
        if (res.success) MediStock.toast(`Exported reorder sheet to ${res.filePath}`, 'success');
      }
    });
  },

  async renderActiveTab() {
    const area = document.getElementById('reports-content-area');
    if (!area) return;

    if (this.activeTab === 'reorder') {
      const reorders = await window.api.reports.getReorder();
      area.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 12px; border-radius: var(--radius); margin-bottom: 14px;">
          <strong style="color: #0369a1;">Suggested Order Quantity Formula:</strong>
          <span style="font-size: 12px; color: #334155;">
            <code>Suggested Qty = max(0, Target Stock − Available Stock)</code>. Excludes expired or blocked batches from available stock.
          </span>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Medicine Brand Name</th>
                <th>Pack Unit</th>
                <th class="text-right">Current Available</th>
                <th class="text-right">Reorder Level</th>
                <th class="text-right">Target Max Level</th>
                <th class="text-right">Suggested Order Qty</th>
                <th>Preferred Supplier</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                reorders.length === 0
                  ? `<tr><td colspan="9" class="text-center" style="padding: 24px; color: var(--text-muted);">All medicine stocks are healthy and above reorder thresholds!</td></tr>`
                  : reorders
                      .map(
                        (r) => `
                    <tr>
                      <td class="font-mono"><strong>${r.code}</strong></td>
                      <td><strong>${r.brand_name}</strong></td>
                      <td><span class="badge neutral">${r.sale_unit}</span></td>
                      <td class="text-right font-mono" style="font-weight: 700; color: #dc2626;">${r.current_stock}</td>
                      <td class="text-right font-mono">${r.reorder_level}</td>
                      <td class="text-right font-mono">${r.max_level}</td>
                      <td class="text-right font-mono" style="font-weight: 800; font-size: 13.5px; color: #16a34a;">
                        ${r.suggested_order_qty} ${r.sale_unit}s
                      </td>
                      <td>${r.preferred_supplier_name || 'Direct Wholesale'}</td>
                      <td class="text-center">
                        <button class="btn btn-primary btn-sm" onclick="MediStock.navigate('purchase')">Create PO</button>
                      </td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `;
    } else {
      const data = await window.api.reports.getMovementAnalysis(30);
      area.innerHTML = `
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product Code</th>
                <th>Medicine Brand Name</th>
                <th class="text-right">Sold Quantity (Last 30 Days)</th>
                <th class="text-right">Total Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              ${
                data.fastMoving.length === 0
                  ? `<tr><td colspan="5" class="text-center">No sales recorded in the last 30 days.</td></tr>`
                  : data.fastMoving
                      .map(
                        (f, idx) => `
                    <tr>
                      <td><span class="badge ${idx < 3 ? 'warning' : 'neutral'}">#${idx + 1}</span></td>
                      <td class="font-mono">${f.code}</td>
                      <td><strong>${f.brand_name}</strong></td>
                      <td class="text-right font-mono" style="font-weight: 700;">${f.sold_qty} ${f.sale_unit}s</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">${MediStock.formatRupees(f.total_revenue)}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `;
    }
  },
};
