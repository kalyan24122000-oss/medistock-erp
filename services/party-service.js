// services/party-service.js
// Customer and Supplier Management Services

const { getDatabase } = require('../database/db');

/**
 * List customers with optional search.
 */
function listCustomers(search = '') {
  const db = getDatabase();
  const trimmed = (search || '').trim();

  if (!trimmed) {
    return db.prepare(`
      SELECT * FROM customers WHERE status = 'ACTIVE' ORDER BY name ASC
    `).all();
  }

  const pat = `%${trimmed}%`;
  return db.prepare(`
    SELECT * FROM customers
    WHERE (name LIKE ? OR phone LIKE ? OR code LIKE ? OR gstin LIKE ?)
    ORDER BY name ASC
  `).all(pat, pat, pat, pat);
}

/**
 * Save customer (create or update).
 */
function saveCustomer(customerData) {
  const db = getDatabase();
  const { id, code, name, phone, email, address, city, state, pincode, gstin, priceGroup, creditLimit } = customerData;

  if (!name || !name.trim()) throw new Error('Customer name is required');

  if (id) {
    db.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, email = ?, address = ?, city = ?, state = ?,
        pincode = ?, gstin = ?, price_group = ?, credit_limit = ?
      WHERE id = ?
    `).run(
      name.trim(), phone || null, email || null, address || null, city || 'Mumbai',
      state || 'Maharashtra', pincode || null, gstin || null,
      priceGroup || 'RETAIL', creditLimit || 0, id
    );
    return { success: true, id };
  } else {
    const custCode = code || `CUST-${Date.now().toString().slice(-4)}`;
    const res = db.prepare(`
      INSERT INTO customers (
        code, name, phone, email, address, city, state, pincode, gstin, price_group, credit_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      custCode, name.trim(), phone || null, email || null, address || null,
      city || 'Mumbai', state || 'Maharashtra', pincode || null, gstin || null,
      priceGroup || 'RETAIL', creditLimit || 0
    );
    return { success: true, id: res.lastInsertRowid };
  }
}

/**
 * List suppliers with optional search.
 */
function listSuppliers(search = '') {
  const db = getDatabase();
  const trimmed = (search || '').trim();

  if (!trimmed) {
    return db.prepare(`
      SELECT * FROM suppliers WHERE status = 'ACTIVE' ORDER BY name ASC
    `).all();
  }

  const pat = `%${trimmed}%`;
  return db.prepare(`
    SELECT * FROM suppliers
    WHERE (name LIKE ? OR phone LIKE ? OR code LIKE ? OR gstin LIKE ?)
    ORDER BY name ASC
  `).all(pat, pat, pat, pat);
}

/**
 * Save supplier.
 */
function saveSupplier(supplierData) {
  const db = getDatabase();
  const { id, code, name, contactPerson, phone, email, address, city, state, pincode, gstin, drugLicenseNo, terms, creditLimit } = supplierData;

  if (!name || !name.trim()) throw new Error('Supplier name is required');

  if (id) {
    db.prepare(`
      UPDATE suppliers SET
        name = ?, contact_person = ?, phone = ?, email = ?, address = ?,
        city = ?, state = ?, pincode = ?, gstin = ?, drug_license_no = ?,
        payment_terms_days = ?, credit_limit = ?
      WHERE id = ?
    `).run(
      name.trim(), contactPerson || null, phone || null, email || null, address || null,
      city || 'Mumbai', state || 'Maharashtra', pincode || null, gstin || null,
      drugLicenseNo || null, terms || 30, creditLimit || 0, id
    );
    return { success: true, id };
  } else {
    const supCode = code || `SUP-${Date.now().toString().slice(-4)}`;
    const res = db.prepare(`
      INSERT INTO suppliers (
        code, name, contact_person, phone, email, address, city, state,
        pincode, gstin, drug_license_no, payment_terms_days, credit_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      supCode, name.trim(), contactPerson || null, phone || null, email || null,
      address || null, city || 'Mumbai', state || 'Maharashtra', pincode || null,
      gstin || null, drugLicenseNo || null, terms || 30, creditLimit || 0
    );
    return { success: true, id: res.lastInsertRowid };
  }
}

/**
 * Get company profile and settings.
 */
function getCompanyDetails() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM companies LIMIT 1').get();
}

function updateCompanyDetails(comp) {
  const db = getDatabase();
  db.prepare(`
    UPDATE companies SET
      name = ?, trade_name = ?, gstin = ?, drug_license_no_1 = ?, drug_license_no_2 = ?,
      fssai_no = ?, phone = ?, email = ?, address_line1 = ?, city = ?, state = ?,
      pincode = ?, bank_name = ?, bank_account_no = ?, bank_ifsc = ?, upi_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    comp.name, comp.trade_name, comp.gstin, comp.drug_license_no_1, comp.drug_license_no_2,
    comp.fssai_no, comp.phone, comp.email, comp.address_line1, comp.city, comp.state,
    comp.pincode, comp.bank_name, comp.bank_account_no, comp.bank_ifsc, comp.upi_id,
    comp.id
  );
  return { success: true };
}

function getAppSettings() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM app_settings ORDER BY category, setting_key').all();
}

function updateAppSetting(key, val) {
  const db = getDatabase();
  db.prepare('UPDATE app_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?').run(val, key);
  return { success: true };
}

module.exports = {
  listCustomers,
  saveCustomer,
  listSuppliers,
  saveSupplier,
  getCompanyDetails,
  updateCompanyDetails,
  getAppSettings,
  updateAppSetting,
};
