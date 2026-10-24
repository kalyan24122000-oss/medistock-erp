// database/schema.js
// Complete Pharmacy ERP Database Schema & Versioned Migrations

const { getDatabase } = require('./db');

const SCHEMA_VERSION = 1;

/**
 * Initializes all database tables, foreign keys, and indexes.
 * @param {import('better-sqlite3').Database} [db]
 */
function initializeSchema(db) {
  const database = db || getDatabase();

  database.transaction(() => {
    // Migration tracking table
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      );
    `);

    // 1. Companies Master
    database.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        trade_name TEXT,
        gstin TEXT,
        drug_license_no_1 TEXT,
        drug_license_no_2 TEXT,
        fssai_no TEXT,
        pan TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT DEFAULT 'Maharashtra',
        state_code TEXT DEFAULT '27',
        pincode TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        bank_name TEXT,
        bank_account_no TEXT,
        bank_ifsc TEXT,
        upi_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Branches Master
    database.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        email TEXT,
        is_head_office INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Financial Years
    database.exec(`
      CREATE TABLE IF NOT EXISTS financial_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        code TEXT NOT NULL UNIQUE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_closed INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Roles
    database.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_system INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Permissions
    database.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        description TEXT
      );
    `);

    // 6. Role Permissions
    database.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // 7. Users
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        is_active INTEGER DEFAULT 1,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Manufacturers
    database.exec(`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT NOT NULL UNIQUE,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Medicine Categories
    database.exec(`
      CREATE TABLE IF NOT EXISTS medicine_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        hsn_code TEXT DEFAULT '3004',
        default_tax_rate INTEGER DEFAULT 1200, -- 12.00% stored as 1200 basis points
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Salt Compositions (Generic Molecules)
    database.exec(`
      CREATE TABLE IF NOT EXISTS salt_compositions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        schedule_type TEXT DEFAULT 'NONE', -- 'NONE', 'SCHEDULE_H', 'SCHEDULE_H1', 'NARCOTIC'
        indications TEXT,
        contraindications TEXT,
        side_effects TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Products / Medicines Master
    database.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        barcode TEXT,
        alt_barcode TEXT,
        brand_name TEXT NOT NULL,
        generic_name TEXT,
        salt_id INTEGER REFERENCES salt_compositions(id) ON DELETE SET NULL,
        manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES medicine_categories(id) ON DELETE SET NULL,
        hsn_code TEXT DEFAULT '3004',
        tax_rate INTEGER DEFAULT 1200, -- Basis points (1200 = 12.00%)
        purchase_unit TEXT DEFAULT 'Box',
        sale_unit TEXT DEFAULT 'Strip',
        conversion_ratio INTEGER DEFAULT 10, -- 1 Box = 10 Strips or 1 Strip = 10 Tablets
        purchase_rate INTEGER DEFAULT 0, -- Paise (e.g. 10000 = ₹100.00)
        mrp INTEGER DEFAULT 0, -- Paise
        selling_price INTEGER DEFAULT 0, -- Paise
        reorder_level INTEGER DEFAULT 10,
        max_level INTEGER DEFAULT 500,
        preferred_supplier_id INTEGER,
        rack_shelf TEXT,
        schedule_type TEXT DEFAULT 'NONE', -- 'NONE', 'SCHEDULE_H', 'SCHEDULE_H1', 'NARCOTIC'
        is_prescription_required INTEGER DEFAULT 0,
        is_narcotic INTEGER DEFAULT 0,
        is_loose_allowed INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_brand_name ON products(brand_name);
      CREATE INDEX IF NOT EXISTS idx_products_generic_name ON products(generic_name);
      CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    `);

    // 12. Product Packaging Units
    database.exec(`
      CREATE TABLE IF NOT EXISTS product_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        unit_name TEXT NOT NULL,
        conversion_to_base REAL NOT NULL DEFAULT 1.0,
        selling_rate INTEGER DEFAULT 0,
        is_default_sale INTEGER DEFAULT 0,
        is_default_purchase INTEGER DEFAULT 0
      );
    `);

    // 13. Suppliers
    database.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        trade_name TEXT,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'Maharashtra',
        state_code TEXT DEFAULT '27',
        pincode TEXT,
        gstin TEXT,
        drug_license_no TEXT,
        pan TEXT,
        payment_terms_days INTEGER DEFAULT 30,
        credit_limit INTEGER DEFAULT 0, -- Paise
        opening_balance INTEGER DEFAULT 0, -- Paise (positive = payable to supplier)
        current_balance INTEGER DEFAULT 0, -- Paise
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
      CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
    `);

    // 14. Customers
    database.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'Maharashtra',
        state_code TEXT DEFAULT '27',
        pincode TEXT,
        gstin TEXT,
        price_group TEXT DEFAULT 'RETAIL', -- 'RETAIL', 'WHOLESALE', 'STAFF'
        credit_limit INTEGER DEFAULT 0, -- Paise
        opening_balance INTEGER DEFAULT 0, -- Paise (positive = customer owes us)
        current_balance INTEGER DEFAULT 0, -- Paise
        loyalty_points INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    `);

    // 15. Patient Profiles
    database.exec(`
      CREATE TABLE IF NOT EXISTS patient_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        doctor_name TEXT,
        doctor_reg_no TEXT,
        doctor_hospital TEXT,
        allergies TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 16. Prescriptions
    database.exec(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER REFERENCES patient_profiles(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        doctor_name TEXT NOT NULL,
        doctor_reg_no TEXT,
        prescription_date TEXT NOT NULL,
        validity_date TEXT,
        notes TEXT,
        file_path TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 17. Batches Inventory
    database.exec(`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        batch_number TEXT NOT NULL,
        manufacturing_date TEXT,
        expiry_date TEXT NOT NULL, -- YYYY-MM-DD
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        purchase_invoice_id INTEGER,
        purchase_rate INTEGER DEFAULT 0, -- Paise
        mrp INTEGER NOT NULL, -- Paise
        selling_price INTEGER NOT NULL, -- Paise
        initial_qty REAL NOT NULL DEFAULT 0,
        available_qty REAL NOT NULL DEFAULT 0,
        reserved_qty REAL NOT NULL DEFAULT 0,
        damaged_qty REAL NOT NULL DEFAULT 0,
        blocked_qty REAL NOT NULL DEFAULT 0,
        rack_location TEXT,
        is_blocked INTEGER DEFAULT 0,
        block_reason TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, batch_number)
      );
      CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
      CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_batches_batch_num ON batches(batch_number);
    `);

    // 18. Stock Movements Ledger (The Audit Trail)
    database.exec(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL, -- 'OPENING', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB', 'DAMAGE'
        reference_type TEXT, -- 'SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN', 'PURCHASE_RETURN', 'MANUAL_ADJUSTMENT'
        reference_id TEXT,
        quantity REAL NOT NULL,
        unit TEXT,
        previous_qty REAL NOT NULL,
        new_qty REAL NOT NULL,
        rate INTEGER DEFAULT 0, -- Paise
        remarks TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
    `);

    // 19. Stock Reservations
    database.exec(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        reserved_qty REAL NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 20. Purchase Orders
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        po_date TEXT NOT NULL,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        total_taxable INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'PARTIAL', 'RECEIVED', 'CANCELLED'
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 21. Purchase Order Items
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL,
        unit TEXT,
        unit_rate INTEGER DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        tax_rate INTEGER DEFAULT 1200,
        line_total INTEGER DEFAULT 0
      );
    `);

    // 22. Goods Receipts (GRN)
    database.exec(`
      CREATE TABLE IF NOT EXISTS goods_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grn_number TEXT NOT NULL UNIQUE,
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        receipt_date TEXT NOT NULL,
        vehicle_no TEXT,
        delivery_challan_no TEXT,
        notes TEXT,
        status TEXT DEFAULT 'COMPLETED',
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 23. Purchase Invoices
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        supplier_invoice_no TEXT,
        invoice_date TEXT NOT NULL,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        financial_year_id INTEGER REFERENCES financial_years(id) ON DELETE SET NULL,
        total_items INTEGER DEFAULT 0,
        total_qty REAL DEFAULT 0,
        total_free_qty REAL DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        discount_amount INTEGER DEFAULT 0,
        taxable_amount INTEGER DEFAULT 0,
        cgst_amount INTEGER DEFAULT 0,
        sgst_amount INTEGER DEFAULT 0,
        igst_amount INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        round_off INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        paid_amount INTEGER DEFAULT 0,
        payment_status TEXT DEFAULT 'UNPAID', -- 'PAID', 'PARTIAL', 'UNPAID'
        due_date TEXT,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_purch_inv_supplier ON purchase_invoices(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purch_inv_date ON purchase_invoices(invoice_date);
    `);

    // 24. Purchase Invoice Items
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        batch_number TEXT NOT NULL,
        mfg_date TEXT,
        expiry_date TEXT NOT NULL,
        quantity REAL NOT NULL,
        free_qty REAL DEFAULT 0,
        unit TEXT,
        purchase_rate INTEGER NOT NULL,
        mrp INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        discount_percent REAL DEFAULT 0,
        taxable_amount INTEGER DEFAULT 0,
        tax_rate INTEGER DEFAULT 1200,
        cgst_amount INTEGER DEFAULT 0,
        sgst_amount INTEGER DEFAULT 0,
        igst_amount INTEGER DEFAULT 0,
        line_total INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_purch_item_inv ON purchase_invoice_items(purchase_invoice_id);
    `);

    // 25. Purchase Returns
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT NOT NULL UNIQUE,
        return_date TEXT NOT NULL,
        purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        reason TEXT,
        total_taxable INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        credit_note_status TEXT DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED'
        credit_note_ref TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 26. Purchase Return Items
    database.exec(`
      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL,
        unit TEXT,
        purchase_rate INTEGER NOT NULL,
        tax_rate INTEGER DEFAULT 1200,
        line_total INTEGER NOT NULL
      );
    `);

    // 27. Sales Invoices
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        invoice_type TEXT DEFAULT 'RETAIL', -- 'RETAIL', 'WHOLESALE'
        invoice_date TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT,
        customer_phone TEXT,
        patient_id INTEGER REFERENCES patient_profiles(id) ON DELETE SET NULL,
        doctor_name TEXT,
        doctor_reg_no TEXT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        financial_year_id INTEGER REFERENCES financial_years(id) ON DELETE SET NULL,
        total_items INTEGER DEFAULT 0,
        total_qty REAL DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        discount_amount INTEGER DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        taxable_amount INTEGER DEFAULT 0,
        cgst_amount INTEGER DEFAULT 0,
        sgst_amount INTEGER DEFAULT 0,
        igst_amount INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        round_off INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        payment_mode TEXT DEFAULT 'CASH', -- 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'SPLIT'
        payment_status TEXT DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'PENDING', 'PARTIAL', 'REFUNDED'
        is_cancelled INTEGER DEFAULT 0,
        cancel_reason TEXT,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sales_inv_number ON sales_invoices(invoice_number);
      CREATE INDEX IF NOT EXISTS idx_sales_inv_date ON sales_invoices(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_sales_inv_customer ON sales_invoices(customer_id);
    `);

    // 28. Sales Invoice Items
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT,
        mrp INTEGER NOT NULL,
        selling_rate INTEGER NOT NULL,
        discount_percent REAL DEFAULT 0,
        taxable_amount INTEGER DEFAULT 0,
        tax_rate INTEGER DEFAULT 1200,
        cgst_amount INTEGER DEFAULT 0,
        sgst_amount INTEGER DEFAULT 0,
        igst_amount INTEGER DEFAULT 0,
        line_total INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sales_item_inv ON sales_invoice_items(sales_invoice_id);
      CREATE INDEX IF NOT EXISTS idx_sales_item_prod ON sales_invoice_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_sales_item_batch ON sales_invoice_items(batch_id);
    `);

    // 29. Sales Returns
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT NOT NULL UNIQUE,
        return_date TEXT NOT NULL,
        sales_invoice_id INTEGER REFERENCES sales_invoices(id) ON DELETE RESTRICT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        reason TEXT,
        total_taxable INTEGER DEFAULT 0,
        total_tax INTEGER DEFAULT 0,
        grand_total INTEGER DEFAULT 0,
        refund_mode TEXT DEFAULT 'STORE_CREDIT', -- 'STORE_CREDIT', 'CASH', 'CUSTOMER_LEDGER'
        quarantine_status TEXT DEFAULT 'QUARANTINED', -- 'QUARANTINED', 'INSPECTED_DAMAGED', 'RETURNED_TO_STOCK'
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 30. Sales Return Items
    database.exec(`
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        sales_invoice_item_id INTEGER REFERENCES sales_invoice_items(id) ON DELETE RESTRICT,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL,
        unit TEXT,
        selling_rate INTEGER NOT NULL,
        tax_rate INTEGER DEFAULT 1200,
        line_total INTEGER NOT NULL
      );
    `);

    // 31. Payments (Receipts & Disbursements)
    database.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_number TEXT NOT NULL UNIQUE,
        payment_date TEXT NOT NULL,
        payment_type TEXT NOT NULL, -- 'RECEIPT', 'PAYMENT'
        party_type TEXT NOT NULL, -- 'CUSTOMER', 'SUPPLIER', 'OTHER'
        party_id INTEGER,
        amount INTEGER NOT NULL, -- Paise
        payment_mode TEXT DEFAULT 'CASH', -- 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'
        reference_no TEXT,
        status TEXT DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'PENDING', 'FAILED', 'REFUNDED'
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    `);

    // 32. Payment Allocations
    database.exec(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        voucher_type TEXT NOT NULL, -- 'SALES_INVOICE', 'PURCHASE_INVOICE'
        voucher_id INTEGER NOT NULL,
        allocated_amount INTEGER NOT NULL
      );
    `);

    // 33. Chart of Accounts
    database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        group_name TEXT NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'
        parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        opening_balance INTEGER DEFAULT 0,
        current_balance INTEGER DEFAULT 0,
        is_system INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_name);
    `);

    // 34. Journal Entries (Double-Entry Header)
    database.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_number TEXT NOT NULL UNIQUE,
        voucher_type TEXT NOT NULL, -- 'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'SALES_RETURN', 'PURCHASE_RETURN', 'JOURNAL', 'CONTRA', 'EXPENSE'
        entry_date TEXT NOT NULL,
        reference_id TEXT,
        narration TEXT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        financial_year_id INTEGER REFERENCES financial_years(id) ON DELETE SET NULL,
        total_amount INTEGER NOT NULL, -- Paise
        is_reversed INTEGER DEFAULT 0,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_journal_voucher ON journal_entries(voucher_number);
      CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
    `);

    // 35. Journal Entry Lines (Double-Entry Details)
    database.exec(`
      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        debit_amount INTEGER DEFAULT 0, -- Paise
        credit_amount INTEGER DEFAULT 0, -- Paise
        narration TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jlines_entry ON journal_entry_lines(journal_entry_id);
      CREATE INDEX IF NOT EXISTS idx_jlines_account ON journal_entry_lines(account_id);
    `);

    // 36. Expenses
    database.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_number TEXT NOT NULL UNIQUE,
        expense_date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payment_mode TEXT DEFAULT 'CASH',
        paid_to TEXT,
        tax_amount INTEGER DEFAULT 0,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 37. Tax Configurations
    database.exec(`
      CREATE TABLE IF NOT EXISTS tax_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_name TEXT NOT NULL UNIQUE,
        rate_percent REAL NOT NULL,
        cgst_percent REAL NOT NULL,
        sgst_percent REAL NOT NULL,
        igst_percent REAL NOT NULL,
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );
    `);

    // 38. Compliance Registers (Schedule H/H1, Narcotic registers)
    database.exec(`
      CREATE TABLE IF NOT EXISTS compliance_registers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_type TEXT NOT NULL, -- 'SCHEDULE_H', 'SCHEDULE_H1', 'NARCOTIC'
        transaction_type TEXT NOT NULL, -- 'SALE', 'PURCHASE'
        reference_id TEXT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL,
        doctor_name TEXT,
        doctor_reg_no TEXT,
        patient_name TEXT,
        patient_address TEXT,
        customer_phone TEXT,
        signature_acknowledged INTEGER DEFAULT 1,
        date_recorded TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_registers(register_type);
      CREATE INDEX IF NOT EXISTS idx_compliance_date ON compliance_registers(date_recorded);
    `);

    // 39. Audit Logs
    database.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `);

    // 40. App Settings
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        category TEXT DEFAULT 'GENERAL',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 41. Backup History
    database.exec(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha256_checksum TEXT NOT NULL,
        backup_type TEXT DEFAULT 'MANUAL', -- 'MANUAL', 'SCHEDULED', 'PRE_RESTORE'
        status TEXT DEFAULT 'SUCCESS',
        error_message TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 42. Invoice Sequences
    database.exec(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        financial_year_id INTEGER REFERENCES financial_years(id) ON DELETE SET NULL,
        sequence_type TEXT NOT NULL, -- 'RETAIL_SALE', 'WHOLESALE_SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'EXPENSE'
        prefix TEXT NOT NULL,
        current_number INTEGER DEFAULT 0,
        padding_length INTEGER DEFAULT 5,
        UNIQUE (branch_id, financial_year_id, sequence_type)
      );
    `);

    // 43. Document Attachments
    database.exec(`
      CREATE TABLE IF NOT EXISTS document_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Record schema version in migrations table
    const checkVersion = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(SCHEMA_VERSION);
    if (!checkVersion) {
      database.prepare(`
        INSERT INTO schema_migrations (version, description)
        VALUES (?, ?)
      `).run(SCHEMA_VERSION, 'Initial complete 43-table MediStock ERP schema');
    }
  })();
}

module.exports = {
  initializeSchema,
  SCHEMA_VERSION,
};
