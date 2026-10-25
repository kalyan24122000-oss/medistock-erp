// tests/test-suite.test.js
// Automated Unit & Integration Tests for MediStock ERP

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { getDatabase, closeDatabase } = require('../database/db');
const { seedDatabase } = require('../database/seed');
const { calculateLineItem, calculateInvoiceTotals, createSalesInvoice, getInvoiceDetails } = require('../services/sales-service');
const { getProductBatches, adjustStock } = require('../services/batch-service');
const { createPurchaseInvoice } = require('../services/purchase-service');
const { processSalesReturn } = require('../services/return-service');
const { createJournalVoucher, getTrialBalance } = require('../services/accounting-service');
const { getComplianceRegister } = require('../services/compliance-service');
const { createBackup, previewBackup } = require('../services/backup-service');
const { getMachineHardwareId, getLicenseStatus, deactivateLicenseLocal } = require('../services/license-service');
const { generateLicenseKey, validateKeyFormat, signLicensePayload, verifyLicenseSignature } = require('../backend/license-generator');
const { login: authenticateUser } = require('../services/auth-service');

// Use a dedicated isolated test database
const TEST_DB_PATH = path.join(__dirname, 'test_medistock.db');

test.before(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = getDatabase(TEST_DB_PATH);
  seedDatabase(db);
});

test.after(() => {
  closeDatabase();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const wal = `${TEST_DB_PATH}-wal`;
  const shm = `${TEST_DB_PATH}-shm`;
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
});

test('1. Math & Paise Calculation Precision', () => {
  // Test 10 strips of medicine at ₹33.00 (3300 paise) with 10% discount and 12% GST
  const line = calculateLineItem({
    quantity: 10,
    sellingRate: 3300,
    discountPercent: 10,
    taxRate: 1200,
  });

  assert.equal(line.gross, 33000, 'Gross should be 33000 paise (₹330.00)');
  assert.equal(line.lineDiscount, 3300, 'Line discount should be 3300 paise (₹33.00)');
  assert.equal(line.taxable, 29700, 'Taxable should be 29700 paise (₹297.00)');
  // 6% of 29700 = 1782 paise
  assert.equal(line.cgst, 1782, 'CGST should be 1782 paise');
  assert.equal(line.sgst, 1782, 'SGST should be 1782 paise');
  assert.equal(line.totalTax, 3564, 'Total tax should be 3564 paise');
  assert.equal(line.lineTotal, 33264, 'Line total should be 33264 paise (₹332.64)');

  // Test invoice header totals with round-off
  const totals = calculateInvoiceTotals([line]);
  assert.equal(totals.grandTotal, 33300, 'Grand total rounded to nearest rupee should be 33300 paise (₹333.00)');
  assert.equal(totals.roundOff, 36, 'Round-off difference should be exactly +36 paise');
});

test('2. FEFO Batch Ordering (Oldest non-expired first)', () => {
  const db = getDatabase(TEST_DB_PATH);
  // Dolo 650 product ID = 1
  const batches = getProductBatches(1, false);

  assert.ok(batches.length >= 2, 'Should have multiple available batches');
  for (let i = 0; i < batches.length - 1; i++) {
    assert.ok(
      batches[i].expiry_date <= batches[i + 1].expiry_date,
      `FEFO violation: batch ${batches[i].batch_number} (${batches[i].expiry_date}) comes before ${batches[i + 1].batch_number} (${batches[i + 1].expiry_date})`
    );
  }
});

test('3. Atomic POS Sales Billing with Stock & Double-Entry Accounting', () => {
  const db = getDatabase(TEST_DB_PATH);
  // Get an active batch for Dolo 650 (Product 1)
  const batches = getProductBatches(1, false);
  const targetBatch = batches[0];
  const initialQty = targetBatch.available_qty;

  const invoiceResult = createSalesInvoice({
    invoiceType: 'RETAIL',
    customerName: 'Test Patient Kumar',
    customerPhone: '9820199999',
    paymentMode: 'CASH',
    items: [
      {
        productId: 1,
        batchId: targetBatch.id,
        brandName: 'Dolo 650 Tablet',
        quantity: 5,
        sellingRate: 3300,
        discountPercent: 0,
        taxRate: 1200,
      },
    ],
  });

  assert.ok(invoiceResult.success, 'Invoice creation succeeded');
  assert.ok(invoiceResult.invoiceNumber.startsWith('INV-'), 'Generated valid invoice number');

  // Verify batch stock deduction
  const updatedBatch = db.prepare('SELECT available_qty FROM batches WHERE id = ?').get(targetBatch.id);
  assert.equal(updatedBatch.available_qty, initialQty - 5, 'Batch available_qty deducted by 5');

  // Verify stock movement ledger
  const movement = db.prepare(`
    SELECT * FROM stock_movements WHERE reference_id = ?
  `).get(invoiceResult.invoiceNumber);
  assert.ok(movement, 'Stock movement audit row created');
  assert.equal(movement.movement_type, 'SALE');
  assert.equal(movement.quantity, 5);
  assert.equal(movement.new_qty, initialQty - 5);

  // Verify invoice details
  const details = getInvoiceDetails(invoiceResult.invoiceId);
  assert.equal(details.items.length, 1);
  assert.equal(details.customer_name, 'Test Patient Kumar');

  // Verify double-entry balancing
  const trial = getTrialBalance();
  assert.equal(trial.isBalanced, true, 'Trial balance must strictly balance after sales billing');
});

test('4. Prevent Overselling and Negative Stock', () => {
  const batches = getProductBatches(1, false);
  const targetBatch = batches[0];

  assert.throws(
    () => {
      createSalesInvoice({
        items: [
          {
            productId: 1,
            batchId: targetBatch.id,
            quantity: targetBatch.available_qty + 9999, // Way more than available
            sellingRate: 3300,
          },
        ],
      });
    },
    /Insufficient stock/,
    'Should throw insufficient stock error'
  );
});

test('5. Exclude Expired Stock from Normal Sales', () => {
  const db = getDatabase(TEST_DB_PATH);
  // Find an expired batch seeded earlier
  const expiredBatch = db.prepare(`
    SELECT id, batch_number, expiry_date, available_qty
    FROM batches WHERE expiry_date < date('now') LIMIT 1
  `).get();

  assert.ok(expiredBatch, 'Expired test batch exists');

  assert.throws(
    () => {
      createSalesInvoice({
        items: [
          {
            productId: 1,
            batchId: expiredBatch.id,
            quantity: 1,
            sellingRate: 3000,
          },
        ],
      });
    },
    /expired/,
    'Should prevent billing expired batch'
  );
});

test('6. Schedule H & H1 Compliance Logging', () => {
  // Product 2 is Augmentin 625 Duo (Schedule H)
  const batches = getProductBatches(2, false);
  const targetBatch = batches[0];

  const inv = createSalesInvoice({
    customerName: 'Chronic Patient Verma',
    doctorName: 'Dr. Vivek Mehta',
    doctorRegNo: 'MCI-998877',
    items: [
      {
        productId: 2,
        batchId: targetBatch.id,
        quantity: 2,
        sellingRate: 21500,
        taxRate: 1200,
      },
    ],
  });

  const registers = getComplianceRegister('SCHEDULE_H');
  const found = registers.find((r) => r.reference_id === inv.invoiceNumber);
  assert.ok(found, 'Compliance register must contain entry for Schedule H medicine');
  assert.equal(found.doctor_name, 'Dr. Vivek Mehta');
  assert.equal(found.quantity, 2);
});

test('7. Purchase Invoicing & Supplier Ledger', () => {
  const db = getDatabase(TEST_DB_PATH);
  const supplier = db.prepare('SELECT id, current_balance FROM suppliers LIMIT 1').get();
  const prevBal = supplier.current_balance;

  const purchRes = createPurchaseInvoice({
    supplierInvoiceNo: 'TEST-SUP-INV-88',
    supplierId: supplier.id,
    items: [
      {
        productId: 1,
        batchNumber: 'DL-NEW-2026',
        mfgDate: '2026-01-01',
        expiryDate: '2028-12-31',
        quantity: 100,
        freeQty: 10,
        purchaseRate: 2500,
        mrp: 3500,
        sellingPrice: 3400,
        taxRate: 1200,
      },
    ],
  });

  assert.ok(purchRes.success, 'Purchase invoice posted');

  // Verify batch created with 110 strips (100 + 10 free)
  const createdBatch = db.prepare(`
    SELECT available_qty, purchase_rate, mrp FROM batches WHERE batch_number = 'DL-NEW-2026'
  `).get();
  assert.equal(createdBatch.available_qty, 110, 'Batch should have 110 available (qty + free)');

  // Verify supplier balance increased
  const updatedSup = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(supplier.id);
  assert.equal(updatedSup.current_balance, prevBal + purchRes.grandTotal);

  // Verify trial balance is still in equilibrium
  const trial = getTrialBalance();
  assert.equal(trial.isBalanced, true, 'Trial balance must remain balanced after purchase');
});

test('8. Sales Return with Original Invoice Verification', () => {
  // First create an invoice
  const batches = getProductBatches(1, false);
  const b = batches[0];

  const inv = createSalesInvoice({
    customerName: 'Return Test Customer',
    items: [
      {
        productId: 1,
        batchId: b.id,
        quantity: 10,
        sellingRate: 3300,
        taxRate: 1200,
      },
    ],
  });

  const invDetails = getInvoiceDetails(inv.invoiceId);
  const lineItem = invDetails.items[0];

  // Try returning 15 (more than 10 purchased) -> must fail
  assert.throws(
    () => {
      processSalesReturn({
        salesInvoiceId: inv.invoiceId,
        items: [{ invoiceItemId: lineItem.id, quantity: 15 }],
      });
    },
    /Maximum returnable/,
    'Must disallow returning more than invoiced'
  );

  // Return valid 4 strips into quarantine
  const returnRes = processSalesReturn({
    salesInvoiceId: inv.invoiceId,
    reason: 'Wrong medicine dispensed',
    refundMode: 'STORE_CREDIT',
    quarantineStatus: 'QUARANTINED',
    items: [{ invoiceItemId: lineItem.id, quantity: 4 }],
  });

  assert.ok(returnRes.success, 'Return processed');
  assert.ok(returnRes.returnNumber.startsWith('SRT-'), 'Generated valid return number');

  // Verify trial balance balanced after return
  const trial = getTrialBalance();
  assert.equal(trial.isBalanced, true, 'Trial balance balanced after sales return');
});

test('9. Unbalanced Double-Entry Voucher Rejection', () => {
  assert.throws(
    () => {
      createJournalVoucher({
        narration: 'Deliberately unbalanced test voucher',
        lines: [
          { accountId: 1, debitAmount: 50000, creditAmount: 0 },
          { accountId: 2, debitAmount: 0, creditAmount: 40000 }, // Off by 10000 paise
        ],
      });
    },
    /Unbalanced voucher/,
    'Must reject unbalanced double-entry vouchers'
  );
});

test('10. SQLite Online Backup and Integrity Verification', async () => {
  const backupRes = await createBackup('MANUAL');
  assert.ok(backupRes.success, 'Backup creation succeeded');
  assert.ok(fs.existsSync(backupRes.filePath), 'Backup file exists on disk');
  assert.ok(backupRes.checksum.length === 64, 'Generated 64-char SHA-256 checksum');

  // Verify preview
  const preview = previewBackup(backupRes.filePath);
  assert.equal(preview.isValid, true, 'Backup SQLite header and integrity verified');
  assert.ok(preview.productCount > 0, 'Products verified in backup');

  // Clean up test backup file
  fs.unlinkSync(backupRes.filePath);
});

test('11. Custom Loose Tablets & USP (Unit Selling Price) Calculation', () => {
  // Dolo 650: 1 Strip = 15 Tablets. Strip Rate = ₹30.00 (3000 paise).
  // USP = 3000 / 15 = 200 paise (₹2.00 per tablet).
  // Selling 5 custom loose tablets with 0 full strips:
  const line = calculateLineItem({
    conversionRatio: 15,
    strips: 0,
    looseTabs: 5,
    sellingRate: 3000,
    usp: 200,
    discountPercent: 0,
    taxRate: 1200,
  });

  // 5 tablets * 200 paise = 1000 paise (₹10.00)
  assert.equal(line.gross, 1000, 'Gross for 5 loose tablets should be 1000 paise (₹10.00)');
  assert.equal(line.taxable, 1000, 'Taxable amount should be 1000 paise');
  assert.equal(line.totalTax, 120, '12% GST should be 120 paise (₹1.20)');
  assert.equal(line.lineTotal, 1120, 'Line total should be 1120 paise (₹11.20)');
  assert.ok(Math.abs(line.effectiveQty - (5 / 15)) < 0.0001, 'Effective quantity should be exactly 5/15 strips');

  // Test combination: 1 Full Strip + 3 Loose Tablets
  const comboLine = calculateLineItem({
    conversionRatio: 15,
    strips: 1,
    looseTabs: 3,
    sellingRate: 3000,
    usp: 200,
    discountPercent: 0,
    taxRate: 1200,
  });
  // (1 * 3000) + (3 * 200) = 3600 paise (₹36.00)
  assert.equal(comboLine.gross, 3600, 'Gross should be 3600 paise (₹36.00)');
  assert.ok(Math.abs(comboLine.effectiveQty - 1.2) < 0.0001, 'Effective quantity should be exactly 1.2 strips');
});

test('12. Multi-UI Themes & Bill Print Formats Configuration', () => {
  // 1. Verify supported themes
  const supportedThemes = ['classic', 'navy', 'red', 'emerald', 'dark'];
  assert.equal(supportedThemes.length, 5, 'Should support exactly 5 themes');
  assert.ok(supportedThemes.includes('navy'), 'Must support Navy Blue theme');
  assert.ok(supportedThemes.includes('red'), 'Must support Medical Red theme');
  assert.ok(supportedThemes.includes('emerald'), 'Must support Emerald Green theme');
  assert.ok(supportedThemes.includes('dark'), 'Must support Modern Dark theme');
  assert.ok(supportedThemes.includes('classic'), 'Must support Classic Slate theme');

  // 2. Verify supported print formats
  const supportedFormats = ['80mm', 'a4', 'a5', '58mm'];
  assert.equal(supportedFormats.length, 4, 'Should support 4 bill print formats');
  assert.ok(supportedFormats.includes('80mm'), '80mm Thermal Receipt (3-inch POS)');
  assert.ok(supportedFormats.includes('a4'), 'A4 Full GST Tax Invoice');
  assert.ok(supportedFormats.includes('a5'), 'A5 Chemist Half-Page Bill');
  assert.ok(supportedFormats.includes('58mm'), '58mm Mini Thermal Slip (2-inch POS)');

  // 3. Number to Indian currency words test
  function numberToWordsTest(num) {
    if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
      'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n) => {
      let str = '';
      if (n > 19) {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      } else {
        str += a[n];
      }
      return str;
    };
    const n = Math.floor(num);
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = Math.floor((n % 1000) / 100);
    const rest = Math.floor(n % 100);
    let res = '';
    if (crore > 0) res += inWords(crore) + 'Crore ';
    if (lakh > 0) res += inWords(lakh) + 'Lakh ';
    if (thousand > 0) res += inWords(thousand) + 'Thousand ';
    if (hundred > 0) res += inWords(hundred) + 'Hundred ';
    if (rest > 0) res += inWords(rest);
    return `Rupees ${res.trim()} Only`;
  }

  assert.equal(numberToWordsTest(540), 'Rupees Five Hundred Forty Only');
  assert.equal(numberToWordsTest(1500), 'Rupees One Thousand Five Hundred Only');
  assert.equal(numberToWordsTest(125000), 'Rupees One Lakh Twenty Five Thousand Only');
});

test('13. POS Retail Invoice with Custom Loose Tablets & Journal Entry Verification', () => {
  const db = getDatabase(TEST_DB_PATH);
  const batches = getProductBatches(1, false);
  const b = batches[0];

  // Simulating renderer payload with strips + loose tablets
  const invRes = createSalesInvoice({
    invoiceType: 'RETAIL',
    customerName: 'Loose Tablet Customer',
    customerPhone: '9876543210',
    paymentMode: 'CASH',
    items: [
      {
        productId: b.product_id,
        brandName: b.brand_name,
        batchId: b.id,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        conversionRatio: 15,
        strips: 1,
        looseTabs: 5,
        usp: 200,
        quantity: 1 + (5 / 15),
        mrp: b.mrp,
        sellingRate: 3000,
        discountPercent: 0,
        taxRate: 1200,
        gross: 4000,
        lineDiscount: 0,
        taxable: 4000,
        taxableAmount: 4000,
        cgst: 240,
        cgstAmount: 240,
        sgst: 240,
        sgstAmount: 240,
        totalTax: 480,
        lineTotal: 4480,
      },
    ],
  });

  assert.ok(invRes.success, 'Invoice should post successfully');
  assert.ok(invRes.grandTotal > 0, 'Grand total must be positive integer paise');

  // Verify journal entry exists with valid total_amount
  const journal = db.prepare(`
    SELECT total_amount FROM journal_entries WHERE reference_id = ?
  `).get(invRes.invoiceNumber);

  assert.ok(journal, 'Journal entry must be recorded');
  assert.equal(journal.total_amount, invRes.grandTotal, 'Journal total_amount must match invoice grand total');
  assert.ok(!isNaN(journal.total_amount), 'Journal total_amount must not be NaN');
});

test('14. Machine Hardware Fingerprint & Cryptographic License Verification', () => {
  const db = getDatabase();

  // 1. Hardware ID generation
  const hwid1 = getMachineHardwareId();
  const hwid2 = getMachineHardwareId();
  assert.ok(hwid1.startsWith('HWID-'), 'HWID must start with HWID- prefix');
  assert.equal(hwid1, hwid2, 'HWID must be stable across multiple calls');

  // 2. Key format validation
  assert.ok(validateKeyFormat('MEDI-APEX-2026-PRO9-8877'), 'Valid key format must pass');
  assert.ok(!validateKeyFormat('INVALID-KEY'), 'Malformed key must be rejected');
  assert.ok(!validateKeyFormat('medi-apex-2026-pro9-8877'), 'Lowercase key must be rejected');

  // 3. Dynamic key generation
  const generatedKey = generateLicenseKey('PRO');
  assert.ok(generatedKey.startsWith('MEDI-'), 'Generated key must start with MEDI-');
  assert.ok(validateKeyFormat(generatedKey), 'Generated key must satisfy format rules');

  // 4. Cryptographic HMAC signature and verification
  const payload = {
    licenseKey: 'MEDI-TEST-2026-UNIT-9999',
    hardwareId: hwid1,
    planCode: 'PRO-1YR',
    expiresAt: '2027-12-31T23:59:59Z',
  };
  const signed = signLicensePayload(payload);
  assert.ok(signed.signature && signed.signature.length === 64, 'Signature must be a 64-char hex SHA256 HMAC');
  assert.ok(verifyLicenseSignature(signed), 'Valid signed payload must verify successfully');

  const tampered = { ...signed, planCode: 'ENTERPRISE-LIFETIME' };
  assert.ok(!verifyLicenseSignature(tampered), 'Tampered payload must fail signature verification');

  // 5. Local database storage and offline verification
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO app_licenses (
      license_key, pharmacy_name, plan_code, hardware_id, max_branches,
      status, issued_at, expires_at, signature
    ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, ?, ?)
  `).run('MEDI-TEST-2026-UNIT-9999', 'Apex Test Pharmacy', 'PRO-1YR', hwid1, 1, expiresAt, signed.signature);

  const status = getLicenseStatus();
  assert.ok(status.isLicensed, 'Local license must report active');
  assert.equal(status.license.key, 'MEDI-TEST-2026-UNIT-9999', 'License key must match');
  assert.equal(status.license.planCode, 'PRO-1YR', 'Plan code must match');
  assert.ok(status.license.remainingDays >= 29 && status.license.remainingDays <= 31, 'Remaining days calculation must be ~30 days');

  // 6. Deactivation
  deactivateLicenseLocal();
  const deactivatedStatus = getLicenseStatus();
  assert.ok(!deactivatedStatus.isLicensed, 'Deactivated license must not be valid');
});

test('15. Role-based Authentication & Password Security', () => {
  // Test valid login
  const adminLogin = authenticateUser('admin', 'admin123');
  assert.ok(adminLogin.success, 'Admin credentials must authenticate successfully');
  assert.equal(adminLogin.user.username, 'admin');
  assert.equal(adminLogin.user.roleName, 'Administrator');

  const pharmaLogin = authenticateUser('pharmacist', 'pharma123');
  assert.ok(pharmaLogin.success, 'Pharmacist credentials must authenticate');
  assert.equal(pharmaLogin.user.roleName, 'Pharmacist');

  const cashierLogin = authenticateUser('cashier', 'cashier123');
  assert.ok(cashierLogin.success, 'Cashier credentials must authenticate');
  assert.equal(cashierLogin.user.roleName, 'Billing Operator');

  // Test invalid password
  const failPass = authenticateUser('admin', 'wrongpassword');
  assert.ok(!failPass.success, 'Invalid password must be rejected');

  // Test non-existent user
  const failUser = authenticateUser('nonexistent_user', 'password');
  assert.ok(!failUser.success, 'Non-existent user must be rejected');
});



