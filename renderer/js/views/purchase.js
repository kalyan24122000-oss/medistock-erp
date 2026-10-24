// renderer/js/views/purchase.js
// Purchase Invoicing & Stock Ingestion with Batch Creation

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.purchase = {
  purchaseDraft: {
    supplierId: '',
    supplierInvoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    isPaid: false,
    items: [],
  },

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📦 Purchase Invoices & Stock Inward</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-toggle-new-purchase">+ Enter Supplier Bill</button>
            <button class="btn btn-outline btn-sm" id="btn-export-purch-excel">Export to Excel</button>
          </div>
        </div>

        <!-- Form for New Purchase Invoice -->
        <div id="new-purchase-card" class="card" style="display: none; background: #f8fafc; border: 1px solid var(--border); margin-bottom: 20px;">
          <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin-bottom: 12px;">New Purchase Entry (Batch Ingestion)</h4>

          <div class="form-grid" style="margin-bottom: 14px;">
            <div class="form-group">
              <label class="form-label">Supplier:</label>
              <select id="p-supplier" class="form-control">
                <option value="">-- Select Supplier --</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier Invoice / Bill No:</label>
              <input type="text" id="p-sup-bill" class="form-control" placeholder="e.g. GST/2026/8941">
            </div>
            <div class="form-group">
              <label class="form-label">Invoice Date:</label>
              <input type="date" id="p-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Status:</label>
              <select id="p-paid" class="form-control">
                <option value="false">Credit / Unpaid (Add to Supplier Payable)</option>
                <option value="true">Paid Immediately (Cash/Bank)</option>
              </select>
            </div>
          </div>

          <!-- Add Item Row -->
          <div style="background: #fff; padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 14px;">
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px;">Add Medicine Batch Item:</div>
            <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto; align-items: flex-end; gap: 8px;">
              <div>
                <label class="form-label">Medicine:</label>
                <select id="p-item-prod" class="form-control">
                  <option value="">-- Choose Medicine --</option>
                </select>
              </div>
              <div>
                <label class="form-label">Batch No:</label>
                <input type="text" id="p-item-batch" class="form-control" placeholder="BN-26A">
              </div>
              <div>
                <label class="form-label">Expiry (YYYY-MM):</label>
                <input type="month" id="p-item-exp" class="form-control">
              </div>
              <div>
                <label class="form-label">Qty:</label>
                <input type="number" id="p-item-qty" class="form-control" min="1" value="10">
              </div>
              <div>
                <label class="form-label">Free Qty:</label>
                <input type="number" id="p-item-free" class="form-control" min="0" value="0">
              </div>
              <div>
                <label class="form-label">Cost Rate (₹):</label>
                <input type="number" id="p-item-rate" class="form-control" step="0.5" placeholder="Cost">
              </div>
              <div>
                <label class="form-label">MRP (₹):</label>
                <input type="number" id="p-item-mrp" class="form-control" step="0.5" placeholder="MRP">
              </div>
              <div>
                <label class="form-label">Disc %:</label>
                <input type="number" id="p-item-disc" class="form-control" min="0" max="100" value="0">
              </div>
              <div>
                <button class="btn btn-primary" id="btn-add-p-item" style="height: 32px;">+ Add</button>
              </div>
            </div>
          </div>

          <!-- Items Grid in Entry Form -->
          <div class="table-container" style="margin-bottom: 12px;">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Free</th>
                  <th class="text-right">Cost Rate</th>
                  <th class="text-right">MRP</th>
                  <th class="text-right">Disc %</th>
                  <th class="text-right">Taxable</th>
                  <th class="text-right">Line Total</th>
                  <th class="text-center">Del</th>
                </tr>
              </thead>
              <tbody id="p-draft-tbody">
                <tr><td colspan="11" class="text-center">No items added to purchase bill yet.</td></tr>
              </tbody>
            </table>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border);">
            <div style="font-size: 13px; font-weight: 700;">
              Total Taxable: <span id="p-draft-taxable">₹ 0.00</span> | Tax (12%): <span id="p-draft-tax">₹ 0.00</span> | Grand Total: <span id="p-draft-grand" style="color: #0284c7; font-size: 16px;">₹ 0.00</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-success" id="btn-submit-purchase">Save & Post Purchase Bill</button>
              <button class="btn btn-secondary" id="btn-cancel-purchase">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Past Invoices Listing -->
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Supplier Bill No</th>
                <th>Date</th>
                <th>Supplier Name</th>
                <th class="text-right">Items</th>
                <th class="text-right">Total Qty</th>
                <th class="text-right">Taxable</th>
                <th class="text-right">Tax</th>
                <th class="text-right">Grand Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="purch-list-tbody">
              <tr><td colspan="10" class="text-center">Loading purchase invoices...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindPurchaseEvents();
    this.loadPurchaseInvoices();
  },

  async bindPurchaseEvents() {
    const toggleBtn = document.getElementById('btn-toggle-new-purchase');
    const formCard = document.getElementById('new-purchase-card');
    const cancelBtn = document.getElementById('btn-cancel-purchase');

    toggleBtn.addEventListener('click', () => {
      formCard.style.display = formCard.style.display === 'none' ? 'block' : 'none';
      if (formCard.style.display === 'block') {
        this.populateSupplierDropdown();
        this.populateMedicineDropdown();
      }
    });

    cancelBtn.addEventListener('click', () => {
      formCard.style.display = 'none';
      this.purchaseDraft.items = [];
      this.renderDraftItems();
    });

    // Handle medicine selection to autofill default rate & MRP
    const prodSelect = document.getElementById('p-item-prod');
    prodSelect.addEventListener('change', async (e) => {
      const pId = Number(e.target.value);
      if (pId) {
        const prod = await window.api.medicines.getById(pId);
        if (prod) {
          document.getElementById('p-item-rate').value = (prod.purchase_rate / 100).toFixed(2);
          document.getElementById('p-item-mrp').value = (prod.mrp / 100).toFixed(2);
        }
      }
    });

    // Add item button
    document.getElementById('btn-add-p-item').addEventListener('click', () => {
      const prodId = Number(prodSelect.value);
      if (!prodId) {
        MediStock.toast('Please select a medicine', 'warning');
        return;
      }
      const prodName = prodSelect.options[prodSelect.selectedIndex].text;
      const batchNum = document.getElementById('p-item-batch').value.trim().toUpperCase();
      if (!batchNum) {
        MediStock.toast('Please enter batch number', 'warning');
        return;
      }
      const expVal = document.getElementById('p-item-exp').value;
      if (!expVal) {
        MediStock.toast('Please select expiry month/year', 'warning');
        return;
      }
      const expiryDate = `${expVal}-28`; // Standardize to month-end

      const qty = Number(document.getElementById('p-item-qty').value) || 1;
      const freeQty = Number(document.getElementById('p-item-free').value) || 0;
      const rate = Math.round(Number(document.getElementById('p-item-rate').value) * 100);
      const mrp = Math.round(Number(document.getElementById('p-item-mrp').value) * 100);
      const disc = Number(document.getElementById('p-item-disc').value) || 0;

      const taxable = Math.round(qty * rate * (1 - disc / 100));
      const lineTax = Math.round((taxable * 12) / 100);
      const lineTotal = taxable + lineTax;

      this.purchaseDraft.items.push({
        productId: prodId,
        brandName: prodName,
        batchNumber: batchNum,
        expiryDate,
        quantity: qty,
        freeQty,
        purchaseRate: rate,
        mrp,
        sellingPrice: mrp,
        discountPercent: disc,
        taxableAmount: taxable,
        taxRate: 1200,
        lineTotal,
      });

      this.renderDraftItems();
      document.getElementById('p-item-batch').value = '';
    });

    // Submit purchase invoice
    document.getElementById('btn-submit-purchase').addEventListener('click', async () => {
      const supId = Number(document.getElementById('p-supplier').value);
      if (!supId) {
        MediStock.toast('Please select supplier', 'warning');
        return;
      }
      if (this.purchaseDraft.items.length === 0) {
        MediStock.toast('Please add at least one item to purchase bill', 'warning');
        return;
      }

      const supBill = document.getElementById('p-sup-bill').value.trim();
      const invDate = document.getElementById('p-date').value;
      const isPaid = document.getElementById('p-paid').value === 'true';

      try {
        const payload = {
          supplierId: supId,
          supplierInvoiceNo: supBill,
          invoiceDate: invDate,
          isPaid,
          items: this.purchaseDraft.items,
          userId: MediStock.currentUser ? MediStock.currentUser.id : null,
        };

        const res = await window.api.purchase.createInvoice(payload);
        if (res.success) {
          MediStock.toast(`Purchase Invoice ${res.invoiceNumber} posted! Grand Total: ${MediStock.formatRupees(res.grandTotal)}`, 'success');
          formCard.style.display = 'none';
          this.purchaseDraft.items = [];
          this.renderDraftItems();
          this.loadPurchaseInvoices();
        }
      } catch (err) {
        MediStock.toast(`Purchase Entry Error: ${err.message}`, 'error');
      }
    });
  },

  renderDraftItems() {
    const tbody = document.getElementById('p-draft-tbody');
    if (!tbody) return;

    if (this.purchaseDraft.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center">No items added to purchase bill yet.</td></tr>`;
      document.getElementById('p-draft-taxable').textContent = '₹ 0.00';
      document.getElementById('p-draft-tax').textContent = '₹ 0.00';
      document.getElementById('p-draft-grand').textContent = '₹ 0.00';
      return;
    }

    let totTaxable = 0;
    let totTax = 0;
    let totGrand = 0;

    tbody.innerHTML = this.purchaseDraft.items
      .map((it, idx) => {
        totTaxable += it.taxableAmount;
        const lineTax = it.lineTotal - it.taxableAmount;
        totTax += lineTax;
        totGrand += it.lineTotal;

        return `
        <tr>
          <td><strong>${it.brandName}</strong></td>
          <td><span class="font-mono">${it.batchNumber}</span></td>
          <td>${it.expiryDate}</td>
          <td class="text-right">${it.quantity}</td>
          <td class="text-right">${it.freeQty}</td>
          <td class="text-right">${MediStock.formatRupees(it.purchaseRate)}</td>
          <td class="text-right">${MediStock.formatRupees(it.mrp)}</td>
          <td class="text-right">${it.discountPercent}%</td>
          <td class="text-right font-mono">${MediStock.formatRupees(it.taxableAmount)}</td>
          <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(it.lineTotal)}</td>
          <td class="text-center">
            <button class="btn-delete-row" onclick="window.MediStockViews.purchase.removeDraftItem(${idx})">&times;</button>
          </td>
        </tr>
      `;
      })
      .join('');

    const roundedGrand = Math.round(totGrand / 100) * 100;
    document.getElementById('p-draft-taxable').textContent = MediStock.formatRupees(totTaxable);
    document.getElementById('p-draft-tax').textContent = MediStock.formatRupees(totTax);
    document.getElementById('p-draft-grand').textContent = MediStock.formatRupees(roundedGrand);
  },

  removeDraftItem(idx) {
    this.purchaseDraft.items.splice(idx, 1);
    this.renderDraftItems();
  },

  async populateSupplierDropdown() {
    const suppliers = await window.api.parties.listSuppliers();
    const select = document.getElementById('p-supplier');
    if (select) {
      select.innerHTML = '<option value="">-- Select Supplier --</option>' +
        suppliers.map((s) => `<option value="${s.id}">${s.name} (GSTIN: ${s.gstin || 'N/A'})</option>`).join('');
    }
  },

  async populateMedicineDropdown() {
    const medicines = await window.api.medicines.search('', { limit: 100 });
    const select = document.getElementById('p-item-prod');
    if (select) {
      select.innerHTML = '<option value="">-- Choose Medicine --</option>' +
        medicines.map((m) => `<option value="${m.id}">${m.brand_name} (${m.sale_unit})</option>`).join('');
    }
  },

  async loadPurchaseInvoices() {
    const res = await window.api.purchase.listInvoices({ limit: 50 });
    const tbody = document.getElementById('purch-list-tbody');
    if (!tbody) return;

    if (!res.rows || res.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 24px; color: var(--text-muted);">No purchase records recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.rows
      .map(
        (p) => `
      <tr>
        <td class="font-mono"><strong>${p.invoice_number}</strong></td>
        <td>${p.supplier_invoice_no || 'Direct'}</td>
        <td>${p.invoice_date}</td>
        <td><strong>${p.supplier_name}</strong></td>
        <td class="text-right">${p.total_items}</td>
        <td class="text-right">${p.total_qty}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(p.taxable_amount)}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(p.total_tax)}</td>
        <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(p.grand_total)}</td>
        <td><span class="badge ${p.payment_status === 'PAID' ? 'success' : 'warning'}">${p.payment_status}</span></td>
      </tr>
    `
      )
      .join('');
  },
};
