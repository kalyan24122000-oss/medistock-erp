// renderer/js/views/billing.js
// High-Speed Keyboard-Driven Retail Pharmacy POS Billing Engine

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.billing = {
  // Current draft bill state
  bill: {
    customer: { id: null, name: 'Counter Cash / Walk-in Customer', phone: '' },
    doctorName: '',
    doctorRegNo: '',
    paymentMode: 'CASH',
    invoiceDiscountPercent: 0,
    invoiceDiscountAmount: 0,
    notes: '',
    items: [],
  },

  heldBills: [],

  render(container) {
    this.renderLayout(container);
    this.bindEvents(container);
    this.updateTotals();

    // Auto focus search input on view load
    setTimeout(() => {
      const searchInput = document.getElementById('pos-search-input');
      if (searchInput) searchInput.focus();
    }, 100);
  },

  renderLayout(container) {
    container.innerHTML = `
      <div class="billing-layout">
        <!-- Billing Header Bar -->
        <div class="billing-header-card">
          <div class="billing-header-fields">
            <!-- Customer Name Direct Entry with Live Auto-Search & Directory Addon -->
            <div class="billing-input-pill">
              <span class="pill-label">Customer Name (F3):</span>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="text" id="pos-customer-name" class="billing-field-input"
                       placeholder="Customer Name (e.g. Walk-in)"
                       value="${this.bill.customer.name}"
                       autocomplete="off" style="width: 190px; padding-right: 26px;">
                <button type="button" class="btn-input-addon" id="btn-browse-customer" title="Open Customer Directory (F3)">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </button>
                <div id="pos-customer-dropdown" class="customer-dropdown-menu" style="display: none;"></div>
              </div>
            </div>

            <!-- Customer Mobile / Phone Direct Entry -->
            <div class="billing-input-pill">
              <span class="pill-label">Mobile No:</span>
              <input type="tel" id="pos-customer-phone" class="billing-field-input"
                     placeholder="10-digit Phone"
                     value="${this.bill.customer.phone || ''}"
                     maxlength="15" style="width: 125px;">
              <span id="pos-cust-status" class="cust-match-badge" style="display: none;"></span>
            </div>

            <!-- Payment Mode -->
            <div class="billing-input-pill">
              <span class="pill-label">Payment:</span>
              <select id="pos-payment-mode" class="billing-field-input" style="font-weight: 700; cursor: pointer;">
                <option value="CASH" ${this.bill.paymentMode === 'CASH' ? 'selected' : ''}>💵 Cash</option>
                <option value="UPI" ${this.bill.paymentMode === 'UPI' ? 'selected' : ''}>📱 UPI / QR</option>
                <option value="CARD" ${this.bill.paymentMode === 'CARD' ? 'selected' : ''}>💳 Card</option>
                <option value="BANK_TRANSFER" ${this.bill.paymentMode === 'BANK_TRANSFER' ? 'selected' : ''}>🏦 Bank</option>
                <option value="CREDIT" ${this.bill.paymentMode === 'CREDIT' ? 'selected' : ''}>📋 Credit (Udhar)</option>
              </select>
            </div>

            <!-- Optional Rx Doctor details (collapsible) -->
            <div class="billing-input-pill" id="rx-doctor-pill" style="display: none;">
              <span class="pill-label">Dr. Name:</span>
              <input type="text" id="pos-doctor-name" class="billing-field-input" placeholder="Doctor Name" value="${this.bill.doctorName}" style="width: 120px;">
              <span class="pill-label" style="margin-left: 4px;">MCI:</span>
              <input type="text" id="pos-doctor-reg" class="billing-field-input" placeholder="Reg No" value="${this.bill.doctorRegNo}" style="width: 75px;">
            </div>

            <button type="button" class="btn btn-outline btn-xs" id="btn-toggle-rx" title="Click to show/hide Doctor & Prescription details">
              + Rx Doctor
            </button>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-hold-bill" title="Hold bill in memory (F8)">Hold (F8)</button>
            <button class="btn btn-outline btn-sm" id="btn-resume-bill" title="Resume held bill (F9)">Resume (F9) <span id="held-count-badge" class="badge info">${this.heldBills.length}</span></button>
            <button class="btn btn-secondary btn-sm" id="btn-clear-bill" title="Clear current bill">Clear</button>
          </div>
        </div>

        <!-- Medicine Search Input -->
        <div class="billing-search-row">
          <div class="search-input-wrapper">
            <input type="text" id="pos-search-input" class="billing-search-input"
                   placeholder="Type Medicine Brand Name, Salt, Generic, or Scan Barcode (Press F2 or Insert)..." autocomplete="off">
            <div class="search-barcode-icon">
              <span>SCAN / SEARCH</span>
            </div>
            <div id="pos-search-results" class="search-results-dropdown" style="display: none;"></div>
          </div>
        </div>

        <!-- Billing Items Grid -->
        <div class="billing-grid-container">
          <table class="billing-table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Medicine Description</th>
                <th style="width: 80px;">Batch</th>
                <th style="width: 65px;">Expiry</th>
                <th style="width: 55px;" class="text-center" title="Tablets per Strip">Pack</th>
                <th style="width: 60px;" class="text-right" title="Full Strips quantity">Strips</th>
                <th style="width: 68px;" class="text-right" title="Custom number of loose tablets (Loose Qty)">Loose Tabs</th>
                <th style="width: 75px;" class="text-right" title="Unit Selling Price per tablet (USP)">USP (₹/Tab)</th>
                <th style="width: 75px;" class="text-right" title="Rate per Strip">Strip Rate</th>
                <th style="width: 55px;" class="text-right">Disc %</th>
                <th style="width: 70px;" class="text-right">Taxable</th>
                <th style="width: 45px;" class="text-center">GST</th>
                <th style="width: 85px;" class="text-right">Line Total</th>
                <th style="width: 32px;" class="text-center">Del</th>
              </tr>
            </thead>
            <tbody id="pos-items-tbody">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>

        <!-- Billing Footer / Totals -->
        <div class="billing-footer">
          <div class="billing-summary-pills">
            <div class="summary-pill">
              <span class="summary-pill-label">Total Items</span>
              <span class="summary-pill-val" id="val-total-items">0</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">Total Qty</span>
              <span class="summary-pill-val" id="val-total-qty">0</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">Subtotal</span>
              <span class="summary-pill-val" id="val-subtotal">₹ 0.00</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">Discount</span>
              <span class="summary-pill-val" id="val-discount" style="color: #16a34a;">₹ 0.00</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">Taxable</span>
              <span class="summary-pill-val" id="val-taxable">₹ 0.00</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">CGST + SGST</span>
              <span class="summary-pill-val" id="val-tax">₹ 0.00</span>
            </div>
            <div class="summary-pill">
              <span class="summary-pill-label">Round-Off</span>
              <span class="summary-pill-val" id="val-roundoff">₹ 0.00</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="billing-grand-total-box">
              <div class="grand-total-label">Grand Total</div>
              <div class="grand-total-val" id="val-grand-total">₹ 0.00</div>
            </div>

            <div class="billing-actions">
              <button class="btn btn-success btn-lg" id="btn-save-print" title="Save & Print Bill (F12)">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Save & Print (F12)
              </button>
            </div>
          </div>
        </div>

        <!-- Shortcuts Quick Bar -->
        <div class="shortcuts-bar">
          <div class="shortcut-chip"><kbd>F1</kbd> New Bill</div>
          <div class="shortcut-chip"><kbd>F2</kbd> Search Medicine</div>
          <div class="shortcut-chip"><kbd>F3</kbd> Customer Entry</div>
          <div class="shortcut-chip"><kbd>F4</kbd> Customer Directory</div>
          <div class="shortcut-chip"><kbd>F8</kbd> Hold Bill</div>
          <div class="shortcut-chip"><kbd>F9</kbd> Resume Bill</div>
          <div class="shortcut-chip"><kbd>F10</kbd> Payment Mode</div>
          <div class="shortcut-chip"><kbd>F12</kbd> Save & Print</div>
          <div class="shortcut-chip"><kbd>Esc</kbd> Clear / Close</div>
        </div>
      </div>
    `;
  },

  bindEvents(container) {
    const searchInput = document.getElementById('pos-search-input');
    const searchResults = document.getElementById('pos-search-results');
    const custNameInput = document.getElementById('pos-customer-name');
    const custDropdown = document.getElementById('pos-customer-dropdown');
    const custPhoneInput = document.getElementById('pos-customer-phone');
    const custStatus = document.getElementById('pos-cust-status');
    const doctorInput = document.getElementById('pos-doctor-name');
    const regInput = document.getElementById('pos-doctor-reg');
    const paySelect = document.getElementById('pos-payment-mode');
    const btnToggleRx = document.getElementById('btn-toggle-rx');
    const rxPill = document.getElementById('rx-doctor-pill');

    // Customer Name direct entry & live autocomplete dropdown
    let custSearchTimeout = null;
    custNameInput.addEventListener('input', (e) => {
      const val = e.target.value;
      this.bill.customer.name = val.trim() || 'Counter Cash / Walk-in Customer';
      if (!val.trim()) {
        this.bill.customer.id = null;
        if (custDropdown) custDropdown.style.display = 'none';
        return;
      }
      clearTimeout(custSearchTimeout);
      custSearchTimeout = setTimeout(async () => {
        try {
          const list = await window.api.parties.listCustomers(val.trim());
          if (list && list.length > 0) {
            custDropdown.innerHTML = list.slice(0, 8).map(c => `
              <div class="cust-dropdown-item" data-id="${c.id}" data-name="${c.name.replace(/"/g, '&quot;')}" data-phone="${c.phone || ''}">
                <strong>${c.name}</strong>
                <span>${c.phone || 'No phone'} | Balance: ${MediStock.formatRupees(c.current_balance)}</span>
              </div>
            `).join('');
            custDropdown.style.display = 'block';

            custDropdown.querySelectorAll('.cust-dropdown-item').forEach(item => {
              item.addEventListener('click', () => {
                this.setCustomer(Number(item.dataset.id), item.dataset.name, item.dataset.phone);
                custDropdown.style.display = 'none';
              });
            });
          } else {
            custDropdown.style.display = 'none';
          }
        } catch (err) {
          console.warn('Customer search error:', err);
        }
      }, 150);
    });

    // Customer Phone direct entry & auto-lookup
    let phoneLookupTimeout = null;
    custPhoneInput.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      this.bill.customer.phone = raw;
      if (raw.length >= 10) {
        clearTimeout(phoneLookupTimeout);
        phoneLookupTimeout = setTimeout(async () => {
          try {
            const list = await window.api.parties.listCustomers(raw);
            const match = list.find(c => c.phone === raw || (c.phone && c.phone.endsWith(raw.slice(-10))));
            if (match) {
              this.bill.customer.id = match.id;
              this.bill.customer.name = match.name;
              custNameInput.value = match.name;
              custStatus.textContent = 'Found';
              custStatus.className = 'cust-match-badge found';
              custStatus.style.display = 'inline-block';
              MediStock.toast(`Customer identified: "${match.name}"`, 'info');
            } else {
              custStatus.textContent = 'New Walk-in';
              custStatus.className = 'cust-match-badge new';
              custStatus.style.display = 'inline-block';
              this.bill.customer.id = null;
            }
          } catch (err) {
            console.warn('Phone search error:', err);
          }
        }, 150);
      } else {
        custStatus.style.display = 'none';
      }
    });

    // Close customer dropdown on outside click
    document.addEventListener('click', (e) => {
      if (custDropdown && !custNameInput.contains(e.target) && !custDropdown.contains(e.target)) {
        custDropdown.style.display = 'none';
      }
    });

    // Open full customer selection modal on browse button click
    const btnBrowse = document.getElementById('btn-browse-customer');
    if (btnBrowse) {
      btnBrowse.addEventListener('click', () => this.openCustomerModal());
    }

    // Toggle optional Rx Doctor input fields
    if (btnToggleRx && rxPill) {
      btnToggleRx.addEventListener('click', () => {
        const isHidden = rxPill.style.display === 'none';
        rxPill.style.display = isHidden ? 'flex' : 'none';
        btnToggleRx.textContent = isHidden ? '– Hide Rx' : '+ Rx Doctor';
        if (isHidden) doctorInput.focus();
      });
    }

    doctorInput.addEventListener('input', (e) => { this.bill.doctorName = e.target.value; });
    regInput.addEventListener('input', (e) => { this.bill.doctorRegNo = e.target.value; });
    paySelect.addEventListener('change', (e) => { this.bill.paymentMode = e.target.value; });

    document.getElementById('btn-hold-bill').addEventListener('click', () => this.holdCurrentBill());
    document.getElementById('btn-resume-bill').addEventListener('click', () => this.resumeHeldBill());
    document.getElementById('btn-clear-bill').addEventListener('click', () => this.clearBill());
    document.getElementById('btn-save-print').addEventListener('click', () => this.saveAndPrintInvoice());

    // Search input handler with debounce
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (!q) {
        searchResults.style.display = 'none';
        return;
      }
      searchTimeout = setTimeout(() => this.executeMedicineSearch(q), 150);
    });

    // Keyboard navigation in search input
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchResults.style.display = 'none';
        searchInput.value = '';
      } else if (e.key === 'Enter') {
        // If exact match or first result exists
        const firstItem = searchResults.querySelector('.search-result-item');
        if (firstItem) {
          firstItem.click();
        }
      }
    });

    // Close search on click outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
  },

  async executeMedicineSearch(query) {
    const searchResults = document.getElementById('pos-search-results');
    try {
      const results = await window.api.medicines.search(query, { activeOnly: true, limit: 12 });
      if (!results || results.length === 0) {
        searchResults.innerHTML = `<div style="padding: 12px; color: var(--text-muted); text-align: center;">No medicine found for "${query}"</div>`;
        searchResults.style.display = 'block';
        return;
      }

      searchResults.innerHTML = results
        .map(
          (m, idx) => `
        <div class="search-result-item ${idx === 0 ? 'selected' : ''}" data-id="${m.id}">
          <div class="s-item-main">
            <div class="s-item-brand">
              ${m.brand_name}
              ${m.schedule_type !== 'NONE' ? `<span class="badge purple" style="font-size: 9.5px;">${m.schedule_type}</span>` : ''}
              ${m.rack_shelf ? `<span class="badge neutral" style="font-size: 9.5px;">Rack: ${m.rack_shelf}</span>` : ''}
            </div>
            <div class="s-item-generic">${m.generic_name || m.salt_name || ''}</div>
            <div class="s-item-mfg">${m.manufacturer_name || ''} | Pack: 1 ${m.sale_unit} (${m.conversion_ratio} tabs)</div>
          </div>
          <div class="s-item-pricing">
            <span class="s-item-rate">${MediStock.formatRupees(m.selling_price)}/${m.sale_unit || 'Strip'}</span>
            <span class="s-item-usp">USP: ${MediStock.formatRupees(Math.round(m.selling_price / (m.conversion_ratio || 10)))}/Tab</span>
            <span class="s-item-mrp">MRP ${MediStock.formatRupees(m.mrp)}</span>
            <span class="s-item-stock ${m.total_stock > 10 ? 'badge success' : m.total_stock > 0 ? 'badge warning' : 'badge danger'}">
              Stock: ${m.total_stock} ${m.sale_unit}s (${m.total_stock * (m.conversion_ratio || 10)} Tabs)
            </span>
          </div>
        </div>
      `
        )
        .join('');

      searchResults.style.display = 'block';

      // Bind click handlers to items
      searchResults.querySelectorAll('.search-result-item').forEach((elem) => {
        elem.addEventListener('click', () => {
          const prodId = Number(elem.getAttribute('data-id'));
          this.selectProductForBilling(prodId);
          searchResults.style.display = 'none';
          const searchInput = document.getElementById('pos-search-input');
          if (searchInput) searchInput.value = '';
        });
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  },

  async selectProductForBilling(productId) {
    try {
      const product = await window.api.medicines.getById(productId);
      if (!product) return;

      // Fetch non-expired batches for this product (sorted by FEFO)
      const batches = await window.api.inventory.getBatches(productId, false);

      if (!batches || batches.length === 0) {
        MediStock.toast(`No active stock/batches available for "${product.brand_name}"`, 'warning');
        return;
      }

      // If only 1 batch, add directly. If multiple batches, prompt selection
      if (batches.length === 1) {
        this.addBatchToGrid(product, batches[0]);
      } else {
        this.promptBatchSelectionModal(product, batches);
      }
    } catch (err) {
      MediStock.toast(`Error selecting product: ${err.message}`, 'error');
    }
  },

  promptBatchSelectionModal(product, batches) {
    const bodyHtml = `
      <div>
        <p style="margin-bottom: 10px; font-weight: 600; font-size: 13px;">
          Select Batch for <strong>${product.brand_name}</strong> (Sorted by FEFO):
        </p>
        <table class="batch-select-table">
          <thead>
            <tr>
              <th>Batch No</th>
              <th>Expiry</th>
              <th>Days Left</th>
              <th>MRP</th>
              <th>Selling Rate</th>
              <th>Available Qty</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${batches
              .map(
                (b) => `
              <tr class="batch-row" data-batch-id="${b.id}">
                <td><strong>${b.batch_number}</strong></td>
                <td>${b.expiry_date}</td>
                <td><span class="badge ${b.days_to_expiry <= 60 ? 'warning' : 'success'}">${Math.round(b.days_to_expiry)}d</span></td>
                <td>${MediStock.formatRupees(b.mrp)}</td>
                <td><strong>${MediStock.formatRupees(b.selling_price)}</strong></td>
                <td><span class="badge info">${b.available_qty} ${product.sale_unit}</span></td>
                <td><button class="btn btn-primary btn-sm btn-pick-batch" data-batch-id="${b.id}">Select</button></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    MediStock.showModal('FEFO Batch Selection', bodyHtml, '', 'lg');

    document.querySelectorAll('.btn-pick-batch, .batch-row').forEach((el) => {
      el.addEventListener('click', (e) => {
        const bId = Number(el.getAttribute('data-batch-id') || el.closest('.batch-row').getAttribute('data-batch-id'));
        const chosen = batches.find((x) => x.id === bId);
        if (chosen) {
          MediStock.closeModal();
          this.addBatchToGrid(product, chosen);
        }
      });
    });
  },

  addBatchToGrid(product, batch) {
    const conv = Number(product.conversion_ratio) || 10;
    const stripRate = Number(batch.selling_price) || 0;
    const initialUsp = Math.round(stripRate / conv);

    // Check if product & batch already in grid
    const existingIndex = this.bill.items.findIndex((x) => x.batchId === batch.id);
    if (existingIndex >= 0) {
      const it = this.bill.items[existingIndex];
      const curEffective = (it.strips || 0) + ((it.looseTabs || 0) / conv);
      if (curEffective + 1 <= batch.available_qty) {
        it.strips = (it.strips || 0) + 1;
        it.quantity = it.strips + ((it.looseTabs || 0) / conv);
        MediStock.toast(`Incremented strips for ${product.brand_name}`, 'info');
      } else {
        MediStock.toast(`Cannot exceed available batch stock (${batch.available_qty} strips)`, 'warning');
      }
    } else {
      // Add new line item
      this.bill.items.push({
        productId: product.id,
        brandName: product.brand_name,
        scheduleType: product.schedule_type,
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
        unit: product.sale_unit || 'Strip',
        conversionRatio: conv,
        isLooseAllowed: product.is_loose_allowed !== 0,
        availableQty: batch.available_qty,
        strips: 1, // Full strips
        looseTabs: 0, // Custom loose tablets
        quantity: 1, // Total effective strips
        mrp: batch.mrp,
        sellingRate: stripRate, // Price per strip (paise)
        usp: initialUsp, // Unit Selling Price per tablet (paise)
        discountPercent: 0,
        taxRate: product.tax_rate || 1200,
      });

      // If item is Schedule H / H1, remind operator to note Doctor details
      if (product.schedule_type === 'SCHEDULE_H' || product.schedule_type === 'SCHEDULE_H1') {
        MediStock.toast(`Notice: "${product.brand_name}" is ${product.schedule_type}. Doctor details recorded for statutory register.`, 'warning');
        const docInput = document.getElementById('pos-doctor-name');
        if (docInput && !docInput.value) docInput.focus();
      }
    }

    this.renderItemsTable();
    this.updateTotals();
  },

  renderItemsTable() {
    const tbody = document.getElementById('pos-items-tbody');
    if (!tbody) return;

    if (this.bill.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" class="text-center" style="padding: 36px; color: var(--text-muted);">
            No medicines added yet. Type medicine name or scan barcode above to start bill!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.bill.items
      .map((it, idx) => {
        const calc = this.calculateLineLocally(it);
        const conv = Number(it.conversionRatio) || 10;
        const strips = it.strips !== undefined ? it.strips : it.quantity;
        const looseTabs = it.looseTabs || 0;

        return `
        <tr data-index="${idx}">
          <td class="text-center">${idx + 1}</td>
          <td>
            <strong>${it.brandName}</strong>
            ${it.scheduleType !== 'NONE' ? `<span class="badge purple" style="font-size: 9px; margin-left: 4px;">${it.scheduleType}</span>` : ''}
          </td>
          <td><span class="font-mono">${it.batchNumber}</span></td>
          <td style="font-size: 11px;">${it.expiryDate}</td>
          <td class="text-center"><span class="badge neutral" style="font-size: 10px;">${conv} T</span></td>
          <td class="text-right">
            <input type="number" min="0" step="1" max="${it.availableQty}" value="${strips}"
                   class="grid-qty-input pos-item-strips" data-index="${idx}" title="Full Strips Quantity">
          </td>
          <td class="text-right">
            <input type="number" min="0" step="1" max="${Math.floor(it.availableQty * conv)}" value="${looseTabs}"
                   class="grid-tabs-input pos-item-tabs" data-index="${idx}" placeholder="0" title="Custom Number of Loose Tablets">
          </td>
          <td class="text-right">
            <input type="number" step="0.05" min="0" value="${(calc.usp / 100).toFixed(2)}"
                   class="grid-usp-input pos-item-usp" data-index="${idx}" title="Unit Selling Price per tablet (USP)">
          </td>
          <td class="text-right">
            <input type="number" value="${(it.sellingRate / 100).toFixed(2)}" step="0.5"
                   class="grid-rate-input pos-item-rate" data-index="${idx}" title="Selling Rate per Strip">
          </td>
          <td class="text-right">
            <input type="number" min="0" max="100" value="${it.discountPercent}"
                   class="grid-disc-input pos-item-disc" data-index="${idx}">
          </td>
          <td class="text-right font-mono">${MediStock.formatRupees(calc.taxable)}</td>
          <td class="text-center font-mono">${(it.taxRate / 100).toFixed(0)}%</td>
          <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">${MediStock.formatRupees(calc.lineTotal)}</td>
          <td class="text-center">
            <button class="btn-delete-row" data-index="${idx}" title="Remove Item">&times;</button>
          </td>
        </tr>
      `;
      })
      .join('');

    // Attach row events
    // 1. Strips input
    tbody.querySelectorAll('.pos-item-strips').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const item = this.bill.items[idx];
        const val = Math.max(0, parseInt(e.target.value) || 0);
        item.strips = val;
        item.quantity = val + ((item.looseTabs || 0) / (item.conversionRatio || 10));

        if (item.strips === 0 && (!item.looseTabs || item.looseTabs === 0)) {
          this.bill.items.splice(idx, 1);
        } else if (item.quantity > item.availableQty) {
          MediStock.toast(`Total quantity exceeds batch stock (${item.availableQty} strips)`, 'warning');
        }
        this.renderItemsTable();
        this.updateTotals();
      });
    });

    // 2. Custom Loose Tablets input
    tbody.querySelectorAll('.pos-item-tabs').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const item = this.bill.items[idx];
        const tabsVal = Math.max(0, parseInt(e.target.value) || 0);
        item.looseTabs = tabsVal;
        item.quantity = (item.strips || 0) + (tabsVal / (item.conversionRatio || 10));

        if ((item.strips === 0 || !item.strips) && tabsVal === 0) {
          this.bill.items.splice(idx, 1);
        } else if (item.quantity > item.availableQty) {
          MediStock.toast(`Total quantity exceeds batch stock (${item.availableQty} strips)`, 'warning');
        }
        this.renderItemsTable();
        this.updateTotals();
      });
    });

    // 3. USP (Unit Selling Price per tablet) input
    tbody.querySelectorAll('.pos-item-usp').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const item = this.bill.items[idx];
        const uspVal = Math.round(Number(e.target.value) * 100);
        item.usp = uspVal;
        item.sellingRate = Math.round(uspVal * (item.conversionRatio || 10));
        this.renderItemsTable();
        this.updateTotals();
      });
    });

    // 4. Strip Rate input
    tbody.querySelectorAll('.pos-item-rate').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const item = this.bill.items[idx];
        const rateVal = Math.round(Number(e.target.value) * 100);
        item.sellingRate = rateVal;
        item.usp = Math.round(rateVal / (item.conversionRatio || 10));
        this.renderItemsTable();
        this.updateTotals();
      });
    });

    // 5. Discount % input
    tbody.querySelectorAll('.pos-item-disc').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const val = Math.max(0, Math.min(100, Number(e.target.value)));
        this.bill.items[idx].discountPercent = val;
        this.renderItemsTable();
        this.updateTotals();
      });
    });

    // 6. Delete row
    tbody.querySelectorAll('.btn-delete-row').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number(btn.getAttribute('data-index'));
        this.bill.items.splice(idx, 1);
        this.renderItemsTable();
        this.updateTotals();
      });
    });
  },

  calculateLineLocally(item) {
    const conv = Math.max(1, Number(item.conversionRatio) || 10);
    const strips = Number(item.strips !== undefined ? item.strips : item.quantity) || 0;
    const looseTabs = Number(item.looseTabs) || 0;
    const stripRate = Number(item.sellingRate) || 0;
    const usp = Number(item.usp) || Math.round(stripRate / conv);
    const disc = Number(item.discountPercent) || 0;
    const taxRate = Number(item.taxRate) || 1200;

    // Gross calculation: (strips * stripRate) + (looseTabs * usp)
    let gross;
    if (looseTabs > 0 && strips === 0) {
      gross = Math.round(looseTabs * usp);
    } else if (looseTabs > 0 && strips > 0) {
      gross = Math.round((strips * stripRate) + (looseTabs * usp));
    } else {
      gross = Math.round(strips * stripRate);
    }

    const lineDiscount = Math.round((gross * disc) / 100);
    const taxable = Math.max(0, gross - lineDiscount);
    const halfTax = taxRate / 2;
    const cgst = Math.round((taxable * halfTax) / 10000);
    const sgst = Math.round((taxable * halfTax) / 10000);
    const lineTotal = taxable + cgst + sgst;
    const effectiveQty = strips + (looseTabs / conv);

    return {
      gross,
      lineDiscount,
      taxable,
      cgst,
      sgst,
      totalTax: cgst + sgst,
      lineTotal,
      effectiveQty,
      usp,
      stripRate,
    };
  },

  updateTotals() {
    let totalItems = this.bill.items.length;
    let totalQty = 0;
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let tax = 0;

    for (const it of this.bill.items) {
      const c = this.calculateLineLocally(it);
      totalQty += c.effectiveQty;
      subtotal += c.gross;
      discount += c.lineDiscount;
      taxable += c.taxable;
      tax += c.totalTax;
    }

    const unrounded = taxable + tax;
    const grandTotal = Math.round(unrounded / 100) * 100;
    const roundoff = grandTotal - unrounded;

    document.getElementById('val-total-items').textContent = totalItems;
    document.getElementById('val-total-qty').textContent = Number.isInteger(totalQty) ? totalQty : totalQty.toFixed(2);
    document.getElementById('val-subtotal').textContent = MediStock.formatRupees(subtotal);
    document.getElementById('val-discount').textContent = MediStock.formatRupees(discount);
    document.getElementById('val-taxable').textContent = MediStock.formatRupees(taxable);
    document.getElementById('val-tax').textContent = MediStock.formatRupees(tax);
    document.getElementById('val-roundoff').textContent = MediStock.formatRupees(roundoff);
    document.getElementById('val-grand-total').textContent = MediStock.formatRupees(grandTotal);

    this.bill.computed = { totalItems, totalQty, subtotal, discount, taxable, tax, roundoff, grandTotal };
  },

  async saveAndPrintInvoice() {
    if (this.bill.items.length === 0) {
      MediStock.toast('Cannot save empty invoice! Please add medicines first.', 'warning');
      return;
    }

    try {
      const preparedItems = this.bill.items.map((it) => {
        const c = this.calculateLineLocally(it);
        const conv = Number(it.conversionRatio) || 10;
        const strips = Number(it.strips !== undefined ? it.strips : it.quantity) || 0;
        const looseTabs = Number(it.looseTabs) || 0;

        let unitDesc = it.unit || 'Strip';
        if (looseTabs > 0 && strips === 0) {
          unitDesc = `${looseTabs} Tab${looseTabs > 1 ? 's' : ''}`;
        } else if (looseTabs > 0 && strips > 0) {
          unitDesc = `${strips} Strip + ${looseTabs}T`;
        }

        return {
          productId: it.productId,
          brandName: it.brandName,
          scheduleType: it.scheduleType,
          batchId: it.batchId,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          unit: unitDesc,
          conversionRatio: conv,
          strips,
          looseTabs,
          usp: c.usp,
          quantity: c.effectiveQty,
          mrp: it.mrp,
          sellingRate: it.sellingRate,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
          taxableAmount: c.taxable,
          cgstAmount: c.cgst,
          sgstAmount: c.sgst,
          igstAmount: 0,
          lineTotal: c.lineTotal,
        };
      });

      const payload = {
        invoiceType: 'RETAIL',
        customerId: this.bill.customer.id,
        customerName: this.bill.customer.name,
        customerPhone: this.bill.customer.phone,
        doctorName: this.bill.doctorName,
        doctorRegNo: this.bill.doctorRegNo,
        paymentMode: this.bill.paymentMode,
        items: preparedItems,
        invoiceDiscountPercent: this.bill.invoiceDiscountPercent,
        invoiceDiscountAmount: this.bill.invoiceDiscountAmount,
        notes: this.bill.notes,
        userId: MediStock.currentUser ? MediStock.currentUser.id : null,
      };

      const result = await window.api.sales.createInvoice(payload);

      if (result.success) {
        MediStock.toast(`Invoice ${result.invoiceNumber} posted successfully! Total: ${MediStock.formatRupees(result.grandTotal)}`, 'success');

        // Open Print Preview Modal with 80mm Thermal & A4 options
        this.openPrintPreviewModal(result.invoiceId);

        // Reset Bill
        this.clearBill();
      }
    } catch (err) {
      MediStock.toast(`Billing Failed: ${err.message}`, 'error');
    }
  },

  render80mmReceiptHtml(inv) {
    const company = inv.company || {};
    return `
      <div class="thermal-receipt">
        <div class="receipt-header">
          <div class="store-name">${company.trade_name || company.name || 'APEX PHARMACY'}</div>
          <div class="store-meta">${company.address_line1 || 'Main Market Road'}, ${company.city || 'Mumbai'}</div>
          <div class="store-meta">Ph: ${company.phone || '9876543210'} | DL: ${company.drug_license_no_1 || 'MH-WZ-123456'}</div>
          <div class="store-meta">GSTIN: ${company.gstin || '27AABCU9603R1ZM'}</div>
        </div>

        <div class="bill-meta">
          <div class="bill-meta-row"><span><strong>Invoice:</strong> ${inv.invoice_number}</span><span><strong>Date:</strong> ${inv.invoice_date}</span></div>
          <div class="bill-meta-row"><span><strong>Customer:</strong> ${inv.customer_name}</span><span><strong>Ph:</strong> ${inv.customer_phone || 'Walk-in'}</span></div>
          ${inv.doctor_name ? `<div class="bill-meta-row"><span><strong>Doctor:</strong> ${inv.doctor_name}</span><span>${inv.doctor_reg_no ? '[' + inv.doctor_reg_no + ']' : ''}</span></div>` : ''}
          <div class="bill-meta-row"><span><strong>Payment:</strong> ${inv.payment_mode}</span><span><strong>Time:</strong> ${inv.invoice_time || 'POS'}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 38%;">Item</th>
              <th style="width: 18%; text-align: center;">Batch</th>
              <th style="width: 14%; text-align: center;">Exp</th>
              <th style="width: 12%; text-align: right;">Qty</th>
              <th style="width: 18%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map(it => `
              <tr>
                <td><strong>${it.brand_name}</strong><br><span style="font-size: 8.5px; color: #555;">${it.generic_name || ''}</span></td>
                <td style="text-align: center;">${it.batch_number}</td>
                <td style="text-align: center;">${(it.expiry_date || '').slice(2, 7)}</td>
                <td style="text-align: right;">${it.unit || it.quantity}</td>
                <td style="text-align: right;">${(it.line_total / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-box">
          <div class="total-line"><span>Gross Subtotal:</span><span>${MediStock.formatRupees(inv.subtotal)}</span></div>
          ${inv.total_discount > 0 ? `<div class="total-line"><span>Discount Saved:</span><span>-${MediStock.formatRupees(inv.total_discount)}</span></div>` : ''}
          <div class="total-line"><span>GST (CGST+SGST):</span><span>${MediStock.formatRupees(inv.total_tax)}</span></div>
          ${inv.round_off !== 0 ? `<div class="total-line"><span>Round-off:</span><span>${(inv.round_off / 100).toFixed(2)}</span></div>` : ''}
          <div class="grand-total-line"><span>NET PAYABLE:</span><span>${MediStock.formatRupees(inv.grand_total)}</span></div>
        </div>

        <div class="receipt-footer">
          <div>*** GET WELL SOON ***</div>
          <div style="margin-top: 3px;">Thank you for your visit!</div>
          <div style="font-size: 8.5px; margin-top: 4px; color: #555;">Pharmacist Sign: _________________</div>
        </div>
      </div>
    `;
  },

  render58mmReceiptHtml(inv) {
    const company = inv.company || {};
    return `
      <div class="thermal-58mm">
        <div class="store-name">${company.trade_name || company.name || 'APEX PHARMACY'}</div>
        <div class="store-meta">
          ${company.city || ''} | Ph: ${company.phone || ''}<br>
          DL: ${company.drug_license_no_1 || ''}
        </div>
        <div class="bill-meta">
          <div>Inv: ${inv.invoice_number} | ${inv.invoice_date}</div>
          <div>Cust: ${inv.customer_name}</div>
          <div>Mode: ${inv.payment_mode}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45%;">Item</th>
              <th style="width: 25%; text-align: right;">Qty</th>
              <th style="width: 30%; text-align: right;">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map(it => `
              <tr>
                <td>${it.brand_name}</td>
                <td style="text-align: right;">${it.unit || it.quantity}</td>
                <td style="text-align: right;">${(it.line_total / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals-box">
          <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>${(inv.subtotal / 100).toFixed(2)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>GST:</span><span>${(inv.total_tax / 100).toFixed(2)}</span></div>
          <div class="grand-total-line"><span>TOTAL:</span><span>${MediStock.formatRupees(inv.grand_total)}</span></div>
        </div>
        <div class="receipt-footer">
          <div>* GET WELL SOON *</div>
          <div>Visit Again</div>
        </div>
      </div>
    `;
  },

  renderA4InvoiceHtml(inv) {
    const company = inv.company || {};
    const words = MediStock.numberToWords(Math.round(inv.grand_total / 100));

    // Group HSN tax breakdown
    const hsnMap = {};
    inv.items.forEach(it => {
      const hsn = it.hsn_code || '3004';
      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, totalTax: 0, taxRate: it.tax_rate || 1200 };
      }
      hsnMap[hsn].taxable += (it.taxable_amount || 0);
      hsnMap[hsn].cgst += (it.cgst_amount || 0);
      hsnMap[hsn].sgst += (it.sgst_amount || 0);
      hsnMap[hsn].totalTax += ((it.cgst_amount || 0) + (it.sgst_amount || 0));
    });
    const hsnRows = Object.values(hsnMap);

    return `
      <div class="a4-invoice">
        <div class="invoice-banner">TAX INVOICE — ORIGINAL FOR RECIPIENT</div>

        <div class="header-grid">
          <div class="company-block">
            <h2>${company.trade_name || company.name || 'APEX PHARMACY'}</h2>
            <p><strong>Legal Name:</strong> ${company.name || 'Apex Pharmacy & Healthcare Pvt Ltd'}</p>
            <p><strong>Address:</strong> ${company.address_line1 || 'Plot 42, Health City'}, ${company.city || 'Mumbai'}, ${company.pincode || '400001'}, ${company.state || 'Maharashtra'}</p>
            <p><strong>Phone:</strong> ${company.phone || '9876543210'} | <strong>Email:</strong> ${company.email || 'billing@apexpharma.com'}</p>
            <p><strong>Drug License No:</strong> 20B: ${company.drug_license_no_1 || 'MH-WZ-123456'} | 21B: ${company.drug_license_no_2 || 'MH-WZ-654321'}</p>
            <p><strong>GSTIN:</strong> ${company.gstin || '27AABCU9603R1ZM'} | <strong>FSSAI:</strong> ${company.fssai_no || '10019022009876'}</p>
          </div>
          <div class="invoice-meta-block">
            <div class="inv-num">INV: ${inv.invoice_number}</div>
            <div><strong>Date:</strong> ${inv.invoice_date}</div>
            <div><strong>Time:</strong> ${inv.invoice_time || '12:00 PM'}</div>
            <div><strong>State:</strong> Maharashtra (Code: 27)</div>
            <div><strong>Payment Mode:</strong> ${inv.payment_mode}</div>
            <div><strong>Cashier:</strong> ${inv.operator_name || 'Rajesh Patel'}</div>
          </div>
        </div>

        <div class="parties-grid">
          <div>
            <h4>Billed To (Customer / Patient)</h4>
            <div><strong>Name:</strong> ${inv.customer_name}</div>
            <div><strong>Phone:</strong> ${inv.customer_phone || 'Walk-in / Unregistered'}</div>
            <div><strong>Address:</strong> ${inv.customer_address || 'Local Resident'}</div>
            ${inv.customer_gstin ? `<div><strong>Customer GSTIN:</strong> ${inv.customer_gstin}</div>` : ''}
          </div>
          <div>
            <h4>Prescription / Doctor Details</h4>
            <div><strong>Doctor Name:</strong> ${inv.doctor_name || 'Self-Medication / OTC'}</div>
            <div><strong>Reg. No:</strong> ${inv.doctor_reg_no || 'N/A'}</div>
            <div><strong>Clinic/Hospital:</strong> ${inv.doctor_name ? 'Registered Clinic' : 'Counter Sale'}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 25%; text-align: left;">Product Description</th>
              <th style="width: 8%;">HSN</th>
              <th style="width: 9%;">Batch</th>
              <th style="width: 7%;">Exp</th>
              <th style="width: 8%;">Qty / Unit</th>
              <th style="width: 8%; text-align: right;">MRP (₹)</th>
              <th style="width: 8%; text-align: right;">Rate (₹)</th>
              <th style="width: 5%;">Disc%</th>
              <th style="width: 9%; text-align: right;">Taxable (₹)</th>
              <th style="width: 7%;">GST%</th>
              <th style="width: 10%; text-align: right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map((it, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>
                  <strong>${it.brand_name}</strong>
                  ${it.generic_name ? `<br><span style="font-size: 8.5px; color: #555;">${it.generic_name}</span>` : ''}
                </td>
                <td style="text-align: center;">${it.hsn_code || '3004'}</td>
                <td style="text-align: center;">${it.batch_number}</td>
                <td style="text-align: center;">${(it.expiry_date || '').slice(2, 7)}</td>
                <td style="text-align: center;">${it.unit || it.quantity}</td>
                <td style="text-align: right;">${(it.mrp / 100).toFixed(2)}</td>
                <td style="text-align: right;">${(it.selling_rate / 100).toFixed(2)}</td>
                <td style="text-align: center;">${it.discount_percent ? (it.discount_percent / 100).toFixed(1) + '%' : '-'}</td>
                <td style="text-align: right;">${(it.taxable_amount / 100).toFixed(2)}</td>
                <td style="text-align: center;">${((it.tax_rate || 1200) / 100).toFixed(0)}%</td>
                <td style="text-align: right; font-weight: bold;">${(it.line_total / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- HSN Tax Summary Table -->
        <table class="tax-summary-table">
          <thead>
            <tr>
              <th>HSN/SAC</th>
              <th>Taxable Value (₹)</th>
              <th>CGST Rate</th>
              <th>CGST Amt (₹)</th>
              <th>SGST Rate</th>
              <th>SGST Amt (₹)</th>
              <th>Total Tax (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${hsnRows.map(h => `
              <tr>
                <td style="text-align: center;">${h.hsn}</td>
                <td>${(h.taxable / 100).toFixed(2)}</td>
                <td style="text-align: center;">${(h.taxRate / 200).toFixed(1)}%</td>
                <td>${(h.cgst / 100).toFixed(2)}</td>
                <td style="text-align: center;">${(h.taxRate / 200).toFixed(1)}%</td>
                <td>${(h.sgst / 100).toFixed(2)}</td>
                <td style="font-weight: bold;">${(h.totalTax / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer-grid">
          <div class="terms-block">
            <div><strong>Amount in Words:</strong> <em>${words}</em></div>
            <div class="bank-box">
              <strong>Bank Details for Electronic Payments:</strong><br>
              Bank: ${company.bank_name || 'HDFC Bank Ltd'} | A/c No: ${company.bank_account_no || '50200012345678'} | IFSC: ${company.bank_ifsc || 'HDFC0000123'} | UPI: ${company.upi_id || 'apex@upi'}
            </div>
            <div style="font-size: 8.5px; color: #555; margin-top: 5px;">
              <strong>Terms & Conditions:</strong> 1. Goods once sold will be accepted back only in original packaging within 7 days. 2. Storage as per manufacturer guidelines. 3. Subject to local jurisdiction.
            </div>
          </div>

          <div class="totals-summary">
            <div class="totals-summary-row"><span>Subtotal:</span><span>${MediStock.formatRupees(inv.subtotal)}</span></div>
            ${inv.total_discount > 0 ? `<div class="totals-summary-row"><span>Discount Savings:</span><span>-${MediStock.formatRupees(inv.total_discount)}</span></div>` : ''}
            <div class="totals-summary-row"><span>Taxable Value:</span><span>${MediStock.formatRupees(inv.taxable_amount || (inv.subtotal - inv.total_discount))}</span></div>
            <div class="totals-summary-row"><span>CGST:</span><span>${MediStock.formatRupees(inv.cgst_amount || (inv.total_tax / 2))}</span></div>
            <div class="totals-summary-row"><span>SGST:</span><span>${MediStock.formatRupees(inv.sgst_amount || (inv.total_tax / 2))}</span></div>
            ${inv.round_off !== 0 ? `<div class="totals-summary-row"><span>Round Off:</span><span>${(inv.round_off / 100).toFixed(2)}</span></div>` : ''}
            <div class="totals-grand-row"><span>NET AMOUNT PAYABLE:</span><span>${MediStock.formatRupees(inv.grand_total)}</span></div>

            <div class="signatory-box">
              <div>For <strong>${company.trade_name || company.name || 'APEX PHARMACY'}</strong></div>
              <div style="margin-top: 35px;">Authorised Signatory / Regd. Pharmacist</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderA5InvoiceHtml(inv) {
    const company = inv.company || {};
    return `
      <div class="a5-invoice">
        <div class="a5-header">
          <div>
            <div class="a5-store-name">${company.trade_name || company.name || 'APEX PHARMACY'}</div>
            <div class="a5-store-meta">
              ${company.address_line1 || ''}, ${company.city || ''} | Ph: ${company.phone || ''}<br>
              DL: ${company.drug_license_no_1 || ''} | GSTIN: ${company.gstin || ''}
            </div>
          </div>
          <div class="a5-bill-meta">
            <div><strong>RETAIL TAX INVOICE</strong></div>
            <div><strong>Bill No:</strong> ${inv.invoice_number}</div>
            <div><strong>Date:</strong> ${inv.invoice_date}</div>
            <div><strong>Mode:</strong> ${inv.payment_mode}</div>
          </div>
        </div>

        <div class="a5-parties">
          <div><strong>Customer:</strong> ${inv.customer_name} ${inv.customer_phone ? '(' + inv.customer_phone + ')' : ''}</div>
          <div>${inv.doctor_name ? `<strong>Dr:</strong> ${inv.doctor_name}` : '<strong>OTC Counter Sale</strong>'}</div>
        </div>

        <table class="a5-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 38%; text-align: left;">Medicine / Description</th>
              <th style="width: 14%;">Batch</th>
              <th style="width: 10%;">Exp</th>
              <th style="width: 11%;">Qty</th>
              <th style="width: 10%; text-align: right;">Rate</th>
              <th style="width: 12%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map((it, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${it.brand_name}</strong></td>
                <td style="text-align: center;">${it.batch_number}</td>
                <td style="text-align: center;">${(it.expiry_date || '').slice(2, 7)}</td>
                <td style="text-align: center;">${it.unit || it.quantity}</td>
                <td style="text-align: right;">${(it.selling_rate / 100).toFixed(2)}</td>
                <td style="text-align: right; font-weight: 600;">${(it.line_total / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="a5-footer">
          <div style="font-size: 8.5px; color: #444;">
            <div>* GET WELL SOON * Thank you for your visit!</div>
            <div style="margin-top: 4px;">GST Included in Price: ${MediStock.formatRupees(inv.total_tax)}</div>
          </div>
          <div>
            <div class="a5-total-row"><span>Subtotal:</span><span>${MediStock.formatRupees(inv.subtotal)}</span></div>
            ${inv.total_discount > 0 ? `<div class="a5-total-row"><span>Discount:</span><span>-${MediStock.formatRupees(inv.total_discount)}</span></div>` : ''}
            <div class="a5-grand-total"><span>NET PAYABLE:</span><span>${MediStock.formatRupees(inv.grand_total)}</span></div>
            <div class="a5-sign-box">Pharmacist Signature: _____________</div>
          </div>
        </div>
      </div>
    `;
  },

  async openPrintPreviewModal(invoiceId) {
    const inv = await window.api.sales.getInvoice(invoiceId);
    if (!inv) return;

    let activeFormat = localStorage.getItem('medistock_bill_format') || '80mm';

    const getFormatHtml = (fmt) => {
      switch (fmt) {
        case 'a4': return this.renderA4InvoiceHtml(inv);
        case 'a5': return this.renderA5InvoiceHtml(inv);
        case '58mm': return this.render58mmReceiptHtml(inv);
        case '80mm':
        default:
          return this.render80mmReceiptHtml(inv);
      }
    };

    const bodyHtml = `
      <div class="bill-preview-wrapper">
        <div class="bill-format-toolbar">
          <div class="bill-format-btn-group" id="bill-format-btn-group">
            <button type="button" class="bill-format-btn ${activeFormat === '80mm' ? 'active' : ''}" data-format="80mm">🧾 80mm Thermal (POS)</button>
            <button type="button" class="bill-format-btn ${activeFormat === 'a4' ? 'active' : ''}" data-format="a4">📄 A4 Full GST Tax Invoice</button>
            <button type="button" class="bill-format-btn ${activeFormat === 'a5' ? 'active' : ''}" data-format="a5">📑 A5 Chemist Half-Page Bill</button>
            <button type="button" class="bill-format-btn ${activeFormat === '58mm' ? 'active' : ''}" data-format="58mm">🧾 58mm Mini Slip</button>
          </div>
          <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-muted);">
            <input type="checkbox" id="chk-default-format" ${localStorage.getItem('medistock_bill_format') === activeFormat ? 'checked' : ''}>
            Remember as default format
          </label>
        </div>

        <div class="bill-preview-stage">
          <div class="bill-preview-paper format-${activeFormat}" id="bill-paper-container">
            ${getFormatHtml(activeFormat)}
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-print-bill-now">🖨️ Print Invoice (Ctrl+P / Enter)</button>
      <button class="btn btn-outline" onclick="MediStock.closeModal()">Close</button>
    `;

    MediStock.showModal(`Invoice #${inv.invoice_number} — Print Preview & Formats`, bodyHtml, footerHtml, 'xl');

    // Populate hidden print container immediately
    const printContainer = document.getElementById('print-container');
    if (printContainer) {
      printContainer.className = `print-only format-${activeFormat}`;
      printContainer.innerHTML = getFormatHtml(activeFormat);
    }

    // Switch formats dynamically
    const formatButtons = document.querySelectorAll('#bill-format-btn-group .bill-format-btn');
    const paperContainer = document.getElementById('bill-paper-container');
    const chkDefault = document.getElementById('chk-default-format');

    const switchFormat = (fmt) => {
      activeFormat = fmt;
      formatButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.format === fmt);
      });
      if (paperContainer) {
        paperContainer.className = `bill-preview-paper format-${fmt}`;
        paperContainer.innerHTML = getFormatHtml(fmt);
      }
      if (printContainer) {
        printContainer.className = `print-only format-${fmt}`;
        printContainer.innerHTML = getFormatHtml(fmt);
      }
      if (chkDefault && chkDefault.checked) {
        localStorage.setItem('medistock_bill_format', fmt);
      }
    };

    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchFormat(btn.dataset.format);
      });
    });

    if (chkDefault) {
      chkDefault.addEventListener('change', () => {
        if (chkDefault.checked) {
          localStorage.setItem('medistock_bill_format', activeFormat);
          MediStock.toast(`Default print format set to: ${activeFormat.toUpperCase()}`, 'info');
        }
      });
    }

    const btnPrint = document.getElementById('btn-print-bill-now');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }
  },

  openCustomerModal() {
    const bodyHtml = `
      <div>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <input type="text" id="cust-search-input" class="form-control" placeholder="Search Customer Name or Phone..." autofocus>
          <button class="btn btn-primary" id="btn-create-fast-cust">+ New Customer</button>
        </div>
        <div id="cust-list-container" style="max-height: 280px; overflow-y: auto;">
          <p>Loading customers...</p>
        </div>
      </div>
    `;

    MediStock.showModal('Select Customer (F3)', bodyHtml, '', 'md');

    const searchInput = document.getElementById('cust-search-input');
    const listContainer = document.getElementById('cust-list-container');

    const loadList = async (q = '') => {
      const customers = await window.api.parties.listCustomers(q);
      listContainer.innerHTML = customers
        .map(
          (c) => `
        <div class="card" style="padding: 8px 12px; margin-bottom: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
             onclick="window.MediStockViews.billing.setCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}', '${c.phone || ''}')">
          <div>
            <strong>${c.name}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${c.phone || 'No phone'} | Balance: ${MediStock.formatRupees(c.current_balance)}</div>
          </div>
          <button class="btn btn-outline btn-sm">Select</button>
        </div>
      `
        )
        .join('');
    };

    loadList();

    searchInput.addEventListener('input', (e) => loadList(e.target.value));

    document.getElementById('btn-create-fast-cust').addEventListener('click', () => {
      const name = prompt('Enter Customer Full Name:');
      if (!name) return;
      const phone = prompt('Enter Customer Phone Number:');
      window.api.parties.saveCustomer({ name, phone }).then((res) => {
        this.setCustomer(res.id, name, phone);
        MediStock.closeModal();
      });
    });
  },

  setCustomer(id, name, phone) {
    this.bill.customer = { id, name, phone: phone || '' };
    const nameInput = document.getElementById('pos-customer-name');
    if (nameInput) nameInput.value = name;
    const phoneInput = document.getElementById('pos-customer-phone');
    if (phoneInput) phoneInput.value = phone || '';
    const statusBadge = document.getElementById('pos-cust-status');
    if (statusBadge) {
      if (id) {
        statusBadge.textContent = 'Found';
        statusBadge.className = 'cust-match-badge found';
        statusBadge.style.display = 'inline-block';
      } else {
        statusBadge.style.display = 'none';
      }
    }
    const dropdown = document.getElementById('pos-customer-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    MediStock.closeModal();
    MediStock.toast(`Customer set to "${name}"`, 'info');
  },

  holdCurrentBill() {
    if (this.bill.items.length === 0) {
      MediStock.toast('No items in bill to hold', 'warning');
      return;
    }
    this.heldBills.push(JSON.parse(JSON.stringify(this.bill)));
    this.clearBill();
    document.getElementById('held-count-badge').textContent = this.heldBills.length;
    MediStock.toast(`Bill held successfully (${this.heldBills.length} held)`, 'info');
  },

  resumeHeldBill() {
    if (this.heldBills.length === 0) {
      MediStock.toast('No held bills in memory', 'warning');
      return;
    }
    this.bill = this.heldBills.pop();
    document.getElementById('held-count-badge').textContent = this.heldBills.length;
    this.renderItemsTable();
    this.updateTotals();
    const nameInput = document.getElementById('pos-customer-name');
    if (nameInput) nameInput.value = this.bill.customer.name;
    const phoneInput = document.getElementById('pos-customer-phone');
    if (phoneInput) phoneInput.value = this.bill.customer.phone || '';
    const statusBadge = document.getElementById('pos-cust-status');
    if (statusBadge) {
      if (this.bill.customer.id) {
        statusBadge.textContent = 'Found';
        statusBadge.className = 'cust-match-badge found';
        statusBadge.style.display = 'inline-block';
      } else {
        statusBadge.style.display = 'none';
      }
    }
    MediStock.toast('Held bill restored', 'success');
  },

  clearBill() {
    this.bill = {
      customer: { id: null, name: 'Counter Cash / Walk-in Customer', phone: '' },
      doctorName: '',
      doctorRegNo: '',
      paymentMode: 'CASH',
      invoiceDiscountPercent: 0,
      invoiceDiscountAmount: 0,
      notes: '',
      items: [],
    };
    const nameInput = document.getElementById('pos-customer-name');
    if (nameInput) nameInput.value = this.bill.customer.name;
    const phoneInput = document.getElementById('pos-customer-phone');
    if (phoneInput) phoneInput.value = '';
    const statusBadge = document.getElementById('pos-cust-status');
    if (statusBadge) statusBadge.style.display = 'none';
    const docInput = document.getElementById('pos-doctor-name');
    if (docInput) docInput.value = '';
    const regInput = document.getElementById('pos-doctor-reg');
    if (regInput) regInput.value = '';
    const rxPill = document.getElementById('rx-doctor-pill');
    if (rxPill) rxPill.style.display = 'none';
    const btnToggleRx = document.getElementById('btn-toggle-rx');
    if (btnToggleRx) btnToggleRx.textContent = '+ Rx Doctor';
    this.renderItemsTable();
    this.updateTotals();
  },
};
