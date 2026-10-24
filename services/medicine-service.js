// services/medicine-service.js
// Medicine Catalog, Salt Compositions, Categories & Manufacturer Management

const { getDatabase } = require('../database/db');

/**
 * High-speed medicine search for POS Billing & Inventory.
 * Searches across Brand Name, Generic Name, Salt, Barcode, and Code.
 * @param {string} query
 * @param {object} [options] - e.g. { activeOnly: true, limit: 30 }
 */
function searchMedicines(query, options = {}) {
  const db = getDatabase();
  const limit = options.limit || 30;
  const trimmed = (query || '').trim();

  if (!trimmed) {
    return db.prepare(`
      SELECT p.id, p.code, p.barcode, p.brand_name, p.generic_name, p.rack_shelf,
             p.purchase_unit, p.sale_unit, p.conversion_ratio, p.purchase_rate,
             p.mrp, p.selling_price, p.tax_rate, p.schedule_type, p.is_prescription_required,
             p.is_loose_allowed, p.is_active,
             m.name as manufacturer_name, c.name as category_name, s.name as salt_name,
             COALESCE(SUM(b.available_qty), 0) as total_stock
      FROM products p
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN medicine_categories c ON p.category_id = c.id
      LEFT JOIN salt_compositions s ON p.salt_id = s.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.is_blocked = 0 AND b.expiry_date >= date('now')
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.brand_name ASC
      LIMIT ?
    `).all(limit);
  }

  // Exact barcode match takes highest priority
  const exactBarcode = db.prepare(`
    SELECT p.id, p.code, p.barcode, p.brand_name, p.generic_name, p.rack_shelf,
           p.purchase_unit, p.sale_unit, p.conversion_ratio, p.purchase_rate,
           p.mrp, p.selling_price, p.tax_rate, p.schedule_type, p.is_prescription_required,
           p.is_loose_allowed, p.is_active,
           m.name as manufacturer_name, c.name as category_name, s.name as salt_name,
           COALESCE(SUM(b.available_qty), 0) as total_stock
    FROM products p
    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
    LEFT JOIN medicine_categories c ON p.category_id = c.id
    LEFT JOIN salt_compositions s ON p.salt_id = s.id
    LEFT JOIN batches b ON p.id = b.product_id AND b.is_blocked = 0 AND b.expiry_date >= date('now')
    WHERE (p.barcode = ? OR p.alt_barcode = ?) AND p.is_active = 1
    GROUP BY p.id
  `).get(trimmed, trimmed);

  if (exactBarcode) {
    return [exactBarcode];
  }

  // Flexible partial search
  const pattern = `%${trimmed}%`;
  return db.prepare(`
    SELECT p.id, p.code, p.barcode, p.brand_name, p.generic_name, p.rack_shelf,
           p.purchase_unit, p.sale_unit, p.conversion_ratio, p.purchase_rate,
           p.mrp, p.selling_price, p.tax_rate, p.schedule_type, p.is_prescription_required,
           p.is_loose_allowed, p.is_active,
           m.name as manufacturer_name, c.name as category_name, s.name as salt_name,
           COALESCE(SUM(b.available_qty), 0) as total_stock
    FROM products p
    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
    LEFT JOIN medicine_categories c ON p.category_id = c.id
    LEFT JOIN salt_compositions s ON p.salt_id = s.id
    LEFT JOIN batches b ON p.id = b.product_id AND b.is_blocked = 0 AND b.expiry_date >= date('now')
    WHERE (
      p.brand_name LIKE ? OR
      p.generic_name LIKE ? OR
      p.code LIKE ? OR
      p.barcode LIKE ? OR
      s.name LIKE ? OR
      m.name LIKE ?
    )
    AND (? = 0 OR p.is_active = 1)
    GROUP BY p.id
    ORDER BY
      CASE
        WHEN p.brand_name LIKE ? THEN 1
        WHEN p.generic_name LIKE ? THEN 2
        ELSE 3
      END,
      p.brand_name ASC
    LIMIT ?
  `).all(
    pattern, pattern, pattern, pattern, pattern, pattern,
    options.activeOnly !== false ? 1 : 0,
    `${trimmed}%`, `${trimmed}%`,
    limit
  );
}

/**
 * Get full product details by ID.
 */
function getProductById(productId) {
  const db = getDatabase();
  const product = db.prepare(`
    SELECT p.*,
           m.name as manufacturer_name,
           c.name as category_name,
           s.name as salt_name, s.schedule_type as salt_schedule, s.indications, s.contraindications
    FROM products p
    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
    LEFT JOIN medicine_categories c ON p.category_id = c.id
    LEFT JOIN salt_compositions s ON p.salt_id = s.id
    WHERE p.id = ?
  `).get(productId);

  if (!product) return null;

  // Include active batches with available quantities
  product.batches = db.prepare(`
    SELECT id, batch_number, manufacturing_date, expiry_date,
           purchase_rate, mrp, selling_price, available_qty, rack_location, is_blocked
    FROM batches
    WHERE product_id = ? AND available_qty > 0 AND is_blocked = 0
    ORDER BY expiry_date ASC
  `).all(productId);

  return product;
}

/**
 * Create or update a product.
 */
function saveProduct(productData) {
  const db = getDatabase();

  const {
    id, code, barcode, altBarcode, brandName, genericName, saltId,
    manufacturerId, categoryId, hsnCode, taxRate, purchaseUnit,
    saleUnit, conversionRatio, purchaseRate, mrp, sellingPrice,
    reorderLevel, maxLevel, preferredSupplierId, rackShelf,
    scheduleType, isPrescriptionRequired, isLooseAllowed, isActive, notes,
  } = productData;

  if (!brandName || !code) {
    throw new Error('Product Code and Brand Name are required');
  }

  if (id) {
    // Update
    db.prepare(`
      UPDATE products SET
        code = ?, barcode = ?, alt_barcode = ?, brand_name = ?, generic_name = ?,
        salt_id = ?, manufacturer_id = ?, category_id = ?, hsn_code = ?,
        tax_rate = ?, purchase_unit = ?, sale_unit = ?, conversion_ratio = ?,
        purchase_rate = ?, mrp = ?, selling_price = ?, reorder_level = ?,
        max_level = ?, preferred_supplier_id = ?, rack_shelf = ?,
        schedule_type = ?, is_prescription_required = ?, is_loose_allowed = ?,
        is_active = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      code, barcode || null, altBarcode || null, brandName.trim(), genericName || null,
      saltId || null, manufacturerId || null, categoryId || null, hsnCode || '3004',
      taxRate || 1200, purchaseUnit || 'Box', saleUnit || 'Strip', conversionRatio || 10,
      purchaseRate || 0, mrp || 0, sellingPrice || 0, reorderLevel || 10,
      maxLevel || 500, preferredSupplierId || null, rackShelf || null,
      scheduleType || 'NONE', isPrescriptionRequired ? 1 : 0, isLooseAllowed ? 1 : 0,
      isActive !== undefined ? (isActive ? 1 : 0) : 1, notes || null,
      id
    );
    return { success: true, id };
  } else {
    // Check duplicate code
    const existing = db.prepare('SELECT id FROM products WHERE code = ?').get(code.trim());
    if (existing) {
      throw new Error(`Product with code "${code}" already exists`);
    }

    const res = db.prepare(`
      INSERT INTO products (
        code, barcode, alt_barcode, brand_name, generic_name, salt_id,
        manufacturer_id, category_id, hsn_code, tax_rate, purchase_unit,
        sale_unit, conversion_ratio, purchase_rate, mrp, selling_price,
        reorder_level, max_level, preferred_supplier_id, rack_shelf,
        schedule_type, is_prescription_required, is_loose_allowed, is_active, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      code.trim(), barcode || null, altBarcode || null, brandName.trim(), genericName || null,
      saltId || null, manufacturerId || null, categoryId || null, hsnCode || '3004',
      taxRate || 1200, purchaseUnit || 'Box', saleUnit || 'Strip', conversionRatio || 10,
      purchaseRate || 0, mrp || 0, sellingPrice || 0, reorderLevel || 10,
      maxLevel || 500, preferredSupplierId || null, rackShelf || null,
      scheduleType || 'NONE', isPrescriptionRequired ? 1 : 0, isLooseAllowed ? 1 : 0,
      isActive !== undefined ? (isActive ? 1 : 0) : 1, notes || null
    );
    return { success: true, id: res.lastInsertRowid };
  }
}

/**
 * Get reference masters (categories, manufacturers, salts, tax configs).
 */
function getMedicineMasters() {
  const db = getDatabase();
  return {
    categories: db.prepare('SELECT * FROM medicine_categories WHERE status = "ACTIVE" ORDER BY name ASC').all(),
    manufacturers: db.prepare('SELECT * FROM manufacturers WHERE status = "ACTIVE" ORDER BY name ASC').all(),
    salts: db.prepare('SELECT * FROM salt_compositions ORDER BY name ASC').all(),
    taxes: db.prepare('SELECT * FROM tax_configurations WHERE is_active = 1 ORDER BY rate_percent ASC').all(),
  };
}

module.exports = {
  searchMedicines,
  getProductById,
  saveProduct,
  getMedicineMasters,
};
