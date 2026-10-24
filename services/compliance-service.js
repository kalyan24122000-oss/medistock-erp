// services/compliance-service.js
// Pharmacy Statutory Compliance Engine: Schedule H, Schedule H1, Narcotic Registers, and Batch Traceability

const { getDatabase } = require('../database/db');

/**
 * Get statutory Schedule H / H1 register entries for a given date range.
 * @param {string} registerType - 'SCHEDULE_H', 'SCHEDULE_H1', or 'NARCOTIC'
 * @param {string} fromDate
 * @param {string} toDate
 */
function getComplianceRegister(registerType, fromDate = null, toDate = null) {
  const db = getDatabase();

  let where = 'WHERE cr.register_type = ?';
  const params = [registerType];

  if (fromDate) {
    where += ' AND cr.date_recorded >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    where += ' AND cr.date_recorded <= ?';
    params.push(toDate);
  }

  const query = `
    SELECT cr.id, cr.register_type, cr.transaction_type, cr.reference_id,
           cr.quantity, cr.doctor_name, cr.doctor_reg_no, cr.patient_name,
           cr.patient_address, cr.customer_phone, cr.date_recorded,
           p.brand_name, p.generic_name, p.hsn_code, p.sale_unit,
           b.batch_number, b.expiry_date,
           u.full_name as dispensing_pharmacist
    FROM compliance_registers cr
    JOIN products p ON cr.product_id = p.id
    JOIN batches b ON cr.batch_id = b.id
    LEFT JOIN users u ON cr.user_id = u.id
    ${where}
    ORDER BY cr.date_recorded DESC, cr.id DESC
  `;

  return db.prepare(query).all(...params);
}

/**
 * Batch Traceability / Drug Recall Audit.
 * Traces from which supplier a batch was purchased and every single invoice/patient it was sold to.
 *
 * @param {string} batchNumber
 * @param {number} [productId]
 */
function traceBatchHistory(batchNumber, productId = null) {
  const db = getDatabase();

  const batch = db.prepare(`
    SELECT b.*,
           p.brand_name, p.generic_name, p.schedule_type,
           s.name as supplier_name, s.phone as supplier_phone, s.gstin as supplier_gstin
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.batch_number = ? AND (? IS NULL OR b.product_id = ?)
  `).get(batchNumber.trim(), productId, productId);

  if (!batch) {
    return null;
  }

  // Purchases
  const purchases = db.prepare(`
    SELECT pi.invoice_number, pi.supplier_invoice_no, pi.invoice_date,
           pii.quantity, pii.free_qty, pii.purchase_rate, pii.unit,
           s.name as supplier_name
    FROM purchase_invoice_items pii
    JOIN purchase_invoices pi ON pii.purchase_invoice_id = pi.id
    JOIN suppliers s ON pi.supplier_id = s.id
    WHERE pii.product_id = ? AND pii.batch_number = ?
  `).all(batch.product_id, batch.batch_number);

  // Sales / Patients dispensed
  const sales = db.prepare(`
    SELECT si.invoice_number, si.invoice_date, si.customer_name, si.customer_phone,
           si.doctor_name, si.doctor_reg_no,
           sii.quantity, sii.unit, sii.selling_rate, sii.line_total
    FROM sales_invoice_items sii
    JOIN sales_invoices si ON sii.sales_invoice_id = si.id
    WHERE sii.batch_id = ?
    ORDER BY si.invoice_date ASC
  `).all(batch.id);

  // Stock movements
  const movements = db.prepare(`
    SELECT sm.*, u.full_name as operator_name
    FROM stock_movements sm
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE sm.batch_id = ?
    ORDER BY sm.created_at ASC
  `).all(batch.id);

  return {
    batch,
    purchases,
    sales,
    movements,
  };
}

module.exports = {
  getComplianceRegister,
  traceBatchHistory,
};
