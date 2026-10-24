// renderer/js/views/about.js
// Keyboard Shortcuts Guide, Technical Architecture & System Information

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.about = {
  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">ℹ️ Help, Keyboard Shortcuts & System Blueprint</div>
          <span class="badge info">MediStock ERP v1.0.0</span>
        </div>

        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 18px; border-radius: var(--radius); margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #38bdf8; margin-bottom: 4px;">MEDISTOCK PHARMACY ERP</h3>
          <p style="font-size: 12.5px; color: #cbd5e1; max-width: 800px; line-height: 1.4;">
            High-speed, offline-first Windows Desktop Pharmacy Management ERP inspired by the operational keyboard ergonomics of MARG ERP 9+, engineered with modern Electron desktop runtime, isolated contextBridge security, transactional SQLite WAL database, and strict double-entry accounting.
          </p>
        </div>

        <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin-bottom: 10px;">⚡ High-Speed Keyboard Shortcuts Cheat Sheet:</h4>
        <div class="table-container" style="margin-bottom: 20px;">
          <table class="erp-table">
            <thead>
              <tr>
                <th style="width: 140px;">Shortcut Key</th>
                <th style="width: 220px;">Action</th>
                <th>Context / Operational Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F2</kbd></td><td><strong>Medicine Search</strong></td><td>Focuses global medicine search bar from anywhere to immediately type brand/salt or scan barcode.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F3</kbd></td><td><strong>Select Customer</strong></td><td>Opens customer search modal or allows creating a new patient record on the fly.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F4</kbd></td><td><strong>Batch Selector</strong></td><td>Inspects all batches for selected medicine and enables manual batch selection.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F8</kbd></td><td><strong>Hold Bill</strong></td><td>Saves currently active customer draft bill to memory so another customer can be served.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F9</kbd></td><td><strong>Resume Bill</strong></td><td>Restores previously held customer bill to the billing table with all quantities and rates intact.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F10</kbd></td><td><strong>Payment Mode</strong></td><td>Focuses payment mode dropdown (Cash / UPI / Card / Credit).</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">F12</kbd></td><td><strong>Save & Print</strong></td><td>Atomically deducts batch stock, records audit movements, posts double-entry vouchers, and opens print receipt.</td></tr>
              <tr><td><kbd style="background: #334155; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Esc</kbd></td><td><strong>Clear / Close</strong></td><td>Clears active search suggestions or closes open modal dialogs.</td></tr>
            </tbody>
          </table>
        </div>

        <h4 style="font-size: 13.5px; font-weight: 700; color: #0284c7; margin-bottom: 10px;">🛠️ Technical Architecture & Stack:</h4>
        <div class="table-container">
          <table class="erp-table">
            <tbody>
              <tr><td><strong>Platform Runtime:</strong></td><td>Electron Windows Desktop Application (Chromium + Node.js 24)</td></tr>
              <tr><td><strong>Security Boundary:</strong></td><td>ContextBridge with isolated contextIsolation: true, nodeIntegration: false</td></tr>
              <tr><td><strong>Database Engine:</strong></td><td>SQLite 3 with WAL Mode, Foreign Keys strict enforcement, Synchronous Normal</td></tr>
              <tr><td><strong>Accounting Standard:</strong></td><td>Double-Entry Bookkeeping with atomicity guarantee (Total Dr === Total Cr)</td></tr>
              <tr><td><strong>Monetary Storage:</strong></td><td>Exact Integer Paise to prevent IEEE 754 floating-point drift</td></tr>
              <tr><td><strong>Inventory Policy:</strong></td><td>First Expiry First Out (FEFO) with automatic expired-stock quarantine</td></tr>
              <tr><td><strong>Compliance Registers:</strong></td><td>Statutory Schedule H, Schedule H1, and Narcotic Registers under Indian Drugs & Cosmetics Act</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};
