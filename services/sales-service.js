// services/sales-service.js
// POS Retail & Wholesale Billing Engine with Atomic Transactions,
// Real-time Batch Allocation, Accounting Posting, and Compliance Integration

const { getDatabase } = require('../database/db');
const { getNextVoucherNumber } = require('./numbering-service');

/**
 * Calculates a single invoice line item with exact paise precision.
 * @param {object} item
 * @param {number} item.quantity - E.g. 2 strips or 0.5 (loose)
 * @param {number} item.sellingRate - In paise (e.g. ₹33.00 = 3300)
 * @param {number} [item.discountPercent=0]
 * @param {number} [item.taxRate=1200] - Basis points (1200 = 12.00%)
 * @param {number} [item.mrp=0] - In paise
 */
function calculateLineItem(item) {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.sellingRate) || 0;
  const discPercent = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
  const taxRateBp = Number(item.taxRate) || 1200; // 12% default

  // Base gross before discount
  const gross = Math.round(qty * rate);
  // Discount amount in paise
  const lineDiscount = Math.round((gross * discPercent) / 100);
  const taxable = Math.max(0, gross - lineDiscount);

  // Split into CGST and SGST (half each for intra-state)
  const halfTaxBp = taxRateBp / 2;
  const cgst = Math.round((taxable * halfTaxBp) / 10000);
  const sgst = Math.round((taxable * halfTaxBp) / 10000);
  const igst = 0; // Local intra-state default
  const totalTax = cgst + sgst;
  const lineTotal = taxable + totalTax;

  return {
    gross,
    lineDiscount,
    taxable,
    taxRate: taxRateBp,
    cgst,
    sgst,
    igst,
    totalTax,
    lineTotal,
  };
}

/**
 * Calculates invoice header totals from all line items.
 */
function calculateInvoiceTotals(items, invoiceDiscountPercent = 0, invoiceDiscountAmount = 0) {
  let subtotal = 0;
  let totalLineDiscounts = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalQty = 0;

  for (const it of items) {
    const calc = it.lineTotal !== undefined ? it : calculateLineItem(it);
    subtotal += calc.gross;
    totalLineDiscounts += calc.lineDiscount;
    taxableAmount += calc.taxable;
    cgstAmount += calc.cgst;
    sgstAmount += calc.sgst;
    igstAmount += calc.igst;
    totalQty += Number(it.quantity) || 0;
  }

  // Header level discount
  let headerDiscount = Number(invoiceDiscountAmount) || 0;
  if (invoiceDiscountPercent > 0) {
    headerDiscount += Math.round((taxableAmount * invoiceDiscountPercent) / 100);
  }

  const netTaxable = Math.max(0, taxableAmount - headerDiscount);
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const unroundedTotal = netTaxable + totalTax;

  // Round off to nearest whole rupee (100 paise)
  const grandTotal = Math.round(unroundedTotal / 100) * 100;
  const roundOff = grandTotal - unroundedTotal;

  return {
    totalItems: items.length,
    totalQty,
    subtotal,
    discountAmount: totalLineDiscounts + headerDiscount,
    discountPercent: invoiceDiscountPercent,
    taxableAmount: netTaxable,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    roundOff,
    grandTotal,
  };
}

/**
 * Creates and posts a Sales Invoice atomically.
 * Performs stock verification, batch deductions, audit ledger recording,
 * compliance registering, and double-entry balanced voucher posting.
 *
 * @param {object} invoiceData
 */
function createSalesInvoice(invoiceData) {
  const db = getDatabase();

  const {
    invoiceType = 'RETAIL',
    invoiceDate = new Date().toISOString().split('T')[0],
    customerId = null,
    customerName = 'Cash Customer',
    customerPhone = null,
    patientId = null,
    doctorName = null,
    doctorRegNo = null,
    branchId = null,
    financialYearId = null,
    paymentMode = 'CASH', // 'CASH', 'UPI', 'CARD', 'CREDIT', 'SPLIT'
    paymentStatus = 'CONFIRMED',
    items = [],
    invoiceDiscountPercent = 0,
    invoiceDiscountAmount = 0,
    notes = null,
    userId = null,
    splitPayments = null, // e.g. { cash: 50000, upi: 50000 }
  } = invoiceData;

  if (!items || items.length === 0) {
    throw new Error('Invoice must contain at least one medicine item');
  }

  // ATOMIC DATABASE TRANSACTION
  return db.transaction(() => {
    // 1. Calculate totals
    const totals = calculateInvoiceTotals(items, invoiceDiscountPercent, invoiceDiscountAmount);

    // 2. Generate unique sequential invoice number
    const seqType = invoiceType === 'WHOLESALE' ? 'WHOLESALE_SALE' : 'RETAIL_SALE';
    const invoiceNumber = getNextVoucherNumber(db, seqType, branchId, financialYearId);

    // 3. Insert Sales Invoice Header
    const invRes = db.prepare(`
      INSERT INTO sales_invoices (
        invoice_number, invoice_type, invoice_date, customer_id, customer_name,
        customer_phone, patient_id, doctor_name, doctor_reg_no, branch_id,
        financial_year_id, total_items, total_qty, subtotal, discount_amount,
        discount_percent, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_tax, round_off, grand_total, payment_mode, payment_status, notes, user_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      invoiceNumber, invoiceType, invoiceDate, customerId || null, customerName.trim(),
      customerPhone || null, patientId || null, doctorName || null, doctorRegNo || null,
      branchId || null, financialYearId || null, totals.totalItems, totals.totalQty,
      totals.subtotal, totals.discountAmount, totals.discountPercent, totals.taxableAmount,
      totals.cgstAmount, totals.sgstAmount, totals.igstAmount, totals.totalTax,
      totals.roundOff, totals.grandTotal, paymentMode, paymentStatus, notes || null, userId || null
    );

    const invoiceId = invRes.lastInsertRowid;

    // Prepared statements for line items, batch update, movement audit, compliance
    const insertItemStmt = db.prepare(`
      INSERT INTO sales_invoice_items (
        sales_invoice_id, product_id, batch_id, batch_number, expiry_date,
        quantity, unit, mrp, selling_rate, discount_percent, taxable_amount,
        tax_rate, cgst_amount, sgst_amount, igst_amount, line_total
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const getBatchStmt = db.prepare(`
      SELECT b.id, b.product_id, b.batch_number, b.expiry_date, b.available_qty,
             b.purchase_rate, b.mrp, b.selling_price, b.is_blocked,
             p.brand_name, p.schedule_type, p.is_prescription_required
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.id = ?
    `);

    const updateBatchStmt = db.prepare(`
      UPDATE batches
      SET available_qty = available_qty - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, 'SALE', 'SALES_INVOICE', ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertComplianceStmt = db.prepare(`
      INSERT INTO compliance_registers (
        register_type, transaction_type, reference_id, product_id, batch_id,
        quantity, doctor_name, doctor_reg_no, patient_name, customer_phone, date_recorded, user_id
      ) VALUES (
        ?, 'SALE', ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    // 4. Iterate over line items: verify batch stock, deduct, write audit ledger
    for (const it of items) {
      const lineCalc = calculateLineItem(it);
      const batch = getBatchStmt.get(it.batchId);

      if (!batch) {
        throw new Error(`Batch ID ${it.batchId} not found for item "${it.brandName || it.productId}"`);
      }

      // Check expiry date
      if (batch.expiry_date < invoiceDate) {
        throw new Error(`Batch ${batch.batch_number} of "${batch.brand_name}" expired on ${batch.expiry_date}. Expired stock cannot be sold.`);
      }

      // Check blocked status
      if (batch.is_blocked) {
        throw new Error(`Batch ${batch.batch_number} of "${batch.brand_name}" is blocked and cannot be sold.`);
      }

      const reqQty = Number(it.quantity);
      if (reqQty <= 0) {
        throw new Error(`Invalid quantity ${reqQty} for ${batch.brand_name}`);
      }

      // Concurrency check: verify available stock
      if (batch.available_qty < reqQty) {
        throw new Error(
          `Insufficient stock for "${batch.brand_name}" (Batch: ${batch.batch_number}). Requested: ${reqQty}, Available: ${batch.available_qty}`
        );
      }

      const prevQty = batch.available_qty;
      const newQty = prevQty - reqQty;

      // Deduct batch stock
      updateBatchStmt.run(reqQty, batch.id);

      // Record in sales_invoice_items
      insertItemStmt.run(
        invoiceId, batch.product_id, batch.id, batch.batch_number, batch.expiry_date,
        reqQty, it.unit || 'Strip', it.mrp || batch.mrp, it.sellingRate || batch.selling_price,
        it.discountPercent || 0, lineCalc.taxable, lineCalc.taxRate,
        lineCalc.cgst, lineCalc.sgst, lineCalc.igst, lineCalc.lineTotal
      );

      // Record in stock_movements ledger
      insertMovementStmt.run(
        batch.id, batch.product_id, invoiceNumber,
        reqQty, it.unit || 'Strip', prevQty, newQty, it.sellingRate || batch.selling_price,
        `Sold via Invoice ${invoiceNumber}`, userId || null, branchId || null
      );

      // If product is Schedule H, H1, or Narcotic, record in compliance register
      if (batch.schedule_type === 'SCHEDULE_H' || batch.schedule_type === 'SCHEDULE_H1' || batch.schedule_type === 'NARCOTIC') {
        insertComplianceStmt.run(
          batch.schedule_type, invoiceNumber, batch.product_id, batch.id,
          reqQty, doctorName || 'Over Counter / Prescribed', doctorRegNo || 'N/A',
          customerName || 'Patient', customerPhone || 'N/A', invoiceDate, userId || null
        );
      }
    }

    // 5. POST BALANCED DOUBLE-ENTRY ACCOUNTING VOUCHER
    // Fetch Chart of Accounts IDs
    const cashAccount = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const upiAccount = db.prepare("SELECT id FROM accounts WHERE code = '1025'").get();
    const debtorsAccount = db.prepare("SELECT id FROM accounts WHERE code = '1030'").get();
    const salesAccount = db.prepare("SELECT id FROM accounts WHERE code = '4010'").get();
    const outputCgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '2020'").get();
    const outputSgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '2025'").get();
    const discountAllowedAcc = db.prepare("SELECT id FROM accounts WHERE code = '5030'").get();

    const jVoucherNum = getNextVoucherNumber(db, 'JOURNAL', branchId, financialYearId);
    const jRes = db.prepare(`
      INSERT INTO journal_entries (
        voucher_number, voucher_type, entry_date, reference_id, narration,
        branch_id, financial_year_id, total_amount, user_id
      ) VALUES (
        ?, 'SALES', ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      jVoucherNum, invoiceDate, invoiceNumber, `Sales Invoice ${invoiceNumber} - ${customerName}`,
      branchId || null, financialYearId || null, totals.grandTotal, userId || null
    );
    const journalId = jRes.lastInsertRowid;

    const insertJLine = db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, narration)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Debit side: How was money received?
    if (paymentMode === 'CREDIT') {
      // Debit Customer Debtors
      insertJLine.run(journalId, debtorsAccount.id, totals.grandTotal, 0, `Credit sale to ${customerName}`);
      // Update customer balance if customerId provided
      if (customerId) {
        db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?').run(totals.grandTotal, customerId);
      }
    } else if (paymentMode === 'UPI' || paymentMode === 'CARD' || paymentMode === 'BANK_TRANSFER') {
      // Debit UPI/Digital clearing
      insertJLine.run(journalId, upiAccount.id, totals.grandTotal, 0, `${paymentMode} received for ${invoiceNumber}`);
    } else if (paymentMode === 'SPLIT' && splitPayments) {
      const cashPart = Number(splitPayments.cash) || 0;
      const upiPart = totals.grandTotal - cashPart;
      if (cashPart > 0) insertJLine.run(journalId, cashAccount.id, cashPart, 0, `Cash component of ${invoiceNumber}`);
      if (upiPart > 0) insertJLine.run(journalId, upiAccount.id, upiPart, 0, `Digital component of ${invoiceNumber}`);
    } else {
      // Default: Cash
      insertJLine.run(journalId, cashAccount.id, totals.grandTotal, 0, `Cash received for ${invoiceNumber}`);
    }

    // Credit side: Sales Revenue & Output Taxes
    const netSalesCredit = totals.taxableAmount + totals.roundOff;
    insertJLine.run(journalId, salesAccount.id, 0, netSalesCredit, `Revenue from ${invoiceNumber}`);

    if (totals.cgstAmount > 0) {
      insertJLine.run(journalId, outputCgstAcc.id, 0, totals.cgstAmount, `Output CGST for ${invoiceNumber}`);
    }
    if (totals.sgstAmount > 0) {
      insertJLine.run(journalId, outputSgstAcc.id, 0, totals.sgstAmount, `Output SGST for ${invoiceNumber}`);
    }

    // 6. Record Payment entry for cash/upi/card
    if (paymentMode !== 'CREDIT') {
      const payNum = getNextVoucherNumber(db, 'RECEIPT', branchId, financialYearId);
      const payRes = db.prepare(`
        INSERT INTO payments (
          payment_number, payment_date, payment_type, party_type, party_id,
          amount, payment_mode, reference_no, status, notes, user_id, branch_id
        ) VALUES (
          ?, ?, 'RECEIPT', 'CUSTOMER', ?,
          ?, ?, ?, 'CONFIRMED', ?, ?, ?
        )
      `).run(
        payNum, invoiceDate, customerId || null, totals.grandTotal,
        paymentMode, invoiceNumber, `Payment for invoice ${invoiceNumber}`,
        userId || null, branchId || null
      );

      db.prepare(`
        INSERT INTO payment_allocations (payment_id, voucher_type, voucher_id, allocated_amount)
        VALUES (?, 'SALES_INVOICE', ?, ?)
      `).run(payRes.lastInsertRowid, invoiceId, totals.grandTotal);
    }

    return {
      success: true,
      invoiceId,
      invoiceNumber,
      grandTotal: totals.grandTotal,
      totals,
    };
  })();
}

/**
 * Retrieve an invoice by ID with all line items and customer details.
 */
function getInvoiceDetails(invoiceId) {
  const db = getDatabase();

  const invoice = db.prepare(`
    SELECT si.*,
           c.code as customer_code, c.address as customer_address, c.gstin as customer_gstin,
           u.full_name as operator_name,
           b.name as branch_name, b.phone as branch_phone, b.address as branch_address
    FROM sales_invoices si
    LEFT JOIN customers c ON si.customer_id = c.id
    LEFT JOIN users u ON si.user_id = u.id
    LEFT JOIN branches b ON si.branch_id = b.id
    WHERE si.id = ? OR si.invoice_number = ?
  `).get(invoiceId, invoiceId);

  if (!invoice) return null;

  invoice.items = db.prepare(`
    SELECT sii.*,
           p.code as product_code, p.brand_name, p.generic_name, p.hsn_code,
           b.rack_location
    FROM sales_invoice_items sii
    JOIN products p ON sii.product_id = p.id
    LEFT JOIN batches b ON sii.batch_id = b.id
    WHERE sii.sales_invoice_id = ?
    ORDER BY sii.id ASC
  `).all(invoice.id);

  invoice.company = db.prepare('SELECT * FROM companies LIMIT 1').get();

  return invoice;
}

/**
 * List recent invoices with search & pagination.
 */
function listSalesInvoices(filter = {}) {
  const db = getDatabase();
  const { search, fromDate, toDate, paymentMode, limit = 50, offset = 0 } = filter;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ` AND (si.invoice_number LIKE ? OR si.customer_name LIKE ? OR si.customer_phone LIKE ?)`;
    const pat = `%${search.trim()}%`;
    params.push(pat, pat, pat);
  }
  if (fromDate) {
    where += ` AND si.invoice_date >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    where += ` AND si.invoice_date <= ?`;
    params.push(toDate);
  }
  if (paymentMode) {
    where += ` AND si.payment_mode = ?`;
    params.push(paymentMode);
  }

  const countQuery = `SELECT COUNT(1) as total FROM sales_invoices si ${where}`;
  const total = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT si.*, u.full_name as operator_name
    FROM sales_invoices si
    LEFT JOIN users u ON si.user_id = u.id
    ${where}
    ORDER BY si.id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);
  const rows = db.prepare(dataQuery).all(...params);

  return { rows, total };
}

module.exports = {
  calculateLineItem,
  calculateInvoiceTotals,
  createSalesInvoice,
  getInvoiceDetails,
  listSalesInvoices,
};
