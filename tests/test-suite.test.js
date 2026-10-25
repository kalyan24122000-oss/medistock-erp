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
