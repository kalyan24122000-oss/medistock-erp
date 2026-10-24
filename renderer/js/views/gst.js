// renderer/js/views/gst.js
// GST Registers, GSTR-1, GSTR-3B & HSN Summary Reporting

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.gst = {
  currentTab: 'gstr1', // 'gstr1', 'gstr3b', 'hsn'

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📑 GST Compliance & Tax Return Registers</div>
          <button class="btn btn-outline btn-sm" id="btn-export-gst-excel">Export Tax Sheet</button>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn ${this.currentTab === 'gstr1' ? 'active' : ''}" data-tab="gstr1">GSTR-1 (Outward Supplies)</button>
          <button class="tab-btn ${this.currentTab === 'gstr3b' ? 'active' : ''}" data-tab="gstr3b">GSTR-3B (Tax vs ITC)</button>
          <button class="tab-btn ${this.currentTab === 'hsn' ? 'active' : ''}" data-tab="hsn">HSN Summary</button>
        </div>

        <div id="gst-content-area">
          <p>Loading GST register...</p>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderGstTab();
  },

  bindEvents() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab');
        this.renderGstTab();
      });
    });

    document.getElementById('btn-export-gst-excel').addEventListener('click', async () => {
      if (this.currentTab === 'hsn') {
        const hsn = await window.api.gst.getHsnSummary(null, null);
        const data = hsn.map((h) => ({
          'HSN Code': h.hsn_code,
          'Total Qty': h.total_qty,
          UQC: h.uqc,
          'Taxable Value': (h.total_taxable / 100).toFixed(2),
          'Tax Rate %': h.tax_rate_percent,
          CGST: (h.total_cgst / 100).toFixed(2),
          SGST: (h.total_sgst / 100).toFixed(2),
          'Total Amount': (h.total_amount / 100).toFixed(2),
        }));
        const res = await window.api.export.exportToExcel(data, 'HSN_Summary_MediStock.xlsx');
        if (res.success) MediStock.toast(`Exported HSN summary to ${res.filePath}`, 'success');
      } else {
        MediStock.toast('Exporting GSTR register to Excel...', 'info');
      }
    });
  },

  async renderGstTab() {
    const area = document.getElementById('gst-content-area');
    if (!area) return;

    if (this.currentTab === 'gstr1') {
      const gstr1 = await window.api.gst.getGstr1(null, null);
      area.innerHTML = `
        <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Rate-Wise Outward Supplies:</h4>
        <div class="table-container" style="margin-bottom: 16px;">
          <table class="erp-table">
            <thead>
              <tr>
                <th>GST Rate %</th>
                <th class="text-right">Taxable Value</th>
                <th class="text-right">CGST (Central)</th>
                <th class="text-right">SGST (State)</th>
                <th class="text-right">Total Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              ${
                gstr1.rateWise.length === 0
                  ? `<tr><td colspan="5" class="text-center">No outward supplies recorded yet.</td></tr>`
                  : gstr1.rateWise
                      .map(
                        (r) => `
                    <tr>
                      <td><strong>${r.tax_rate_percent.toFixed(1)}% GST</strong></td>
                      <td class="text-right font-mono">${MediStock.formatRupees(r.total_taxable)}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(r.total_cgst)}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(r.total_sgst)}</td>
                      <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(r.total_line_amount)}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">B2B Invoices (With Customer GSTIN):</h4>
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer / Clinic Name</th>
                <th>Customer GSTIN</th>
                <th class="text-right">Taxable</th>
                <th class="text-right">CGST</th>
                <th class="text-right">SGST</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                gstr1.b2bInvoices.length === 0
                  ? `<tr><td colspan="8" class="text-center">No B2B invoices recorded yet.</td></tr>`
                  : gstr1.b2bInvoices
                      .map(
                        (b) => `
                    <tr>
                      <td class="font-mono"><strong>${b.invoice_number}</strong></td>
                      <td>${b.invoice_date}</td>
                      <td><strong>${b.customer_name}</strong></td>
                      <td class="font-mono">${b.customer_gstin}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(b.taxable_amount)}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(b.cgst_amount)}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(b.sgst_amount)}</td>
                      <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(b.grand_total)}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `;
    } else if (this.currentTab === 'gstr3b') {
      const gstr3b = await window.api.gst.getGstr3b(null, null);
      area.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <!-- 3.1 Outward Supplies -->
          <div class="card">
            <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin-bottom: 8px;">
              3.1 Outward Taxable Supplies (Sales)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
              <div style="display: flex; justify-content: space-between;"><span>Taxable Turnover:</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.outwardSupplies.taxable)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Integrated Tax (IGST):</span><span class="font-mono">${MediStock.formatRupees(gstr3b.outwardSupplies.igst)}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>Central Tax (CGST):</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.outwardSupplies.cgst)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>State Tax (SGST):</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.outwardSupplies.sgst)}</strong></div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 4px; font-weight: 700;">
                <span>Total Outward Liability:</span><span class="font-mono">${MediStock.formatRupees(gstr3b.outwardSupplies.cgst + gstr3b.outwardSupplies.sgst)}</span>
              </div>
            </div>
          </div>

          <!-- 4. Eligible ITC -->
          <div class="card">
            <h4 style="font-size: 13.5px; font-weight: 700; color: #16a34a; margin-bottom: 8px;">
              4. Eligible Inward ITC (Purchases)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
              <div style="display: flex; justify-content: space-between;"><span>Inward Purchase Value:</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.inwardItc.taxable)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Input Integrated (IGST):</span><span class="font-mono">${MediStock.formatRupees(gstr3b.inwardItc.igst)}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>Input Central (CGST):</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.inwardItc.cgst)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Input State (SGST):</span><strong class="font-mono">${MediStock.formatRupees(gstr3b.inwardItc.sgst)}</strong></div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 4px; font-weight: 700;">
                <span>Total Input Tax Credit:</span><span class="font-mono">${MediStock.formatRupees(gstr3b.inwardItc.cgst + gstr3b.inwardItc.sgst)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="background: #eff6ff; border: 1px solid #bfdbfe;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; font-weight: 700; color: #1e40af;">NET GST PAYABLE IN CASH (After ITC Offset):</span>
            <span style="font-size: 20px; font-weight: 900; font-family: var(--font-mono); color: #1d4ed8;">
              ${MediStock.formatRupees(gstr3b.netTaxPayable.total)}
            </span>
          </div>
        </div>
      `;
    } else {
      // HSN Summary
      const hsn = await window.api.gst.getHsnSummary(null, null);
      area.innerHTML = `
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>HSN Code</th>
                <th>Description</th>
                <th class="text-right">Total Quantity</th>
                <th>UQC</th>
                <th class="text-right">Taxable Value</th>
                <th>Rate</th>
                <th class="text-right">CGST</th>
                <th class="text-right">SGST</th>
                <th class="text-right">Total Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              ${
                hsn.length === 0
                  ? `<tr><td colspan="9" class="text-center">No HSN records found for outward supplies.</td></tr>`
                  : hsn
                      .map(
                        (h) => `
                    <tr>
                      <td class="font-mono"><strong>${h.hsn_code}</strong></td>
                      <td>Medicaments / Pharmaceuticals</td>
                      <td class="text-right font-mono">${h.total_qty}</td>
                      <td><span class="badge neutral">${h.uqc}</span></td>
                      <td class="text-right font-mono">${MediStock.formatRupees(h.total_taxable)}</td>
                      <td>${h.tax_rate_percent.toFixed(1)}%</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(h.total_cgst)}</td>
                      <td class="text-right font-mono">${MediStock.formatRupees(h.total_sgst)}</td>
                      <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(h.total_amount)}</td>
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
