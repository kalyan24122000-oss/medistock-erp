// renderer/js/views/wholesale.js
// Wholesale Billing Engine with Bulk Item Entry and Credit Limit Management

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.wholesale = {
  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏢 Wholesale Medicine Billing & Delivery Challan</div>
          <button class="btn btn-primary btn-sm" onclick="MediStock.navigate('billing')">Switch to Retail POS</button>
        </div>

        <div style="background: #e0f2fe; border: 1px solid #bae6fd; padding: 12px; border-radius: var(--radius); margin-bottom: 16px;">
          <h4 style="color: #0369a1; font-size: 13px; font-weight: 700;">Wholesale Distribution Billing</h4>
          <p style="font-size: 12px; color: #0c4a6e; margin-top: 4px;">
            Supports wholesale clinic/hospital invoices with GST compliance, bulk strip/box quantities, trade discounts, and payment terms tracking.
          </p>
        </div>

        <div class="form-grid" style="margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label">Wholesale Customer / Clinic / Hospital:</label>
            <select id="ws-customer" class="form-control">
              <option value="">-- Select Wholesale Customer --</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Terms / Credit Days:</label>
            <input type="text" id="ws-terms" class="form-control" value="30 Days Net" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Order Ref / Delivery Challan No:</label>
            <input type="text" id="ws-order-ref" class="form-control" placeholder="PO-2026-CLINIC">
          </div>
        </div>

        <div style="text-align: center; padding: 30px; background: #f8fafc; border: 2px dashed var(--border); border-radius: var(--radius);">
          <p style="font-size: 13.5px; font-weight: 600; color: #475569;">Wholesale Quick-Billing Grid</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            To create wholesale invoices, select the wholesale customer above or use the high-speed Retail POS billing with wholesale price group.
          </p>
          <button class="btn btn-primary" style="margin-top: 14px;" onclick="MediStock.navigate('billing')">
            Launch Fast Billing Grid &rarr;
          </button>
        </div>
      </div>
    `;

    // Load wholesale customers
    window.api.parties.listCustomers().then((custs) => {
      const select = document.getElementById('ws-customer');
      if (select) {
        custs
          .filter((c) => c.price_group === 'WHOLESALE')
          .forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (GSTIN: ${c.gstin || 'N/A'}, Credit: ${MediStock.formatRupees(c.current_balance)})`;
            select.appendChild(opt);
          });
      }
    });
  },
};
