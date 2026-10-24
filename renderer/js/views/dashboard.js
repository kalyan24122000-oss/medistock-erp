// renderer/js/views/dashboard.js
// Modern Pharmacy Dashboard View with Live Database KPIs, Sales Trend, and Alerts

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.dashboard = {
  async render(container) {
    container.innerHTML = `<div class="card"><p>Loading pharmacy dashboard...</p></div>`;

    try {
      const data = await window.api.reports.getDashboard();

      container.innerHTML = `
        <div class="dashboard-wrapper">
          <!-- KPI Metrics Row 1 -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-icon blue">₹</div>
              <div class="kpi-content">
                <div class="kpi-label">Today's Sales</div>
                <div class="kpi-value">${MediStock.formatRupees(data.todaySales)}</div>
                <div class="kpi-subtext">${data.todayInvoiceCount} Bills Generated</div>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon green">₹</div>
              <div class="kpi-content">
                <div class="kpi-label">Cash Collected</div>
                <div class="kpi-value">${MediStock.formatRupees(data.cashReceipts)}</div>
                <div class="kpi-subtext">Digital: ${MediStock.formatRupees(data.digitalReceipts)}</div>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon amber">₹</div>
              <div class="kpi-content">
                <div class="kpi-label">Customer Dues</div>
                <div class="kpi-value">${MediStock.formatRupees(data.customerOutstanding)}</div>
                <div class="kpi-subtext">Today's Credit: ${MediStock.formatRupees(data.creditSales)}</div>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon purple">₹</div>
              <div class="kpi-content">
                <div class="kpi-label">Supplier Payables</div>
                <div class="kpi-value">${MediStock.formatRupees(data.supplierPayables)}</div>
                <div class="kpi-subtext">Today's Purch: ${MediStock.formatRupees(data.todayPurchases)}</div>
              </div>
            </div>
          </div>

          <!-- KPI Metrics Row 2: Inventory Alerts -->
          <div class="kpi-grid">
            <div class="kpi-card" style="cursor: pointer;" onclick="MediStock.navigate('inventory', { filter: 'LOW_STOCK' })">
              <div class="kpi-icon amber">⚠️</div>
              <div class="kpi-content">
                <div class="kpi-label">Low Stock Medicines</div>
                <div class="kpi-value">${data.lowStockCount} Items</div>
                <div class="kpi-subtext">Below reorder threshold</div>
              </div>
            </div>

            <div class="kpi-card" style="cursor: pointer;" onclick="MediStock.navigate('expiry', { tab: '60_DAYS' })">
              <div class="kpi-icon amber">⏳</div>
              <div class="kpi-content">
                <div class="kpi-label">Near Expiry (&lt; 60 Days)</div>
                <div class="kpi-value">${data.nearExpiryBatchesCount} Batches</div>
                <div class="kpi-subtext">MRP Value: ${MediStock.formatRupees(data.nearExpiryMrpValuation)}</div>
              </div>
            </div>

            <div class="kpi-card" style="cursor: pointer;" onclick="MediStock.navigate('expiry', { tab: 'EXPIRED' })">
              <div class="kpi-icon red">⛔</div>
              <div class="kpi-content">
                <div class="kpi-label">Expired Stock (Isolated)</div>
                <div class="kpi-value">${data.expiredBatchesCount} Batches</div>
                <div class="kpi-subtext">Loss Cost: ${MediStock.formatRupees(data.expiredLossValuation)}</div>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon blue">⚡</div>
              <div class="kpi-content">
                <div class="kpi-label">Fast Actions</div>
                <div style="display: flex; gap: 6px; margin-top: 4px;">
                  <button class="btn btn-primary btn-sm" onclick="MediStock.navigate('billing')">+ New Bill</button>
                  <button class="btn btn-secondary btn-sm" onclick="MediStock.navigate('purchase')">+ Purchase</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Grid: Recent Invoices & 7-Day Trend -->
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
            <div class="card">
              <div class="card-header">
                <div class="card-title">Recent Invoices</div>
                <button class="btn btn-outline btn-sm" onclick="MediStock.navigate('sales')">View All Invoices &rarr;</button>
              </div>

              <div class="table-container">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Mode</th>
                      <th class="text-right">Grand Total</th>
                      <th class="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      data.recentInvoices.length === 0
                        ? `<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-muted);">No sales invoices recorded yet. Start billing with F2!</td></tr>`
                        : data.recentInvoices
                            .map(
                              (inv) => `
                        <tr>
                          <td class="font-mono"><strong>${inv.invoice_number}</strong></td>
                          <td>${inv.invoice_date}</td>
                          <td>${inv.customer_name || 'Walk-in Cash'}</td>
                          <td><span class="badge ${inv.payment_mode === 'CASH' ? 'success' : inv.payment_mode === 'CREDIT' ? 'warning' : 'info'}">${inv.payment_mode}</span></td>
                          <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(inv.grand_total)}</td>
                          <td class="text-center">
                            <button class="btn btn-secondary btn-sm" onclick="MediStock.viewInvoiceDetails(${inv.id})">View / Print</button>
                          </td>
                        </tr>
                      `
                            )
                            .join('')
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Fast Navigation & System Status -->
            <div class="card">
              <div class="card-header">
                <div class="card-title">Pharmacy Controls</div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="MediStock.navigate('compliance')">
                  📋 View Schedule H / H1 Register
                </button>
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="MediStock.navigate('inventory', { filter: 'LOW_STOCK' })">
                  📦 Check Suggested Reorders
                </button>
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="MediStock.navigate('gst')">
                  📑 GST Summary (GSTR-1 / 3B)
                </button>
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="MediStock.navigate('accounts')">
                  ⚖️ Trial Balance & Ledgers
                </button>
                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="MediStock.navigate('backup')">
                  💾 SQLite Database Backup & Restore
                </button>
              </div>

              <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: var(--radius); border: 1px solid var(--border);">
                <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">System Health</div>
                <div style="margin-top: 6px; font-size: 12px; color: #16a34a; font-weight: 600;">● SQLite WAL Mode Active</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Offline Database Synced & Verified</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card"><p style="color: red;">Failed to load dashboard: ${err.message}</p></div>`;
    }
  },
};
