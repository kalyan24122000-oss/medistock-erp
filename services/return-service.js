// services/return-service.js
// Sales & Purchase Returns Engine with Original Invoice Verification,
// Quarantine Handling, and Balanced Accounting Reversals

const { getDatabase } = require('../database/db');
const { getNextVoucherNumber } = require('./numbering-service');

/**
 * Process a customer Sales Return.
 * Validates return quantities against original invoice, issues credit note,
 * isolates returned stock in quarantine, and posts balanced reversal vouchers.
 *
 * @param {object} returnData
 */
function processSalesReturn(returnData) {
  const db = getDatabase();

  const {
    salesInvoiceId,
    returnDate = new Date().toISOString().split('T')[0],
    reason = 'Patient returned medicine',
    refundMode = 'STORE_CREDIT', // 'STORE_CREDIT', 'CASH', 'CUSTOMER_LEDGER'
    quarantineStatus = 'QUARANTINED', // 'QUARANTINED', 'RETURNED_TO_STOCK'
    items = [],
    userId = null,
    branchId = null,
    financialYearId = null,
  } = returnData;

  if (!salesInvoiceId) {
    throw new Error('Original sales invoice is required for processing return');
  }
  if (!items || items.length === 0) {
    throw new Error('Return must contain at least one item');
  }

  return db.transaction(() => {
    // 1. Fetch original sales invoice
    const origInvoice = db.prepare(`
      SELECT * FROM sales_invoices WHERE id = ? OR invoice_number = ?
    `).get(salesInvoiceId, salesInvoiceId);

    if (!origInvoice) {
      throw new Error(`Original sales invoice "${salesInvoiceId}" not found`);
    }

    let totalTaxable = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const returnNumber = getNextVoucherNumber(db, 'SALE_RETURN', branchId, financialYearId);

    // Insert sales return header
    const sReturnRes = db.prepare(`
      INSERT INTO sales_returns (
        return_number, return_date, sales_invoice_id, customer_id, branch_id,
        reason, total_taxable, total_tax, grand_total, refund_mode, quarantine_status, user_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 0, 0, 0, ?, ?, ?
      )
    `).run(
      returnNumber, returnDate, origInvoice.id, origInvoice.customer_id, branchId || null,
      reason, refundMode, quarantineStatus, userId || null
    );
    const salesReturnId = sReturnRes.lastInsertRowid;

    const origItemStmt = db.prepare(`
      SELECT * FROM sales_invoice_items WHERE sales_invoice_id = ? AND id = ?
    `);

    const insertReturnItemStmt = db.prepare(`
      INSERT INTO sales_return_items (
        sales_return_id, sales_invoice_item_id, batch_id, product_id,
        quantity, unit, selling_rate, tax_rate, line_total
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const updateBatchStmt = db.prepare(`
      UPDATE batches
      SET available_qty = available_qty + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, 'SALE_RETURN', 'SALES_RETURN', ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const it of items) {
      const origItem = origItemStmt.get(origInvoice.id, it.invoiceItemId);
      if (!origItem) {
        throw new Error(`Item ${it.invoiceItemId} does not belong to invoice ${origInvoice.invoice_number}`);
      }

      const retQty = Number(it.quantity);
      if (retQty <= 0 || retQty > origItem.quantity) {
        throw new Error(
          `Invalid return quantity ${retQty}. Maximum returnable is ${origItem.quantity}.`
        );
      }

      const rate = origItem.selling_rate;
      const lineTaxable = Math.round(retQty * rate);
      const taxRateBp = origItem.tax_rate || 1200;
      const lineTax = Math.round((lineTaxable * taxRateBp) / 10000);
      const lineTotal = lineTaxable + lineTax;

      totalTaxable += lineTaxable;
      totalTax += lineTax;
      grandTotal += lineTotal;

      // Insert return item
      insertReturnItemStmt.run(
        salesReturnId, origItem.id, origItem.batch_id, origItem.product_id,
        retQty, origItem.unit, rate, taxRateBp, lineTotal
      );

      // Handle Stock: If marked RETURNED_TO_STOCK, update batch available_qty
      const batch = db.prepare('SELECT available_qty, purchase_rate FROM batches WHERE id = ?').get(origItem.batch_id);
      const prevQty = batch ? batch.available_qty : 0;
      let newQty = prevQty;

      if (quarantineStatus === 'RETURNED_TO_STOCK') {
        newQty = prevQty + retQty;
        updateBatchStmt.run(retQty, origItem.batch_id);
      }

      insertMovementStmt.run(
        origItem.batch_id, origItem.product_id, returnNumber,
        retQty, origItem.unit, prevQty, newQty, rate,
        `Sales Return: ${returnNumber} (${quarantineStatus})`, userId || null, branchId || null
      );
    }

    // Update return header totals
    db.prepare(`
      UPDATE sales_returns
      SET total_taxable = ?, total_tax = ?, grand_total = ?
      WHERE id = ?
    `).run(totalTaxable, totalTax, grandTotal, salesReturnId);

    // Balanced Accounting Reversal Voucher
    const salesAcc = db.prepare("SELECT id FROM accounts WHERE code = '4010'").get();
    const outputCgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '2020'").get();
    const outputSgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '2025'").get();
    const cashAcc = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const debtorsAcc = db.prepare("SELECT id FROM accounts WHERE code = '1030'").get();

    const jVoucherNum = getNextVoucherNumber(db, 'JOURNAL', branchId, financialYearId);
    const jRes = db.prepare(`
      INSERT INTO journal_entries (
        voucher_number, voucher_type, entry_date, reference_id, narration,
        branch_id, financial_year_id, total_amount, user_id
      ) VALUES (
        ?, 'SALES_RETURN', ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      jVoucherNum, returnDate, returnNumber, `Sales Return ${returnNumber} against ${origInvoice.invoice_number}`,
      branchId || null, financialYearId || null, grandTotal, userId || null
    );
    const journalId = jRes.lastInsertRowid;

    const insertJLine = db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, narration)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Debit: Sales & Output Taxes (Reversal)
    const halfTax = Math.round(totalTax / 2);
    insertJLine.run(journalId, salesAcc.id, totalTaxable, 0, `Sales reversal on ${returnNumber}`);
    if (halfTax > 0) {
      insertJLine.run(journalId, outputCgstAcc.id, halfTax, 0, `CGST reversal on ${returnNumber}`);
      insertJLine.run(journalId, outputSgstAcc.id, totalTax - halfTax, 0, `SGST reversal on ${returnNumber}`);
    }

    // Credit: Refund mode
    if (refundMode === 'CASH') {
      insertJLine.run(journalId, cashAcc.id, 0, grandTotal, `Cash refund for ${returnNumber}`);
    } else {
      // Store credit / Customer ledger
      insertJLine.run(journalId, debtorsAcc.id, 0, grandTotal, `Customer ledger credit for ${returnNumber}`);
      if (origInvoice.customer_id) {
        db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(grandTotal, origInvoice.customer_id);
      }
    }

    return {
      success: true,
      salesReturnId,
      returnNumber,
      grandTotal,
    };
  })();
}

/**
 * Process a Purchase Return to Supplier (e.g. for expired or damaged items).
 */
function processPurchaseReturn(returnData) {
  const db = getDatabase();

  const {
    purchaseInvoiceId = null,
    supplierId,
    returnDate = new Date().toISOString().split('T')[0],
    reason = 'Expired or damaged stock return',
    items = [],
    userId = null,
    branchId = null,
    financialYearId = null,
  } = returnData;

  if (!supplierId) {
    throw new Error('Supplier is required for purchase return');
  }
  if (!items || items.length === 0) {
    throw new Error('Must specify at least one batch to return');
  }

  return db.transaction(() => {
    let totalTaxable = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const returnNumber = getNextVoucherNumber(db, 'PURCHASE_RETURN', branchId, financialYearId);

    const prRes = db.prepare(`
      INSERT INTO purchase_returns (
        return_number, return_date, purchase_invoice_id, supplier_id, branch_id,
        reason, total_taxable, total_tax, grand_total, credit_note_status, user_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 0, 0, 0, 'PENDING', ?
      )
    `).run(
      returnNumber, returnDate, purchaseInvoiceId || null, supplierId, branchId || null,
      reason, userId || null
    );
    const purchaseReturnId = prRes.lastInsertRowid;

    const getBatchStmt = db.prepare('SELECT * FROM batches WHERE id = ?');
    const updateBatchStmt = db.prepare(`
      UPDATE batches
      SET available_qty = MAX(0, available_qty - ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertReturnItemStmt = db.prepare(`
      INSERT INTO purchase_return_items (
        purchase_return_id, batch_id, product_id, quantity, unit, purchase_rate, tax_rate, line_total
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertMovementStmt = db.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, 'PURCHASE_RETURN', 'PURCHASE_RETURN', ?,
        ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const it of items) {
      const batch = getBatchStmt.get(it.batchId);
      if (!batch) {
        throw new Error(`Batch ID ${it.batchId} not found`);
      }

      const retQty = Number(it.quantity);
      if (retQty <= 0) {
        throw new Error('Quantity must be greater than zero');
      }

      const rate = batch.purchase_rate;
      const lineTaxable = Math.round(retQty * rate);
      const taxRateBp = it.taxRate || 1200;
      const lineTax = Math.round((lineTaxable * taxRateBp) / 10000);
      const lineTotal = lineTaxable + lineTax;

      totalTaxable += lineTaxable;
      totalTax += lineTax;
      grandTotal += lineTotal;

      insertReturnItemStmt.run(
        purchaseReturnId, batch.id, batch.product_id, retQty,
        it.unit || 'Strip', rate, taxRateBp, lineTotal
      );

      const prevQty = batch.available_qty;
      const newQty = Math.max(0, prevQty - retQty);
      updateBatchStmt.run(retQty, batch.id);

      insertMovementStmt.run(
        batch.id, batch.product_id, returnNumber,
        retQty, it.unit || 'Strip', prevQty, newQty, rate,
        `Supplier Return: ${returnNumber}`, userId || null, branchId || null
      );
    }

    // Update return header totals
    db.prepare(`
      UPDATE purchase_returns
      SET total_taxable = ?, total_tax = ?, grand_total = ?
      WHERE id = ?
    `).run(totalTaxable, totalTax, grandTotal, purchaseReturnId);

    // Adjust supplier balance (reduces payable)
    db.prepare('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?').run(grandTotal, supplierId);

    // Post double-entry voucher
    const purchaseAcc = db.prepare("SELECT id FROM accounts WHERE code = '5020'").get();
    const inputCgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '1050'").get();
    const inputSgstAcc = db.prepare("SELECT id FROM accounts WHERE code = '1055'").get();
    const creditorsAcc = db.prepare("SELECT id FROM accounts WHERE code = '2010'").get();

    const jVoucherNum = getNextVoucherNumber(db, 'JOURNAL', branchId, financialYearId);
    const jRes = db.prepare(`
      INSERT INTO journal_entries (
        voucher_number, voucher_type, entry_date, reference_id, narration,
        branch_id, financial_year_id, total_amount, user_id
      ) VALUES (
        ?, 'PURCHASE_RETURN', ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      jVoucherNum, returnDate, returnNumber, `Supplier Debit Note ${returnNumber}`,
      branchId || null, financialYearId || null, grandTotal, userId || null
    );
    const journalId = jRes.lastInsertRowid;

    const insertJLine = db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, narration)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Debit: Creditors (Decreasing what we owe supplier)
    insertJLine.run(journalId, creditorsAcc.id, grandTotal, 0, `Supplier debit on ${returnNumber}`);

    // Credit: Purchases & Input Taxes (Reversing purchase)
    const halfTax = Math.round(totalTax / 2);
    insertJLine.run(journalId, purchaseAcc.id, 0, totalTaxable, `Purchase reversal on ${returnNumber}`);
    if (halfTax > 0) {
      insertJLine.run(journalId, inputCgstAcc.id, 0, halfTax, `Input CGST reversal on ${returnNumber}`);
      insertJLine.run(journalId, inputSgstAcc.id, 0, totalTax - halfTax, `Input SGST reversal on ${returnNumber}`);
    }

    return {
      success: true,
      purchaseReturnId,
      returnNumber,
      grandTotal,
    };
  })();
}

module.exports = {
  processSalesReturn,
  processPurchaseReturn,
};
