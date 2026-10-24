// renderer/js/views/masters.js
// Medicine Master Catalog, Salt Compositions, Packaging Units, and Product Management

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.masters = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">💊 Medicine Master Catalog</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-export-medicines-excel">Export Medicines</button>
            <button class="btn btn-primary btn-sm" id="btn-open-new-medicine">+ Add New Medicine</button>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
          <input type="text" id="master-search" class="form-control" style="width: 280px;" placeholder="Search Brand, Generic, Salt, Code, Barcode...">
          <button class="btn btn-secondary btn-sm" id="btn-search-masters">Search</button>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Brand Name</th>
                <th>Generic / Salt Molecule</th>
                <th>Manufacturer</th>
                <th>Category</th>
                <th>Packaging Unit</th>
                <th>Rack</th>
                <th class="text-right">Cost Rate</th>
                <th class="text-right">MRP</th>
                <th class="text-right">Selling Price</th>
                <th>Schedule</th>
                <th class="text-center">Edit</th>
              </tr>
            </thead>
            <tbody id="master-tbody">
              <tr><td colspan="12" class="text-center">Loading medicine catalog...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadMedicines();
  },

  bindEvents() {
    document.getElementById('btn-search-masters').addEventListener('click', () => this.loadMedicines());
    const searchInput = document.getElementById('master-search');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.loadMedicines();
    });

    document.getElementById('btn-open-new-medicine').addEventListener('click', () => this.openProductModal(null));

    document.getElementById('btn-export-medicines-excel').addEventListener('click', async () => {
      const records = await window.api.medicines.search('', { limit: 1000 });
      if (!records || records.length === 0) {
        MediStock.toast('No medicines to export', 'warning');
        return;
      }
      const data = records.map((m) => ({
        Code: m.code,
        Barcode: m.barcode,
        Brand: m.brand_name,
        Generic: m.generic_name,
        Salt: m.salt_name,
        Manufacturer: m.manufacturer_name,
        Category: m.category_name,
        'Sale Unit': m.sale_unit,
        'Pack Ratio': m.conversion_ratio,
        'Cost Rate': (m.purchase_rate / 100).toFixed(2),
        MRP: (m.mrp / 100).toFixed(2),
        'Selling Rate': (m.selling_price / 100).toFixed(2),
        'Rack Location': m.rack_shelf,
        Schedule: m.schedule_type,
      }));
      const expRes = await window.api.export.exportToExcel(data, 'Medicine_Catalog_Master.xlsx');
      if (expRes.success) {
        MediStock.toast(`Exported catalog to ${expRes.filePath}`, 'success');
      }
    });
  },

  async loadMedicines() {
    const q = document.getElementById('master-search').value.trim();
    const tbody = document.getElementById('master-tbody');

    const products = await window.api.medicines.search(q, { limit: 100 });
    if (!products || products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding: 24px; color: var(--text-muted);">No medicines found matching query.</td></tr>`;
      return;
    }

    tbody.innerHTML = products
      .map(
        (p) => `
      <tr>
        <td class="font-mono"><strong>${p.code}</strong></td>
        <td><strong>${p.brand_name}</strong></td>
        <td>${p.generic_name || p.salt_name || 'N/A'}</td>
        <td>${p.manufacturer_name || 'N/A'}</td>
        <td>${p.category_name || 'General'}</td>
        <td>1 ${p.sale_unit || 'Strip'} (${p.conversion_ratio || 10} tabs)</td>
        <td><span class="badge neutral">${p.rack_shelf || 'N/A'}</span></td>
        <td class="text-right font-mono">${MediStock.formatRupees(p.purchase_rate)}</td>
        <td class="text-right font-mono">${MediStock.formatRupees(p.mrp)}</td>
        <td class="text-right font-mono" style="font-weight: 700; color: #0284c7;">${MediStock.formatRupees(p.selling_price)}</td>
        <td>
          <span class="badge ${p.schedule_type !== 'NONE' ? 'purple' : 'neutral'}">
            ${p.schedule_type || 'NONE'}
          </span>
        </td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="window.MediStockViews.masters.openProductModal(${p.id})">Edit</button>
        </td>
      </tr>
    `
      )
      .join('');
  },

  async openProductModal(productId = null) {
    let prod = null;
    if (productId) {
      prod = await window.api.medicines.getById(productId);
    }

    const masters = await window.api.medicines.getMasters();

    const bodyHtml = `
      <form id="product-master-form">
        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Product Code *:</label>
            <input type="text" id="m-code" class="form-control" value="${prod ? prod.code : `MED-${Date.now().toString().slice(-4)}`}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Barcode / EAN:</label>
            <input type="text" id="m-barcode" class="form-control" value="${prod ? prod.barcode || '' : ''}" placeholder="Barcode">
          </div>
          <div class="form-group">
            <label class="form-label">Brand Name *:</label>
            <input type="text" id="m-brand" class="form-control" value="${prod ? prod.brand_name : ''}" placeholder="e.g. Dolo 650 Tablet" required>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Generic / Salt Molecule:</label>
            <select id="m-salt" class="form-control">
              <option value="">-- Select Salt Molecule --</option>
              ${masters.salts.map((s) => `<option value="${s.id}" ${prod && prod.salt_id === s.id ? 'selected' : ''}>${s.name} (${s.schedule_type})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Manufacturer:</label>
            <select id="m-mfg" class="form-control">
              <option value="">-- Select Manufacturer --</option>
              ${masters.manufacturers.map((m) => `<option value="${m.id}" ${prod && prod.manufacturer_id === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Category:</label>
            <select id="m-cat" class="form-control">
              <option value="">-- Select Category --</option>
              ${masters.categories.map((c) => `<option value="${c.id}" ${prod && prod.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Sale Unit (Base):</label>
            <input type="text" id="m-sale-unit" class="form-control" value="${prod ? prod.sale_unit : 'Strip'}" placeholder="Strip / Bottle">
          </div>
          <div class="form-group">
            <label class="form-label">Pack Ratio (Tabs/Strip):</label>
            <input type="number" id="m-ratio" class="form-control" value="${prod ? prod.conversion_ratio : 10}">
          </div>
          <div class="form-group">
            <label class="form-label">HSN Code:</label>
            <input type="text" id="m-hsn" class="form-control" value="${prod ? prod.hsn_code : '3004'}">
          </div>
          <div class="form-group">
            <label class="form-label">GST Tax Rate:</label>
            <select id="m-tax" class="form-control">
              <option value="1200" ${prod && prod.tax_rate === 1200 ? 'selected' : ''}>12.00% (6% CGST + 6% SGST)</option>
              <option value="500" ${prod && prod.tax_rate === 500 ? 'selected' : ''}>5.00% (2.5% CGST + 2.5% SGST)</option>
              <option value="1800" ${prod && prod.tax_rate === 1800 ? 'selected' : ''}>18.00% (Cosmetics/Devices)</option>
              <option value="0" ${prod && prod.tax_rate === 0 ? 'selected' : ''}>0% (Exempt)</option>
            </select>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Cost Rate (₹):</label>
            <input type="number" id="m-cost" class="form-control" step="0.5" value="${prod ? (prod.purchase_rate / 100).toFixed(2) : '0.00'}">
          </div>
          <div class="form-group">
            <label class="form-label">MRP (₹):</label>
            <input type="number" id="m-mrp" class="form-control" step="0.5" value="${prod ? (prod.mrp / 100).toFixed(2) : '0.00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Retail Selling Price (₹):</label>
            <input type="number" id="m-sell" class="form-control" step="0.5" value="${prod ? (prod.selling_price / 100).toFixed(2) : '0.00'}">
          </div>
          <div class="form-group">
            <label class="form-label">Rack / Shelf Location:</label>
            <input type="text" id="m-rack" class="form-control" value="${prod ? prod.rack_shelf || '' : ''}" placeholder="e.g. R2-S1">
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Schedule Classification:</label>
            <select id="m-schedule" class="form-control">
              <option value="NONE" ${prod && prod.schedule_type === 'NONE' ? 'selected' : ''}>General OTC / Non-Scheduled</option>
              <option value="SCHEDULE_H" ${prod && prod.schedule_type === 'SCHEDULE_H' ? 'selected' : ''}>Schedule H (Doctor Prescription Mandatory)</option>
              <option value="SCHEDULE_H1" ${prod && prod.schedule_type === 'SCHEDULE_H1' ? 'selected' : ''}>Schedule H1 (Statutory Register Mandatory)</option>
              <option value="NARCOTIC" ${prod && prod.schedule_type === 'NARCOTIC' ? 'selected' : ''}>Narcotic / NDPS Drug</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Reorder Stock Alert Threshold:</label>
            <input type="number" id="m-reorder" class="form-control" value="${prod ? prod.reorder_level : 15}">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-medicine">${prod ? 'Update Medicine' : 'Save Medicine'}</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal(prod ? `Edit Medicine — ${prod.brand_name}` : 'Add New Medicine', bodyHtml, footerHtml, 'lg');

    document.getElementById('btn-save-medicine').addEventListener('click', async () => {
      const brand = document.getElementById('m-brand').value.trim();
      const code = document.getElementById('m-code').value.trim();

      if (!brand || !code) {
        MediStock.toast('Product Code and Brand Name are required', 'warning');
        return;
      }

      const cost = Math.round(Number(document.getElementById('m-cost').value) * 100);
      const mrp = Math.round(Number(document.getElementById('m-mrp').value) * 100);
      const sell = Math.round(Number(document.getElementById('m-sell').value) * 100);

      const payload = {
        id: prod ? prod.id : undefined,
        code,
        barcode: document.getElementById('m-barcode').value.trim() || null,
        brandName: brand,
        saltId: Number(document.getElementById('m-salt').value) || null,
        manufacturerId: Number(document.getElementById('m-mfg').value) || null,
        categoryId: Number(document.getElementById('m-cat').value) || null,
        saleUnit: document.getElementById('m-sale-unit').value.trim() || 'Strip',
        conversionRatio: Number(document.getElementById('m-ratio').value) || 10,
        hsnCode: document.getElementById('m-hsn').value.trim() || '3004',
        taxRate: Number(document.getElementById('m-tax').value) || 1200,
        purchaseRate: cost,
        mrp: mrp,
        sellingPrice: sell,
        rackShelf: document.getElementById('m-rack').value.trim() || null,
        scheduleType: document.getElementById('m-schedule').value,
        reorderLevel: Number(document.getElementById('m-reorder').value) || 10,
        isPrescriptionRequired: document.getElementById('m-schedule').value !== 'NONE',
      };

      try {
        await window.api.medicines.save(payload);
        MediStock.closeModal();
        MediStock.toast(`Medicine "${brand}" saved successfully!`, 'success');
        this.loadMedicines();
      } catch (err) {
        MediStock.toast(`Save error: ${err.message}`, 'error');
      }
    });
  },
};
