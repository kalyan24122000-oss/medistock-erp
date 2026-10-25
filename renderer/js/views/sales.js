// renderer/js/views/sales.js
// Sales Invoices Registry, Invoice Reprinting, and Sales Return Initiation

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.sales = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📄 Sales Invoices Register</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-export-sales-excel">Export to Excel</button>
            <button class="btn btn-primary btn-sm" onclick="MediStock.navigate('billing')">+ New Retail Bill (F2)</button>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
          <input type="text" id="sales-search" class="form-control" style="width: 250px;" placeholder="Search Invoice No or Customer...">
          <input type="date" id="sales-from-date" class="form-control" style="width: 150px;">
          <input type="date" id="sales-to-date" class="form-control" style="width: 150px;">
          <button class="btn btn-secondary btn-sm" id="btn-filter-sales">Filter</button>
          <button class="btn btn-outline btn-sm" id="btn-reset-sales">Reset</button>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Mode</th>
                <th class="text-right">Items</th>
                <th class="text-right">Taxable</th>
                <th class="text-right">Tax</th>
                <th class="text-right">Grand Total</th>
                <th>Operator</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody id="sales-tbody">
              <tr><td colspan="10" class="text-center">Loading invoices...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('sales-search');
    const fromInput = document.getElementById('sales-from-date');
    const toInput = document.getElementById('sales-to-date');

    const loadData = async () => {
      const res = await window.api.sales.listInvoices({
        search: searchInput.value.trim(),
        fromDate: fromInput.value || null,
        toDate: toInput.value || null,
        limit: 50,
      });

      const tbody = document.getElementById('sales-tbody');
      if (!res.rows || res.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No sales invoices found matching filter criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.rows
        .map(
          (inv) => `
        <tr>
          <td class="font-mono"><strong>${inv.invoice_number}</strong></td>
          <td>${inv.invoice_date}</td>
          <td>${inv.customer_name || 'Walk-in Cash'}</td>
          <td><span class="badge ${inv.payment_mode === 'CASH' ? 'success' : inv.payment_mode === 'CREDIT' ? 'warning' : 'info'}">${inv.payment_mode}</span></td>
          <td class="text-right">${inv.total_items}</td>
          <td class="text-right font-mono">${MediStock.formatRupees(inv.taxable_amount)}</td>
          <td class="text-right font-mono">${MediStock.formatRupees(inv.total_tax)}</td>
          <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(inv.grand_total)}</td>
          <td style="font-size: 11px;">${inv.operator_name || 'Pharmacist'}</td>
          <td class="text-center">
            <button class="btn btn-secondary btn-sm" onclick="MediStock.viewInvoiceDetails(${inv.id})">Reprint</button>
            <button class="btn btn-outline btn-sm" onclick="window.MediStockViews.sales.initiateReturn(${inv.id})">Return</button>
          </td>
        </tr>
      `
        )
        .join('');
    };

    document.getElementById('btn-filter-sales').addEventListener('click', loadData);
    document.getElementById('btn-reset-sales').addEventListener('click', () => {
      searchInput.value = '';
      fromInput.value = '';
      toInput.value = '';
      loadData();
    });

    document.getElementById('btn-export-sales-excel').addEventListener('click', async () => {
      const res = await window.api.sales.listInvoices({ limit: 1000 });
      if (!res.rows || res.rows.length === 0) {
        MediStock.toast('No sales records to export', 'warning');
        return;
      }
      const exportData = res.rows.map((r) => ({
        'Invoice Number': r.invoice_number,
        Date: r.invoice_date,
        Customer: r.customer_name,
        Payment: r.payment_mode,
        'Items Count': r.total_items,
        Taxable: (r.taxable_amount / 100).toFixed(2),
        CGST: (r.cgst_amount / 100).toFixed(2),
        SGST: (r.sgst_amount / 100).toFixed(2),
        'Grand Total': (r.grand_total / 100).toFixed(2),
      }));
      const exportRes = await window.api.export.exportToExcel(exportData, 'Sales_Register_MediStock.xlsx');
      if (exportRes.success) {
        MediStock.toast(`Exported sales to ${exportRes.filePath}`, 'success');
      }
    });

    loadData();
  },

  async initiateReturn(invoiceId) {
    const inv = await window.api.sales.getInvoice(invoiceId);
    if (!inv) return;

    const bodyHtml = `
      <div>
        <p style="margin-bottom: 10px;">Select items and enter quantity to return from Invoice <strong>${inv.invoice_number}</strong>:</p>
        <table class="erp-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Batch</th>
              <th>Sold Qty</th>
              <th>Rate</th>
              <th>Return Qty</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items
              .map(
                (it) => `
              <tr>
                <td>${it.brand_name}</td>
                <td>${it.batch_number}</td>
                <td>${it.quantity}</td>
                <td>${MediStock.formatRupees(it.selling_rate)}</td>
                <td>
                  <input type="number" min="0" max="${it.quantity}" value="0" class="form-control ret-qty-input"
                         data-item-id="${it.id}" style="width: 75px;">
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label">Return Reason:</label>
          <input type="text" id="return-reason" class="form-control" value="Patient returned medicine" placeholder="Reason for return">
        </div>

        <div class="form-group">
          <label class="form-label">Quarantine & Stock Policy:</label>
          <select id="return-quarantine" class="form-control">
            <option value="QUARANTINED">Hold in Quarantine (Inspect before resale)</option>
            <option value="RETURNED_TO_STOCK">Restock Immediately to Available Batch</option>
          </select>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-danger" id="btn-confirm-return">Issue Credit Note & Return</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal(`Sales Return — ${inv.invoice_number}`, bodyHtml, footerHtml, 'lg');

    document.getElementById('btn-confirm-return').addEventListener('click', async () => {
      const itemsToReturn = [];
      document.querySelectorAll('.ret-qty-input').forEach((inp) => {
        const q = Number(inp.value);
        if (q > 0) {
          itemsToReturn.push({
            invoiceItemId: Number(inp.getAttribute('data-item-id')),
            quantity: q,
          });
        }
      });

      if (itemsToReturn.length === 0) {
        MediStock.toast('Please enter return quantity > 0 for at least one item', 'warning');
        return;
      }

      const reason = document.getElementById('return-reason').value;
      const quarantineStatus = document.getElementById('return-quarantine').value;

      try {
        const res = await window.api.returns.processSalesReturn({
          salesInvoiceId: inv.id,
          reason,
          quarantineStatus,
          items: itemsToReturn,
          userId: MediStock.currentUser ? MediStock.currentUser.id : null,
        });

        MediStock.closeModal();
        MediStock.toast(`Credit Note ${res.returnNumber} issued successfully! Amount: ${MediStock.formatRupees(res.grandTotal)}`, 'success');
        MediStock.navigate('sales');
      } catch (err) {
        MediStock.toast(`Return error: ${err.message}`, 'error');
      }
    });
  },
};
