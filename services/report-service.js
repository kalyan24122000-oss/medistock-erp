// services/report-service.js
// Pharmacy Analytics, Dashboard KPIs, Expiry Tracking, and Management Reports

const { getDatabase } = require('../database/db');

/**
 * Get comprehensive Dashboard summary KPIs.
 */
function getDashboardMetrics() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  // Today's sales
  const todaySales = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) as total,
           COUNT(1) as invoice_count,
           COALESCE(SUM(taxable_amount), 0) as taxable,
           COALESCE(SUM(total_tax), 0) as tax
    FROM sales_invoices
    WHERE invoice_date = ? AND is_cancelled = 0
  `).get(today);

  // Today's purchases
  const todayPurchases = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) as total,
           COUNT(1) as bill_count
    FROM purchase_invoices
    WHERE invoice_date = ?
  `).get(today);

  // Payment modes today
  const paymentsToday = db.prepare(`
    SELECT payment_mode, SUM(grand_total) as amount
    FROM sales_invoices
    WHERE invoice_date = ? AND is_cancelled = 0
    GROUP BY payment_mode
  `).all(today);

  let cashTotal = 0;
  let digitalTotal = 0;
  let creditTotal = 0;

  for (const p of paymentsToday) {
    if (p.payment_mode === 'CASH') cashTotal += p.amount;
    else if (p.payment_mode === 'CREDIT') creditTotal += p.amount;
    else digitalTotal += p.amount;
  }

  // Outstanding balances
  const customerOutstanding = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM customers WHERE current_balance > 0
  `).get().total;

  const supplierPayables = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM suppliers WHERE current_balance > 0
  `).get().total;

  // Inventory alerts
  const lowStockCount = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.is_blocked = 0 AND b.expiry_date >= date('now')
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING COALESCE(SUM(b.available_qty), 0) <= p.reorder_level
  `).all().length;

  const expiredStock = db.prepare(`
    SELECT COUNT(1) as count, COALESCE(SUM(available_qty * purchase_rate), 0) as loss_valuation
    FROM batches
    WHERE expiry_date < date('now') AND available_qty > 0
  `).get();

  const nearExpiryStock = db.prepare(`
    SELECT COUNT(1) as count, COALESCE(SUM(available_qty * mrp), 0) as mrp_valuation
    FROM batches
    WHERE expiry_date >= date('now') AND expiry_date <= date('now', '+60 days') AND available_qty > 0
  `).get();

  // Recent 6 invoices
  const recentInvoices = db.prepare(`
    SELECT id, invoice_number, invoice_date, customer_name, grand_total, payment_mode
    FROM sales_invoices
    ORDER BY id DESC
    LIMIT 6
  `).all();

  // Last 7 days sales trend
  const salesTrend = db.prepare(`
    SELECT invoice_date, SUM(grand_total) as sales_amount, COUNT(1) as bill_count
    FROM sales_invoices
    WHERE invoice_date >= date('now', '-6 days') AND is_cancelled = 0
    GROUP BY invoice_date
    ORDER BY invoice_date ASC
  `).all();

  return {
    todaySales: todaySales.total,
    todayInvoiceCount: todaySales.invoice_count,
    todayPurchases: todayPurchases.total,
    cashReceipts: cashTotal,
    digitalReceipts: digitalTotal,
    creditSales: creditTotal,
    customerOutstanding,
    supplierPayables,
    lowStockCount,
    expiredBatchesCount: expiredStock.count,
    expiredLossValuation: expiredStock.loss_valuation,
    nearExpiryBatchesCount: nearExpiryStock.count,
    nearExpiryMrpValuation: nearExpiryStock.mrp_valuation,
    recentInvoices,
    salesTrend,
  };
}

/**
 * Expiry Management report (<30, <60, <90 days, or already expired).
 * @param {string} filterType - 'EXPIRED', '30_DAYS', '60_DAYS', '90_DAYS', 'ALL'
 */
function getExpiryReport(filterType = '60_DAYS') {
  const db = getDatabase();

  let condition = '';
  if (filterType === 'EXPIRED') {
    condition = `b.expiry_date < date('now')`;
  } else if (filterType === '30_DAYS') {
    condition = `b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+30 days')`;
  } else if (filterType === '60_DAYS') {
    condition = `b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+60 days')`;
  } else if (filterType === '90_DAYS') {
    condition = `b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+90 days')`;
  } else {
    condition = `b.expiry_date <= date('now', '+90 days')`;
  }

  return db.prepare(`
    SELECT b.id, b.batch_number, b.expiry_date, b.available_qty,
           b.purchase_rate, b.mrp, b.rack_location,
           p.id as product_id, p.code as product_code, p.brand_name, p.generic_name, p.sale_unit,
           s.name as supplier_name, s.phone as supplier_phone,
           (b.available_qty * b.purchase_rate) as total_cost,
           (b.available_qty * b.mrp) as total_mrp,
           CAST(ROUND(julianday(b.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE ${condition} AND b.available_qty > 0
    ORDER BY b.expiry_date ASC
  `).all();
}

/**
 * Low-stock reordering report (Suggested Order Quantity = max(0, Target - Available - On-Order)).
 */
function getReorderReport() {
  const db = getDatabase();

  return db.prepare(`
    SELECT p.id, p.code, p.brand_name, p.generic_name, p.purchase_unit, p.sale_unit,
           p.reorder_level, p.max_level, p.purchase_rate,
           COALESCE(SUM(b.available_qty), 0) as current_stock,
           s.name as preferred_supplier_name,
           MAX(0, p.max_level - COALESCE(SUM(b.available_qty), 0)) as suggested_order_qty
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.is_blocked = 0 AND b.expiry_date >= date('now')
    LEFT JOIN suppliers s ON p.preferred_supplier_id = s.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING COALESCE(SUM(b.available_qty), 0) <= p.reorder_level
    ORDER BY (p.reorder_level - COALESCE(SUM(b.available_qty), 0)) DESC
  `).all();
}

/**
 * Fast-moving and slow-moving product analysis.
 */
function getMovementAnalysis(days = 30) {
  const db = getDatabase();

  const fastMoving = db.prepare(`
    SELECT p.id, p.code, p.brand_name, p.sale_unit,
           SUM(sii.quantity) as sold_qty,
           SUM(sii.line_total) as total_revenue
    FROM sales_invoice_items sii
    JOIN products p ON sii.product_id = p.id
    JOIN sales_invoices si ON sii.sales_invoice_id = si.id
    WHERE si.invoice_date >= date('now', '-' || ? || ' days') AND si.is_cancelled = 0
    GROUP BY p.id
    ORDER BY sold_qty DESC
    LIMIT 10
  `).all(days);

  return { fastMoving };
}

module.exports = {
  getDashboardMetrics,
  getExpiryReport,
  getReorderReport,
  getMovementAnalysis,
};
