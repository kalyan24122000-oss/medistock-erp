// renderer/js/views/compliance.js
// Statutory Pharmacy Compliance: Schedule H, Schedule H1, Narcotic Registers & Batch Recall Traceability

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.compliance = {
  currentTab: 'SCHEDULE_H',

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚖️ Statutory Compliance & Schedule H/H1 Drug Registers</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-export-comp-excel">Export Compliance Register</button>
            <button class="btn btn-primary btn-sm" id="btn-open-recall-tool">🔍 Drug Recall & Batch Trace</button>
          </div>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn ${this.currentTab === 'SCHEDULE_H' ? 'active' : ''}" data-tab="SCHEDULE_H">
            Schedule H Register
          </button>
          <button class="tab-btn ${this.currentTab === 'SCHEDULE_H1' ? 'active' : ''}" data-tab="SCHEDULE_H1">
            Schedule H1 Register (Antibiotics/Psychotropics)
          </button>
          <button class="tab-btn ${this.currentTab === 'NARCOTIC' ? 'active' : ''}" data-tab="NARCOTIC">
            Narcotic & NDPS Register
          </button>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: var(--radius); margin-bottom: 14px; font-size: 12px; color: #334155;">
          <strong>Indian Drugs & Cosmetics Rules Verification:</strong> Entries below are logged automatically upon POS dispensing when a Schedule H/H1 medicine is included in the bill. Maintained for Drug Inspector audit and statutory inspections.
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill / Ref No</th>
                <th>Prescribed Medicine</th>
                <th>Batch No</th>
                <th>Expiry</th>
                <th class="text-right">Qty</th>
                <th>Doctor Name</th>
                <th>Doctor Reg No</th>
                <th>Patient Name</th>
                <th>Contact Phone</th>
                <th>Pharmacist</th>
              </tr>
            </thead>
            <tbody id="comp-tbody">
              <tr><td colspan="11" class="text-center">Loading statutory register entries...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadRegister();
  },

  bindEvents() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab');
        this.loadRegister();
      });
    });

    document.getElementById('btn-open-recall-tool').addEventListener('click', () => this.openRecallModal());

    document.getElementById('btn-export-comp-excel').addEventListener('click', async () => {
      const records = await window.api.compliance.getRegister(this.currentTab);
      if (!records || records.length === 0) {
        MediStock.toast('No register records to export', 'warning');
        return;
      }
      const data = records.map((r) => ({
        Date: r.date_recorded,
        'Bill No': r.reference_id,
        Medicine: r.brand_name,
        Batch: r.batch_number,
        Expiry: r.expiry_date,
        Qty: r.quantity,
        'Doctor Name': r.doctor_name,
        'Doctor Reg No': r.doctor_reg_no,
        'Patient Name': r.patient_name,
        'Patient Phone': r.customer_phone,
        Pharmacist: r.dispensing_pharmacist,
      }));
      const expRes = await window.api.export.exportToExcel(data, `${this.currentTab}_Register_Audit.xlsx`);
      if (expRes.success) {
        MediStock.toast(`Exported statutory register to ${expRes.filePath}`, 'success');
      }
    });
  },

  async loadRegister() {
    const tbody = document.getElementById('comp-tbody');
    const records = await window.api.compliance.getRegister(this.currentTab);

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 24px; color: var(--text-muted);">No entries recorded in ${this.currentTab} register yet. Dispense a Schedule item in billing to test automatic compliance logging!</td></tr>`;
      return;
    }

    tbody.innerHTML = records
      .map(
        (r) => `
      <tr>
        <td>${r.date_recorded}</td>
        <td class="font-mono"><strong>${r.reference_id}</strong></td>
        <td>
          <strong>${r.brand_name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${r.generic_name}</div>
        </td>
        <td><span class="font-mono">${r.batch_number}</span></td>
        <td>${r.expiry_date}</td>
        <td class="text-right font-mono" style="font-weight: 700;">${r.quantity} ${r.sale_unit}</td>
        <td><strong>${r.doctor_name || 'Prescribed'}</strong></td>
        <td class="font-mono">${r.doctor_reg_no || 'N/A'}</td>
        <td>${r.patient_name || 'Patient'}</td>
        <td>${r.customer_phone || 'N/A'}</td>
        <td style="font-size: 11px;">${r.dispensing_pharmacist || 'Reg. Pharmacist'}</td>
      </tr>
    `
      )
      .join('');
  },

  openRecallModal() {
    const bodyHtml = `
      <div>
        <p style="margin-bottom: 10px; font-size: 12.5px;">
          Enter Batch Number to trace supply chain origins (Supplier, Goods Receipt) and all dispensed Patient / Customer invoices for immediate recall notice:
        </p>

        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <input type="text" id="recall-batch-input" class="form-control" placeholder="e.g. DL-24A01 or AG-24F91" style="font-weight: 700;">
          <button class="btn btn-primary" id="btn-trace-batch">Execute Trace</button>
        </div>

        <div id="recall-results-container" style="display: none;">
          <!-- Results injected dynamically -->
        </div>
      </div>
    `;

    MediStock.showModal('Drug Recall & Batch Traceability Tool', bodyHtml, '', 'lg');

    document.getElementById('btn-trace-batch').addEventListener('click', async () => {
      const batchNum = document.getElementById('recall-batch-input').value.trim();
      if (!batchNum) {
        MediStock.toast('Please enter batch number', 'warning');
        return;
      }

      const resultsContainer = document.getElementById('recall-results-container');
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<p>Tracing supply chain records...</p>';

      try {
        const trace = await window.api.compliance.traceBatch(batchNum);
        if (!trace) {
          resultsContainer.innerHTML = `<div class="card"><p style="color: red;">Batch "${batchNum}" was not found in system records.</p></div>`;
          return;
        }

        resultsContainer.innerHTML = `
          <div class="card" style="background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 12px;">
            <h4 style="color: #15803d; font-size: 13px;">Batch Profile: ${trace.batch.brand_name}</h4>
            <div style="font-size: 12px; margin-top: 4px;">
              <strong>Batch:</strong> ${trace.batch.batch_number} | <strong>Expiry:</strong> ${trace.batch.expiry_date} |
              <strong>Current Available Qty:</strong> ${trace.batch.available_qty} |
              <strong>Supplier:</strong> ${trace.batch.supplier_name || 'Direct Wholesale'}
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <h5 style="font-size: 12px; font-weight: 700; margin-bottom: 6px;">Patients / Customers Dispensed (${trace.sales.length}):</h5>
            <div class="table-container">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Patient Name</th>
                    <th>Phone</th>
                    <th>Doctor</th>
                    <th class="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    trace.sales.length === 0
                      ? `<tr><td colspan="6" class="text-center">No sales of this batch recorded yet.</td></tr>`
                      : trace.sales
                          .map(
                            (s) => `
                        <tr>
                          <td>${s.invoice_date}</td>
                          <td class="font-mono"><strong>${s.invoice_number}</strong></td>
                          <td><strong>${s.customer_name}</strong></td>
                          <td>${s.customer_phone || 'N/A'}</td>
                          <td>${s.doctor_name || 'N/A'}</td>
                          <td class="text-right font-mono">${s.quantity} ${s.unit}</td>
                        </tr>
                      `
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        resultsContainer.innerHTML = `<p style="color: red;">Trace error: ${err.message}</p>`;
      }
    });
  },
};
