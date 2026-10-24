// services/purchase-service.js
// Purchase Orders, Goods Receipt, and Purchase Invoices with Batch Ingestion & Accounting

const { getDatabase } = require('../database/db');
const { getNextVoucherNumber } = require('./numbering-service');

/**
 * Creates and posts a Purchase Invoice.
 * Ingests new or existing batches, updates available stock, records movement audit trail,
 * updates supplier balance, and creates double-entry journal vouchers.
 *
 * @param {object} purchaseData
 */
function createPurchaseInvoice(purchaseData) {
  const db = getDatabase();

  const {
    supplierInvoiceNo,
    invoiceDate = new Date().toISOString().split('T')[0],
    supplierId,
    branchId = null,
    financialYearId = null,
    items = [],
    dueDate = null,
    notes = null,
    userId = null,
    isPaid = false,
    paymentMode = 'CASH',
  } = purchaseData;

  if (!supplierId) {
    throw new Error('Supplier is required');
  }
  if (!items || items.length === 0) {
    throw new Error('Purchase invoice must contain at least one item');
  }

  return db.transaction(() => {
    let subtotal = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalQty = 0;
    let totalFreeQty = 0;

    // Precalculate totals
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const freeQty = Number(it.freeQty) || 0;
      const rate = Number(it.purchaseRate) || 0;
      const discPercent = Number(it.discountPercent) || 0;
      const taxRateBp = Number(it.taxRate) || 1200;

      const gross = Math.round(qty * rate);
      const discountAmt = Math.round((gross * discPercent) / 100);
      const taxable = Math.max(0, gross - discountAmt);

      const halfTaxBp = taxRateBp / 2;
      const cgst = Math.round((taxable * halfTaxBp) / 10000);
      const sgst = Math.round((taxable * halfTaxBp) / 10000);

      it.taxableAmount = taxable;
      it.cgstAmount = cgst;
      it.sgstAmount = sgst;
      it.igstAmount = 0;
      it.lineTotal = taxable + cgst + sgst;

      subtotal += gross;
      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalQty += qty;
      totalFreeQty += freeQty;
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const unroundedTotal = totalTaxable + totalTax;
    const grandTotal = Math.round(unroundedTotal / 100) * 100;
    const roundOff = grandTotal - unroundedTotal;

    // Generate unique internal purchase invoice number
    const invoiceNumber = getNextVoucherNumber(db, 'PURCHASE', branchId, financialYearId);

    // Insert purchase invoice header
    const invRes = db.prepare(`
      INSERT INTO purchase_invoices (
        invoice_number, supplier_invoice_no, invoice_date, supplier_id, branch_id,
        financial_year_id, total_items, total_qty, total_free_qty, subtotal,
        discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, paid_amount, payment_status, due_date, notes, user_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        0, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      invoiceNumber, supplierInvoiceNo || null, invoiceDate, supplierId, branchId || null,
      financialYearId || null, items.length, totalQty, totalFreeQty, subtotal,
      totalTaxable, totalCgst, totalSgst, totalIgst,
      totalTax, roundOff, grandTotal, isPaid ? grandTotal : 0,
      isPaid ? 'PAID' : 'UNPAID', dueDate || null, notes || null, userId || null
    );

    const purchaseInvoiceId = invRes.lastInsertRowid;

    // Prepared statements for batch handling
    const findBatchStmt = db.prepare(`
      SELECT id, available_qty, initial_qty FROM batches
      WHERE product_id = ? AND batch_number = ?
    `);

    const insertBatchStmt = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiry_date,
        purchase_rate, mrp, selling_price, initial_qty, available_qty,
        rack_location, supplier_id, purchase_invoice_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const updateBatchStmt = db.prepare(`
      UPDATE batches
      SET available_qty = available_qty + ?,
          initial_qty = initial_qty + ?,
          purchase_rate = ?, mrp = ?, selling_price = ?,
          expiry_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertPurchItemStmt = db.prepare(`
      INSERT INTO purchase_invoice_items (
        purchase_invoice_id, product_id, batch_number, mfg_date, expiry_date,
        quantity, free_qty, unit, purchase_rate, mrp, selling_price,
        discount_percent, taxable_amount, tax_rate, cgst_amount, sgst_amount, igst_amount, line_total
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, 'PURCHASE', 'PURCHASE_INVOICE', ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    // Process line items & ingest batches
    for (const it of items) {
      const totalBatchQty = (Number(it.quantity) || 0) + (Number(it.freeQty) || 0);
      const batchNum = (it.batchNumber || '').trim().toUpperCase();
      if (!batchNum) {
        throw new Error('Batch number is required for all purchase items');
      }
      if (!it.expiryDate) {
        throw new Error(`Expiry date is required for batch ${batchNum}`);
      }

      let batchId = null;
      let prevQty = 0;
      let newQty = totalBatchQty;

      const existingBatch = findBatchStmt.get(it.productId, batchNum);
      if (existingBatch) {
        batchId = existingBatch.id;
        prevQty = existingBatch.available_qty;
        newQty = prevQty + totalBatchQty;
        updateBatchStmt.run(
          totalBatchQty, totalBatchQty, it.purchaseRate, it.mrp, it.sellingPrice,
          it.expiryDate, batchId
        );
      } else {
        const newBatchRes = insertBatchStmt.run(
          it.productId, batchNum, it.mfgDate || null, it.expiryDate,
          it.purchaseRate, it.mrp, it.sellingPrice, totalBatchQty, totalBatchQty,
          it.rackLocation || 'MAIN-STORE', supplierId, purchaseInvoiceId
        );
        batchId = newBatchRes.lastInsertRowid;
      }

      // Record in purchase_invoice_items
      insertPurchItemStmt.run(
        purchaseInvoiceId, it.productId, batchNum, it.mfgDate || null, it.expiryDate,
        it.quantity, it.freeQty || 0, it.unit || 'Box', it.purchaseRate, it.mrp, it.sellingPrice,
        it.discountPercent || 0, it.taxableAmount, it.taxRate || 1200,
        it.cgstAmount, it.sgstAmount, it.igstAmount, it.lineTotal
      );

      // Audit movement
      insertMovementStmt.run(
        batchId, it.productId, invoiceNumber,
        totalBatchQty, it.unit || 'Strip', prevQty, newQty, it.purchaseRate,
        `Purchased via Bill ${invoiceNumber} (Supplier: ${supplierInvoiceNo || 'Direct'})`,
        userId || null, branchId || null
      );
    }

    // POST BALANCED DOUBLE-ENTRY ACCOUNTING VOUCHER
    const purchaseAcc = db.prepare("SELECT id FROM accounts WHERE code = '5020'").get();
    const inputCgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '1050'").get();
    const inputSgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '1055'").get();
    const creditorsAcc = db.prepare("SELECT id FROM accounts WHERE code = '2010'").get();
    const cashAcc = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const bankAcc = db.prepare("SELECT id FROM accounts WHERE code = '1020'").get();

    const jVoucherNum = getNextVoucherNumber(db, 'JOURNAL', branchId, financialYearId);
    const jRes = db.prepare(`
      INSERT INTO journal_entries (
        voucher_number, voucher_type, entry_date, reference_id, narration,
        branch_id, financial_year_id, total_amount, user_id
      ) VALUES (
        ?, 'PURCHASE', ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      jVoucherNum, invoiceDate, invoiceNumber, `Purchase Bill ${invoiceNumber} / ${supplierInvoiceNo || ''}`,
      branchId || null, financialYearId || null, grandTotal, userId || null
    );
    const journalId = jRes.lastInsertRowid;

    const insertJLine = db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, narration)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Debit side: Purchases + Input Taxes
    const netPurchDebit = totalTaxable + roundOff;
    insertJLine.run(journalId, purchaseAcc.id, netPurchDebit, 0, `Purchase stock value for ${invoiceNumber}`);
    if (totalCgst > 0) insertJLine.run(journalId, inputCgstAcc.id, totalCgst, 0, `Input CGST on ${invoiceNumber}`);
    if (totalSgst > 0) insertJLine.run(journalId, inputSgstAcc.id, totalSgst, 0, `Input SGST on ${invoiceNumber}`);

    // Credit side: Supplier Payable (or Bank/Cash if paid immediately)
    if (isPaid) {
      const payAccountId = paymentMode === 'BANK_TRANSFER' ? bankAcc.id : cashAcc.id;
      insertJLine.run(journalId, payAccountId, 0, grandTotal, `Direct payment for purchase ${invoiceNumber}`);
    } else {
      insertJLine.run(journalId, creditorsAcc.id, 0, grandTotal, `Payable to supplier for ${invoiceNumber}`);
      // Update supplier balance
      db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(grandTotal, supplierId);
    }

    return {
      success: true,
      purchaseInvoiceId,
      invoiceNumber,
      grandTotal,
    };
  })();
}

/**
 * List recent purchases.
 */
function listPurchaseInvoices(filter = {}) {
  const db = getDatabase();
  const { search, fromDate, toDate, limit = 50, offset = 0 } = filter;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ` AND (pi.invoice_number LIKE ? OR pi.supplier_invoice_no LIKE ? OR s.name LIKE ?)`;
    const pat = `%${search.trim()}%`;
    params.push(pat, pat, pat);
  }
  if (fromDate) {
    where += ` AND pi.invoice_date >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    where += ` AND pi.invoice_date <= ?`;
    params.push(toDate);
  }

  const countQuery = `
    SELECT COUNT(1) as total
    FROM purchase_invoices pi
    JOIN suppliers s ON pi.supplier_id = s.id
    ${where}
  `;
  const total = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT pi.*, s.name as supplier_name, s.gstin as supplier_gstin
    FROM purchase_invoices pi
    JOIN suppliers s ON pi.supplier_id = s.id
    ${where}
    ORDER BY pi.id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);
  const rows = db.prepare(dataQuery).all(...params);

  return { rows, total };
}

module.exports = {
  createPurchaseInvoice,
  listPurchaseInvoices,
};
