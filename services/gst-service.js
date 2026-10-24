// services/gst-service.js
// GST Registers, GSTR-1, GSTR-3B, and HSN Tax Reporting Engine

const { getDatabase } = require('../database/db');

/**
 * Generate GSTR-1 Outward Supplies Summary (B2B, B2C, Credit Notes).
 */
function getGstr1Report(fromDate, toDate) {
  const db = getDatabase();

  const b2bInvoices = db.prepare(`
    SELECT si.id, si.invoice_number, si.invoice_date, si.taxable_amount,
           si.cgst_amount, si.sgst_amount, si.igst_amount, si.total_tax, si.grand_total,
           c.name as customer_name, c.gstin as customer_gstin
    FROM sales_invoices si
    JOIN customers c ON si.customer_id = c.id
    WHERE c.gstin IS NOT NULL AND c.gstin != ''
      AND (? IS NULL OR si.invoice_date >= ?)
      AND (? IS NULL OR si.invoice_date <= ?)
    ORDER BY si.invoice_date ASC
  `).all(fromDate, fromDate, toDate, toDate);

  const b2cInvoices = db.prepare(`
    SELECT si.id, si.invoice_number, si.invoice_date, si.customer_name,
           si.taxable_amount, si.cgst_amount, si.sgst_amount, si.igst_amount,
           si.total_tax, si.grand_total
    FROM sales_invoices si
    LEFT JOIN customers c ON si.customer_id = c.id
    WHERE (c.gstin IS NULL OR c.gstin = '')
      AND (? IS NULL OR si.invoice_date >= ?)
      AND (? IS NULL OR si.invoice_date <= ?)
    ORDER BY si.invoice_date ASC
  `).all(fromDate, fromDate, toDate, toDate);

  // Rate-wise summary
  const rateWise = db.prepare(`
    SELECT (sii.tax_rate / 100.0) as tax_rate_percent,
           SUM(sii.taxable_amount) as total_taxable,
           SUM(sii.cgst_amount) as total_cgst,
           SUM(sii.sgst_amount) as total_sgst,
           SUM(sii.igst_amount) as total_igst,
           SUM(sii.line_total) as total_line_amount
    FROM sales_invoice_items sii
    JOIN sales_invoices si ON sii.sales_invoice_id = si.id
    WHERE (? IS NULL OR si.invoice_date >= ?)
      AND (? IS NULL OR si.invoice_date <= ?)
    GROUP BY sii.tax_rate
    ORDER BY sii.tax_rate ASC
  `).all(fromDate, fromDate, toDate, toDate);

  return {
    fromDate,
    toDate,
    b2bInvoices,
    b2cInvoices,
    rateWise,
  };
}

/**
 * Generate GSTR-3B Outward Tax Liability vs Eligible Inward ITC.
 */
function getGstr3bReport(fromDate, toDate) {
  const db = getDatabase();

  const outward = db.prepare(`
    SELECT COALESCE(SUM(taxable_amount), 0) as taxable,
           COALESCE(SUM(cgst_amount), 0) as cgst,
           COALESCE(SUM(sgst_amount), 0) as sgst,
           COALESCE(SUM(igst_amount), 0) as igst,
           COALESCE(SUM(grand_total), 0) as total
    FROM sales_invoices
    WHERE (? IS NULL OR invoice_date >= ?)
      AND (? IS NULL OR invoice_date <= ?)
  `).get(fromDate, fromDate, toDate, toDate);

  const inward = db.prepare(`
    SELECT COALESCE(SUM(taxable_amount), 0) as taxable,
           COALESCE(SUM(cgst_amount), 0) as cgst,
           COALESCE(SUM(sgst_amount), 0) as sgst,
           COALESCE(SUM(igst_amount), 0) as igst,
           COALESCE(SUM(grand_total), 0) as total
    FROM purchase_invoices
    WHERE (? IS NULL OR invoice_date >= ?)
      AND (? IS NULL OR invoice_date <= ?)
  `).get(fromDate, fromDate, toDate, toDate);

  const netCgstPayable = Math.max(0, outward.cgst - inward.cgst);
  const netSgstPayable = Math.max(0, outward.sgst - inward.sgst);

  return {
    fromDate,
    toDate,
    outwardSupplies: outward,
    inwardItc: inward,
    netTaxPayable: {
      cgst: netCgstPayable,
      sgst: netSgstPayable,
      total: netCgstPayable + netSgstPayable,
    },
  };
}

/**
 * Generate HSN Summary Report.
 */
function getHsnSummary(fromDate, toDate) {
  const db = getDatabase();

  return db.prepare(`
    SELECT p.hsn_code,
           COUNT(DISTINCT p.id) as product_count,
           SUM(sii.quantity) as total_qty,
           p.sale_unit as uqc,
           SUM(sii.taxable_amount) as total_taxable,
           (sii.tax_rate / 100.0) as tax_rate_percent,
           SUM(sii.cgst_amount) as total_cgst,
           SUM(sii.sgst_amount) as total_sgst,
           SUM(sii.line_total) as total_amount
    FROM sales_invoice_items sii
    JOIN products p ON sii.product_id = p.id
    JOIN sales_invoices si ON sii.sales_invoice_id = si.id
    WHERE (? IS NULL OR si.invoice_date >= ?)
      AND (? IS NULL OR si.invoice_date <= ?)
    GROUP BY p.hsn_code, sii.tax_rate
    ORDER BY p.hsn_code ASC
  `).all(fromDate, fromDate, toDate, toDate);
}

module.exports = {
  getGstr1Report,
  getGstr3bReport,
  getHsnSummary,
};
