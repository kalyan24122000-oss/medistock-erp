// renderer/js/views/accounts.js
// Double-Entry Accounting Engine, Trial Balance, P&L, Balance Sheet & Vouchers

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.accounts = {
  currentTab: 'trial', // 'trial', 'pl', 'bs', 'chart'

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚖️ Double-Entry Financial Accounting & Statements</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="btn-export-acc-excel">Export Statement</button>
            <button class="btn btn-primary btn-sm" id="btn-open-new-voucher">+ New Journal Voucher</button>
          </div>
        </div>

        <div class="tabs-nav">
          <button class="tab-btn ${this.currentTab === 'trial' ? 'active' : ''}" data-tab="trial">Trial Balance</button>
          <button class="tab-btn ${this.currentTab === 'pl' ? 'active' : ''}" data-tab="pl">Profit & Loss</button>
          <button class="tab-btn ${this.currentTab === 'bs' ? 'active' : ''}" data-tab="bs">Balance Sheet</button>
          <button class="tab-btn ${this.currentTab === 'chart' ? 'active' : ''}" data-tab="chart">Chart of Accounts</button>
        </div>

        <div id="accounts-content-area">
          <p>Loading financial statement...</p>
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
        this.currentTab = btn.getAttribute('data-tab');
        this.renderActiveTab();
      });
    });

    document.getElementById('btn-open-new-voucher').addEventListener('click', () => this.openVoucherModal());
  },

  async renderActiveTab() {
    const area = document.getElementById('accounts-content-area');
    if (!area) return;

    if (this.currentTab === 'trial') {
      const trial = await window.api.accounts.getTrialBalance();
      area.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 13px; font-weight: 700;">Trial Balance as of ${trial.asOfDate}</div>
          <div class="badge ${trial.isBalanced ? 'success' : 'danger'}" style="font-size: 12px; padding: 4px 10px;">
            ${trial.isBalanced ? '✔ Strict Equilibrium: Total Debits === Total Credits' : `✖ Out of Balance: Diff ${MediStock.formatRupees(trial.difference)}`}
          </div>
        </div>

        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Group</th>
                <th class="text-right">Debit Balance</th>
                <th class="text-right">Credit Balance</th>
              </tr>
            </thead>
            <tbody>
              ${trial.rows
                .map(
                  (r) => `
                <tr>
                  <td class="font-mono"><strong>${r.code}</strong></td>
                  <td><strong>${r.name}</strong></td>
                  <td><span class="badge neutral">${r.group}</span></td>
                  <td class="text-right font-mono" style="${r.debit > 0 ? 'font-weight: 700;' : 'color: var(--text-light);'}">${MediStock.formatRupees(r.debit)}</td>
                  <td class="text-right font-mono" style="${r.credit > 0 ? 'font-weight: 700;' : 'color: var(--text-light);'}">${MediStock.formatRupees(r.credit)}</td>
                </tr>
              `
                )
                .join('')}
              <tr style="background-color: #f1f5f9; font-weight: 800; font-size: 13px; border-top: 2px solid #000;">
                <td colspan="3" class="text-right">TOTALS:</td>
                <td class="text-right font-mono" style="color: #0284c7;">${MediStock.formatRupees(trial.totalDebit)}</td>
                <td class="text-right font-mono" style="color: #0284c7;">${MediStock.formatRupees(trial.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (this.currentTab === 'pl') {
      const pl = await window.api.accounts.getProfitAndLoss(null, null);
      area.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <!-- Expenses Column -->
          <div class="card" style="margin-bottom: 0;">
            <h4 style="font-size: 13.5px; font-weight: 700; color: #dc2626; border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
              EXPENSES (Dr)
            </h4>
            <table class="erp-table">
              <tbody>
                ${pl.expenses.map((e) => `<tr><td>${e.code} - ${e.name}</td><td class="text-right font-mono">${MediStock.formatRupees(e.amount)}</td></tr>`).join('')}
                <tr style="font-weight: 700; background: #f8fafc;"><td>Total Expenses:</td><td class="text-right font-mono">${MediStock.formatRupees(pl.totalExpenses)}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Income Column -->
          <div class="card" style="margin-bottom: 0;">
            <h4 style="font-size: 13.5px; font-weight: 700; color: #16a34a; border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
              INCOME (Cr)
            </h4>
            <table class="erp-table">
              <tbody>
                ${pl.income.map((i) => `<tr><td>${i.code} - ${i.name}</td><td class="text-right font-mono">${MediStock.formatRupees(i.amount)}</td></tr>`).join('')}
                <tr style="font-weight: 700; background: #f8fafc;"><td>Total Income:</td><td class="text-right font-mono">${MediStock.formatRupees(pl.totalIncome)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="background: ${pl.netProfit >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${pl.netProfit >= 0 ? '#bbf7d0' : '#fecaca'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 15px; font-weight: 800; color: ${pl.netProfit >= 0 ? '#15803d' : '#b91c1c'};">
              ${pl.netProfit >= 0 ? 'NET PROFIT FOR PERIOD:' : 'NET LOSS FOR PERIOD:'}
            </span>
            <span style="font-size: 20px; font-weight: 900; font-family: var(--font-mono); color: ${pl.netProfit >= 0 ? '#15803d' : '#b91c1c'};">
              ${MediStock.formatRupees(Math.abs(pl.netProfit))}
            </span>
          </div>
        </div>
      `;
    } else if (this.currentTab === 'bs') {
      const bs = await window.api.accounts.getBalanceSheet();
      area.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- Liabilities & Equity -->
          <div class="card">
            <h4 style="font-size: 13.5px; font-weight: 700; border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
              LIABILITIES & CAPITAL
            </h4>
            <table class="erp-table">
              <tbody>
                <tr style="font-weight: 700; background: #f8fafc;"><td colspan="2">Owner Capital & Reserves:</td></tr>
                ${bs.equity.map((e) => `<tr><td style="padding-left: 20px;">${e.name}</td><td class="text-right font-mono">${MediStock.formatRupees(e.amount)}</td></tr>`).join('')}
                <tr style="font-weight: 700; background: #f8fafc;"><td colspan="2">Current Liabilities:</td></tr>
                ${bs.liabilities.map((l) => `<tr><td style="padding-left: 20px;">${l.name}</td><td class="text-right font-mono">${MediStock.formatRupees(l.amount)}</td></tr>`).join('')}
                <tr style="font-weight: 800; font-size: 13px; border-top: 2px solid #000;">
                  <td>TOTAL LIABILITIES & EQUITY:</td>
                  <td class="text-right font-mono" style="color: #0284c7;">${MediStock.formatRupees(bs.totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Assets -->
          <div class="card">
            <h4 style="font-size: 13.5px; font-weight: 700; border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;">
              ASSETS (PROPERTIES & CURRENT ASSETS)
            </h4>
            <table class="erp-table">
              <tbody>
                ${bs.assets.map((a) => `<tr><td>${a.name}</td><td class="text-right font-mono">${MediStock.formatRupees(a.amount)}</td></tr>`).join('')}
                <tr style="font-weight: 800; font-size: 13px; border-top: 2px solid #000;">
                  <td>TOTAL ASSETS:</td>
                  <td class="text-right font-mono" style="color: #0284c7;">${MediStock.formatRupees(bs.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      // Chart of Accounts
      const chart = await window.api.accounts.getChart();
      area.innerHTML = `
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Title</th>
                <th>Group Classification</th>
                <th class="text-right">Opening Balance</th>
                <th class="text-right">Current Balance</th>
                <th>System Account</th>
              </tr>
            </thead>
            <tbody>
              ${chart
                .map(
                  (a) => `
                <tr>
                  <td class="font-mono"><strong>${a.code}</strong></td>
                  <td><strong>${a.name}</strong></td>
                  <td><span class="badge ${a.group_name === 'ASSET' ? 'info' : a.group_name === 'LIABILITY' ? 'warning' : a.group_name === 'INCOME' ? 'success' : 'neutral'}">${a.group_name}</span></td>
                  <td class="text-right font-mono">${MediStock.formatRupees(a.opening_balance)}</td>
                  <td class="text-right font-mono" style="font-weight: 700;">${MediStock.formatRupees(a.current_balance)}</td>
                  <td><span class="badge neutral">${a.is_system ? 'System Protected' : 'User'}</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  },

  async openVoucherModal() {
    const chart = await window.api.accounts.getChart();

    const bodyHtml = `
      <div>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label">Voucher Type:</label>
            <select id="v-type" class="form-control">
              <option value="JOURNAL">Journal Voucher (General)</option>
              <option value="CONTRA">Contra Voucher (Cash to Bank / Bank to Cash)</option>
              <option value="RECEIPT">Direct Receipt</option>
              <option value="PAYMENT">Direct Payment</option>
              <option value="EXPENSE">Expense Payment</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Voucher Date:</label>
            <input type="date" id="v-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Narration / Description *:</label>
          <input type="text" id="v-narration" class="form-control" placeholder="e.g. Paid electricity bill via bank / Shop rent payment" required>
        </div>

        <h5 style="font-size: 12.5px; font-weight: 700; margin: 12px 0 6px;">Voucher Lines (Debits must equal Credits):</h5>
        <div style="border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; background: #f8fafc; margin-bottom: 12px;">
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <label class="form-label">Debit Account (Dr):</label>
            <label class="form-label">Debit Amount (₹):</label>
            <div></div>
            <select id="v-dr-acc" class="form-control">
              ${chart.map((a) => `<option value="${a.id}">${a.code} - ${a.name} (${a.group_name})</option>`).join('')}
            </select>
            <input type="number" id="v-dr-amt" class="form-control" placeholder="Amount" step="0.5">
            <div></div>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px;">
            <label class="form-label">Credit Account (Cr):</label>
            <label class="form-label">Credit Amount (₹):</label>
            <div></div>
            <select id="v-cr-acc" class="form-control">
              ${chart.map((a) => `<option value="${a.id}">${a.code} - ${a.name} (${a.group_name})</option>`).join('')}
            </select>
            <input type="number" id="v-cr-amt" class="form-control" placeholder="Amount" step="0.5">
            <div></div>
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-post-voucher">Post Balanced Voucher</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal('Post Double-Entry Journal Voucher', bodyHtml, footerHtml, 'lg');

    // Auto-sync credit amount when debit is typed
    document.getElementById('v-dr-amt').addEventListener('input', (e) => {
      document.getElementById('v-cr-amt').value = e.target.value;
    });

    document.getElementById('btn-post-voucher').addEventListener('click', async () => {
      const narration = document.getElementById('v-narration').value.trim();
      if (!narration) {
        MediStock.toast('Narration is required', 'warning');
        return;
      }

      const drAccId = Number(document.getElementById('v-dr-acc').value);
      const crAccId = Number(document.getElementById('v-cr-acc').value);
      const drAmt = Math.round(Number(document.getElementById('v-dr-amt').value) * 100);
      const crAmt = Math.round(Number(document.getElementById('v-cr-amt').value) * 100);

      if (drAccId === crAccId) {
        MediStock.toast('Debit and Credit accounts must be different', 'warning');
        return;
      }
      if (drAmt <= 0 || crAmt <= 0 || drAmt !== crAmt) {
        MediStock.toast('Debit and Credit amounts must be equal and > 0', 'warning');
        return;
      }

      try {
        const res = await window.api.accounts.createVoucher({
          voucherType: document.getElementById('v-type').value,
          entryDate: document.getElementById('v-date').value,
          narration,
          lines: [
            { accountId: drAccId, debitAmount: drAmt, creditAmount: 0 },
            { accountId: crAccId, debitAmount: 0, creditAmount: crAmt },
          ],
          userId: MediStock.currentUser ? MediStock.currentUser.id : null,
        });

        if (res.success) {
          MediStock.closeModal();
          MediStock.toast(`Voucher ${res.voucherNumber} posted successfully! Equilibrium maintained.`, 'success');
          this.renderActiveTab();
        }
      } catch (err) {
        MediStock.toast(`Posting error: ${err.message}`, 'error');
      }
    });
  },
};
