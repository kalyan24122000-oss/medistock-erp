# MediStock ERP
## Complete Pharmacy Management Desktop ERP — Inspired by MARG ERP 9+

MediStock ERP is a professional, full-featured pharmacy management Windows desktop ERP that combines high-speed POS billing, batch-wise inventory tracking, purchase management, expiry control, double-entry accounting, GST reporting, compliance registers (Schedule H/H1), analytics, supplier management, and automated SQLite backup recovery.

---

## 1. Key Highlights & Architectural Strengths

- **High-Speed Keyboard Billing**: Inspired by the keyboard ergonomics of MARG ERP 9+ with modern styling. Every frequent action is bound to dedicated function keys (`F2` Search, `F3` Customer, `F8` Hold, `F9` Resume, `F12` Save & Print).
- **Persistent SQLite with WAL Mode**: Operates completely offline with atomic multi-table transactions, foreign keys enabled (`PRAGMA foreign_keys = ON`), `PRAGMA synchronous = NORMAL`, and WAL mode (`PRAGMA journal_mode = WAL`).
- **Exact Paise Precision**: Money is stored as integer paise to prevent IEEE 754 floating-point drift, ensuring invoice round-offs and double-entry trial balance equilibrium down to the exact paisa.
- **FEFO Inventory & Expiry Isolation**: Oldest non-expired batches are automatically suggested first. Expired stock is isolated from retail billing and routed to supplier debit returns.
- **Strict Double-Entry Bookkeeping**: Every posted transaction (sale, purchase, return, expense, manual voucher) posts balanced debits and credits (`Total Debits === Total Credits`). Unbalanced vouchers are rejected by the persistence layer.
- **Statutory Pharmacy Compliance**: Automatically logs dispensing of Schedule H, Schedule H1, and Narcotic drugs to statutory compliance registers for Drug Inspector audit.
- **Drug Recall & Batch Traceability**: Input any batch number to trace from which distributor it was purchased and every patient/customer invoice it was dispensed to.
- **Safe Online Backup & Restore**: Non-blocking SQLite online backup (`db.backup()`) with SHA-256 integrity hash verification and automatic `PRE_RESTORE` safety backups.

---

## 2. Technology Stack

- **Runtime**: Electron 45 (Windows Desktop x64)
- **UI Architecture**: HTML5, CSS3, Modern JavaScript with ES Modules
- **Security Boundary**: Electron `contextBridge` (`contextIsolation: true`, `nodeIntegration: false`)
- **Database Engine**: SQLite 3 with `better-sqlite3` driver
- **Spreadsheet Engine**: `xlsx` (SheetJS) for Excel and CSV import/export
- **Security & Auth**: `bcryptjs` salted password hashing with RBAC roles
- **Testing**: Built-in Node test runner (`node --test`)

---

## 3. Keyboard Shortcuts Reference

| Shortcut | Action | Operational Purpose |
| :--- | :--- | :--- |
| **`F2`** | **Medicine Search** | Focuses the global medicine search bar from anywhere to search brand, salt, or scan barcodes. |
| **`F3`** | **Select Customer** | Opens customer search modal or allows registering a new customer on the fly. |
| **`F4`** | **Batch Selector** | Opens the FEFO batch matrix for manual selection of expiry, rate, and pack sizes. |
| **`F8`** | **Hold Bill** | Saves the active draft bill to memory so another customer can be billed immediately. |
| **`F9`** | **Resume Bill** | Restores the held draft bill with all quantities and line calculations intact. |
| **`F10`** | **Payment Mode** | Focuses the payment mode selector (Cash, UPI, Card, Bank, Credit). |
| **`F12`** | **Save & Print** | Atomically commits invoice transaction, deducts stock, posts journal, and opens print dialog. |
| **`Esc`** | **Clear / Close** | Clears active auto-suggest dropdowns or closes open modal windows. |

---

## 4. Directory Structure

```
medistock-erp/
├── database/
│   ├── db.js                 # better-sqlite3 connection manager (WAL, foreign keys, pragmas)
│   ├── schema.js             # 43-table normalized schema with versioned migrations
│   └── seed.js               # Realistic Indian pharmacy seed catalog (Dolo, Augmentin, etc.)
├── main/
│   ├── index.js              # Electron main process, window management, IPC handlers
│   └── preload.js            # contextBridge API exposing validated domain calls to window.api
├── renderer/
│   ├── index.html            # Main HTML5 application shell & navigation sidebar
│   ├── css/
│   │   ├── app.css           # App layout, variables, typography, sidebar, topbar
│   │   ├── components.css    # Reusable cards, tables, badges, buttons, form controls, modals
│   │   ├── billing.css       # Dedicated POS high-speed billing grid and grand total panel
│   │   └── print.css         # 80mm thermal receipt and A4 tax invoice print layouts
│   └── js/
│       ├── app.js            # Master router, shortcuts, live clock, modal manager
│       └── views/            # Modular views (dashboard, billing, wholesale, purchase, etc.)
├── services/
│   ├── auth-service.js       # Authentication, password hashing, and user permissions
│   ├── numbering-service.js  # Transaction-safe sequential voucher number generator
│   ├── medicine-service.js   # Product catalog, barcode lookup, and salt compositions
│   ├── batch-service.js      # FEFO batch querying, valuation, and stock adjustments
│   ├── sales-service.js      # Atomic POS billing engine, stock deductions, double-entry vouchers
│   ├── purchase-service.js   # Purchase invoice entry, batch creation, and supplier ledger
│   ├── return-service.js     # Sales returns (with quarantine) and purchase returns
│   ├── party-service.js      # Customer and supplier profiles and credit limits
│   ├── accounting-service.js # Double-entry accounting, Trial Balance, P&L, Balance Sheet
│   ├── gst-service.js        # GSTR-1, GSTR-3B tax offset, and HSN summary registers
│   ├── compliance-service.js # Schedule H, Schedule H1, Narcotic registers, and batch recall
│   ├── report-service.js     # Analytics, dashboard KPIs, near-expiry, and auto-reorder levels
│   ├── backup-service.js     # Safe SQLite online backup, SHA-256 verification, and restore
│   └── export-service.js     # Excel and CSV spreadsheet export utilities
├── tests/
│   └── test-suite.test.js    # Automated unit and integration test suite (10 test suites)
└── package.json              # npm scripts and electron-builder Windows installer configs
```

---

## 5. Getting Started & Installation

### Prerequisites
- Windows 10/11 (or macOS / Linux for development)
- Node.js v20+ or v24+
- npm v10+

### Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Seed the database with realistic Indian medicines, manufacturers, batches, and chart of accounts:
   ```bash
   npm run seed
   ```
3. Run the automated test suite:
   ```bash
   npm test
   ```
4. Start the MediStock ERP desktop application:
   ```bash
   npm start
   ```

### Default Login Accounts
- **Administrator / Owner**: `admin` / `admin123`
- **Billing Operator / Cashier**: `cashier` / `cashier123`
- **Pharmacist**: `pharmacist` / `pharma123`

---

## 6. Verification and Test Results

The automated test suite (`tests/test-suite.test.js`) verifies the following critical transaction rules:
- **Math & Paise Precision**: Validates 12% GST calculation (split into 6% CGST + 6% SGST), line discounts, and whole-rupee invoice round-offs without float errors.
- **FEFO Batch Ordering**: Verifies oldest non-expired batches are sorted first.
- **Atomic Billing Engine**: Proves batch stock deduction, movement audit logging, and double-entry journal vouchers commit atomically.
- **Oversell Prevention**: Guarantees sales cannot exceed available batch quantity.
- **Expiry Barring**: Strictly prevents billing expired or blocked batches.
- **Compliance Logging**: Verifies Schedule H/H1 medicines write to statutory registers with doctor details.
- **Purchase Invoicing**: Verifies batch creation and supplier ledger updates.
- **Sales Returns**: Prevents returning more than invoiced, isolates stock in quarantine, and issues credit notes.
- **Double-Entry Equilibrium**: Rejects unbalanced vouchers and verifies Trial Balance balance (`Total Debits === Total Credits`).
- **Online Backup & Integrity**: Generates valid SQLite backups and 64-character SHA-256 checksums.

All 10 tests pass cleanly:
```
✔ 1. Math & Paise Calculation Precision
✔ 2. FEFO Batch Ordering (Oldest non-expired first)
✔ 3. Atomic POS Sales Billing with Stock & Double-Entry Accounting
✔ 4. Prevent Overselling and Negative Stock
✔ 5. Exclude Expired Stock from Normal Sales
✔ 6. Schedule H & H1 Compliance Logging
✔ 7. Purchase Invoicing & Supplier Ledger
✔ 8. Sales Return with Original Invoice Verification
✔ 9. Unbalanced Double-Entry Voucher Rejection
✔ 10. SQLite Online Backup and Integrity Verification
```

---

## 7. Packaging for Windows

To build a standalone Windows directory package:
```bash
npm run pack
```

To generate the full Windows installer (`.exe` via NSIS):
```bash
npm run dist
```
The installer will be generated in the `dist/` directory.
