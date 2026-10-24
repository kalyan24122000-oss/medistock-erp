// services/batch-service.js
// Batch Management, FEFO Allocation, Expiry Exclusion, and Stock Adjustments

const { getDatabase } = require('../database/db');

/**
 * Get available batches for a medicine sorted by FEFO (First Expiry First Out).
 * Excludes expired batches and blocked batches for sales.
 *
 * @param {number} productId
 * @param {boolean} [includeExpired=false]
 */
function getProductBatches(productId, includeExpired = false) {
  const db = getDatabase();

  let query = `
    SELECT b.id, b.product_id, b.batch_number, b.manufacturing_date, b.expiry_date,
           b.purchase_rate, b.mrp, b.selling_price, b.initial_qty, b.available_qty,
           b.reserved_qty, b.damaged_qty, b.blocked_qty, b.rack_location,
           b.is_blocked, b.block_reason,
           p.brand_name, p.sale_unit, p.conversion_ratio,
           julianday(b.expiry_date) - julianday('now') as days_to_expiry
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.product_id = ?
  `;

  if (!includeExpired) {
    query += ` AND b.is_blocked = 0 AND b.available_qty > 0 AND b.expiry_date >= date('now')`;
  }

  query += ` ORDER BY b.expiry_date ASC`;

  return db.prepare(query).all(productId);
}

/**
 * Get all batches in inventory (Matrix view) with filtering and pagination.
 */
function listInventoryBatches(filter = {}) {
  const db = getDatabase();
  const { search, categoryId, status, limit = 100, offset = 0 } = filter;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ` AND (p.brand_name LIKE ? OR b.batch_number LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)`;
    const pat = `%${search.trim()}%`;
    params.push(pat, pat, pat, pat);
  }

  if (categoryId) {
    where += ` AND p.category_id = ?`;
    params.push(categoryId);
  }

  if (status === 'EXPIRED') {
    where += ` AND b.expiry_date < date('now') AND b.available_qty > 0`;
  } else if (status === 'NEAR_EXPIRY') {
    where += ` AND b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+60 days') AND b.available_qty > 0`;
  } else if (status === 'IN_STOCK') {
    where += ` AND b.available_qty > 0`;
  } else if (status === 'OUT_OF_STOCK') {
    where += ` AND b.available_qty = 0`;
  }

  const countQuery = `
    SELECT COUNT(1) as total
    FROM batches b
    JOIN products p ON b.product_id = p.id
    ${where}
  `;
  const totalCount = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT b.id, b.product_id, b.batch_number, b.manufacturing_date, b.expiry_date,
           b.purchase_rate, b.mrp, b.selling_price, b.initial_qty, b.available_qty,
           b.damaged_qty, b.is_blocked, b.rack_location,
           p.code as product_code, p.brand_name, p.generic_name, p.sale_unit, p.purchase_unit,
           p.conversion_ratio, p.tax_rate,
           m.name as manufacturer_name, c.name as category_name,
           (b.available_qty * b.purchase_rate) as total_valuation,
           julianday(b.expiry_date) - julianday('now') as days_to_expiry
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
    LEFT JOIN medicine_categories c ON p.category_id = c.id
    ${where}
    ORDER BY p.brand_name ASC, b.expiry_date ASC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const rows = db.prepare(dataQuery).all(...params);

  return {
    rows,
    total: totalCount,
  };
}

/**
 * Adjust stock manually with mandatory reason, operator identification, and movement ledger entry.
 */
function adjustStock({ batchId, adjustmentType, quantity, reason, userId, branchId }) {
  const db = getDatabase();

  if (!reason || !reason.trim()) {
    throw new Error('Adjustment reason is required');
  }

  const adjQty = Number(quantity);
  if (isNaN(adjQty) || adjQty <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  return db.transaction(() => {
    const batch = db.prepare(`
      SELECT b.id, b.product_id, b.available_qty, b.damaged_qty, b.purchase_rate,
             p.brand_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.id = ?
    `).get(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    let prevQty = batch.available_qty;
    let newQty = prevQty;
    let movementType = 'MANUAL_ADJUSTMENT';

    if (adjustmentType === 'ADD') {
      newQty = prevQty + adjQty;
      movementType = 'ADJUSTMENT_ADD';
      db.prepare('UPDATE batches SET available_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, batchId);
    } else if (adjustmentType === 'SUB') {
      if (prevQty < adjQty) {
        throw new Error(`Cannot subtract ${adjQty}. Only ${prevQty} available in this batch.`);
      }
      newQty = prevQty - adjQty;
      movementType = 'ADJUSTMENT_SUB';
      db.prepare('UPDATE batches SET available_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, batchId);
    } else if (adjustmentType === 'DAMAGE') {
      if (prevQty < adjQty) {
        throw new Error(`Cannot mark ${adjQty} as damaged. Only ${prevQty} available.`);
      }
      newQty = prevQty - adjQty;
      movementType = 'DAMAGE';
      db.prepare(`
        UPDATE batches
        SET available_qty = ?, damaged_qty = damaged_qty + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newQty, adjQty, batchId);
    } else {
      throw new Error(`Unknown adjustment type: ${adjustmentType}`);
    }

    // Write audit trail in stock_movements
    db.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, ?, 'STOCK_ADJUSTMENT', ?,
        ?, 'Strip', ?, ?, ?, ?, ?, ?
      )
    `).run(
      batch.id, batch.product_id, movementType, `ADJ-${Date.now()}`,
      adjQty, prevQty, newQty, batch.purchase_rate, reason.trim(),
      userId || null, branchId || null
    );

    return {
      success: true,
      batchId,
      previousQty: prevQty,
      newQty: newQty,
      difference: newQty - prevQty,
    };
  })();
}

/**
 * Get audit trail / stock movement ledger for a product or batch.
 */
function getStockMovementLedger(filter = {}) {
  const db = getDatabase();
  const { productId, batchId, limit = 50 } = filter;

  let where = 'WHERE 1=1';
  const params = [];

  if (productId) {
    where += ' AND sm.product_id = ?';
    params.push(productId);
  }
  if (batchId) {
    where += ' AND sm.batch_id = ?';
    params.push(batchId);
  }

  const query = `
    SELECT sm.id, sm.movement_type, sm.reference_type, sm.reference_id,
           sm.quantity, sm.previous_qty, sm.new_qty, sm.rate, sm.remarks, sm.created_at,
           b.batch_number, b.expiry_date,
           p.brand_name, p.sale_unit,
           u.full_name as operator_name
    FROM stock_movements sm
    JOIN batches b ON sm.batch_id = b.id
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.user_id = u.id
    ${where}
    ORDER BY sm.id DESC
    LIMIT ?
  `;

  params.push(limit);
  return db.prepare(query).all(...params);
}

module.exports = {
  getProductBatches,
  listInventoryBatches,
  adjustStock,
  getStockMovementLedger,
};
