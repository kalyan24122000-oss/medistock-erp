// services/numbering-service.js
// Transaction-safe sequential voucher number generator

/**
 * Generates the next sequential voucher number for a document type.
 * Must be executed within a database transaction to guarantee no duplicates or race conditions.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} sequenceType - E.g. 'RETAIL_SALE', 'PURCHASE', 'RECEIPT', etc.
 * @param {number} [branchId]
 * @param {number} [financialYearId]
 * @returns {string} The formatted sequential number (e.g. 'INV-26/00101')
 */
function getNextVoucherNumber(db, sequenceType, branchId = null, financialYearId = null) {
  // Try to find matching sequence record
  let seq = db.prepare(`
    SELECT id, prefix, current_number, padding_length
    FROM invoice_sequences
    WHERE sequence_type = ?
      AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
      AND (financial_year_id = ? OR (financial_year_id IS NULL AND ? IS NULL))
  `).get(sequenceType, branchId, branchId, financialYearId, financialYearId);

  // If not found, try fallback by sequence_type only
  if (!seq) {
    seq = db.prepare(`
      SELECT id, prefix, current_number, padding_length
      FROM invoice_sequences
      WHERE sequence_type = ?
      LIMIT 1
    `).get(sequenceType);
  }

  if (!seq) {
    // Default fallback prefixes
    const defaults = {
      RETAIL_SALE: 'INV/',
      WHOLESALE_SALE: 'WS/',
      PURCHASE: 'PUR/',
      SALE_RETURN: 'SRT/',
      PURCHASE_RETURN: 'PRT/',
      RECEIPT: 'RCP/',
      PAYMENT: 'PAY/',
      JOURNAL: 'JRN/',
      EXPENSE: 'EXP/',
    };
    const prefix = defaults[sequenceType] || `${sequenceType.slice(0, 3)}/`;
    const insertRes = db.prepare(`
      INSERT INTO invoice_sequences (branch_id, financial_year_id, sequence_type, prefix, current_number, padding_length)
      VALUES (?, ?, ?, ?, 1, 5)
    `).run(branchId, financialYearId, sequenceType, prefix);

    return `${prefix}00001`;
  }

  const nextNum = seq.current_number + 1;
  db.prepare(`
    UPDATE invoice_sequences
    SET current_number = ?
    WHERE id = ?
  `).run(nextNum, seq.id);

  const paddedNum = String(nextNum).padStart(seq.padding_length || 5, '0');
  return `${seq.prefix}${paddedNum}`;
}

module.exports = {
  getNextVoucherNumber,
};
