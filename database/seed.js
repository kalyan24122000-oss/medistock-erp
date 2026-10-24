// database/seed.js
// Comprehensive Pharmacy Demo Data Generator for MediStock ERP

const bcrypt = require('bcryptjs');
const { getDatabase } = require('./db');
const { initializeSchema } = require('./schema');

function seedDatabase(db) {
  const database = db || getDatabase();
  initializeSchema(database);

  database.transaction(() => {
    // Check if company already seeded
    const companyExists = database.prepare('SELECT id FROM companies WHERE code = ?').get('APEX-HO');
    if (companyExists) {
      console.log('Database already seeded. Skipping.');
      return;
    }

    console.log('Seeding MediStock ERP database...');

    // 1. Company
    const companyResult = database.prepare(`
      INSERT INTO companies (
        code, name, trade_name, gstin, drug_license_no_1, drug_license_no_2,
        fssai_no, pan, address_line1, address_line2, city, state, state_code,
        pincode, phone, email, website, bank_name, bank_account_no, bank_ifsc, upi_id
      ) VALUES (
        'APEX-HO', 'Apex Medicos & Healthcare ERP Pvt Ltd', 'Apex Pharmacy',
        '27AABCA1234F1Z8', 'MH-WZ-123456', 'MH-WZ-123457',
        '10020030040050', 'AABCA1234F', 'Shop 4-5, Ground Floor, Central Plaza',
        'M.G. Road, Opp. Civil Hospital', 'Mumbai', 'Maharashtra', '27',
        '400001', '+91 98200 98200', 'contact@apexpharmacy.local', 'www.apexpharmacy.local',
        'HDFC Bank', '50200012345678', 'HDFC0000123', 'apexpharmacy@hdfcbank'
      )
    `).run();
    const companyId = companyResult.lastInsertRowid;

    // 2. Head Office Branch
    const branchResult = database.prepare(`
      INSERT INTO branches (
        company_id, code, name, address, phone, email, is_head_office, status
      ) VALUES (
        ?, 'BR-CENTRAL', 'Apex Pharmacy - Main Central Plaza',
        'Shop 4-5, Ground Floor, Central Plaza, M.G. Road, Mumbai 400001',
        '+91 98200 98200', 'central@apexpharmacy.local', 1, 'ACTIVE'
      )
    `).run(companyId);
    const branchId = branchResult.lastInsertRowid;

    // 3. Financial Year
    const fyResult = database.prepare(`
      INSERT INTO financial_years (
        company_id, code, start_date, end_date, is_closed, is_active
      ) VALUES (
        ?, 'FY-2026-27', '2026-04-01', '2027-03-31', 0, 1
      )
    `).run(companyId);
    const fyId = fyResult.lastInsertRowid;

    // 4. Roles
    const roles = [
      { name: 'Administrator', desc: 'Full system and financial access', is_sys: 1 },
      { name: 'Pharmacist', desc: 'Medicine dispensing, Schedule H verification, stock inspection', is_sys: 1 },
      { name: 'Billing Operator', desc: 'POS billing, receipts, customer lookups', is_sys: 1 },
      { name: 'Purchase Manager', desc: 'Purchase orders, GRN, supplier invoices', is_sys: 1 },
      { name: 'Accountant', desc: 'Double-entry vouchers, GST reports, financial statements', is_sys: 1 },
      { name: 'Auditor', desc: 'Read-only access to audit registers and ledgers', is_sys: 1 },
    ];

    const roleMap = {};
    const insertRole = database.prepare(`
      INSERT INTO roles (name, description, is_system) VALUES (?, ?, ?)
    `);
    for (const r of roles) {
      const res = insertRole.run(r.name, r.desc, r.is_sys);
      roleMap[r.name] = res.lastInsertRowid;
    }

    // 5. Users
    const passwordSalt = 10;
    const adminHash = bcrypt.hashSync('admin123', passwordSalt);
    const cashierHash = bcrypt.hashSync('cashier123', passwordSalt);
    const pharmaHash = bcrypt.hashSync('pharma123', passwordSalt);

    const insertUser = database.prepare(`
      INSERT INTO users (username, password_hash, full_name, email, phone, role_id, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const adminUserId = insertUser.run('admin', adminHash, 'Rajesh Patel (Owner/Admin)', 'admin@apexpharmacy.local', '9820100001', roleMap['Administrator'], branchId).lastInsertRowid;
    insertUser.run('cashier', cashierHash, 'Suresh Kumar (Cashier)', 'cashier@apexpharmacy.local', '9820100002', roleMap['Billing Operator'], branchId);
    insertUser.run('pharmacist', pharmaHash, 'Dr. Amit Deshmukh (Reg. Pharmacist)', 'pharma@apexpharmacy.local', '9820100003', roleMap['Pharmacist'], branchId);

    // 6. Chart of Accounts
    const accountsData = [
      // Assets
      { code: '1010', name: 'Cash in Hand', group: 'ASSET', opening: 25000000 }, // ₹2,50,000 opening cash
      { code: '1020', name: 'HDFC Bank Current A/c', group: 'ASSET', opening: 25000000 }, // ₹2,50,000 opening bank
      { code: '1025', name: 'UPI / Digital Clearing A/c', group: 'ASSET' },
      { code: '1030', name: 'Sundry Debtors (Customer Ledger)', group: 'ASSET' },
      { code: '1040', name: 'Stock-in-Hand (Inventory Asset)', group: 'ASSET' },
      { code: '1050', name: 'Input CGST A/c', group: 'ASSET' },
      { code: '1055', name: 'Input SGST A/c', group: 'ASSET' },
      { code: '1060', name: 'Input IGST A/c', group: 'ASSET' },
      // Liabilities
      { code: '2010', name: 'Sundry Creditors (Supplier Ledger)', group: 'LIABILITY' },
      { code: '2020', name: 'Output CGST A/c', group: 'LIABILITY' },
      { code: '2025', name: 'Output SGST A/c', group: 'LIABILITY' },
      { code: '2030', name: 'Output IGST A/c', group: 'LIABILITY' },
      { code: '2040', name: 'Outstanding Expenses Payable', group: 'LIABILITY' },
      // Equity
      { code: '3010', name: "Owner's Capital Account", group: 'EQUITY', opening: 50000000 }, // ₹5,00,000 opening capital
      { code: '3020', name: 'Retained Earnings', group: 'EQUITY' },
      // Income
      { code: '4010', name: 'Retail Pharmacy Sales', group: 'INCOME' },
      { code: '4020', name: 'Wholesale Medicine Sales', group: 'INCOME' },
      { code: '4030', name: 'Purchase Discounts Received', group: 'INCOME' },
      // Expenses
      { code: '5010', name: 'Cost of Goods Sold (COGS)', group: 'EXPENSE' },
      { code: '5020', name: 'Medicine Purchases', group: 'EXPENSE' },
      { code: '5030', name: 'Sales Discounts Allowed', group: 'EXPENSE' },
      { code: '5040', name: 'Shop Rent & Maintenance', group: 'EXPENSE' },
      { code: '5050', name: 'Electricity & Utility Expense', group: 'EXPENSE' },
      { code: '5060', name: 'Pharmacist & Staff Salary', group: 'EXPENSE' },
      { code: '5070', name: 'Expiry & Damaged Stock Loss', group: 'EXPENSE' },
    ];

    const insertAccount = database.prepare(`
      INSERT INTO accounts (code, name, group_name, opening_balance, current_balance, is_system)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    for (const a of accountsData) {
      insertAccount.run(a.code, a.name, a.group, a.opening || 0, a.opening || 0);
    }

    // 7. Tax Configurations
    const taxes = [
      { name: 'GST 0% (Exempt)', rate: 0.0, cgst: 0.0, sgst: 0.0, igst: 0.0, def: 0 },
      { name: 'GST 5%', rate: 5.0, cgst: 2.5, sgst: 2.5, igst: 5.0, def: 0 },
      { name: 'GST 12%', rate: 12.0, cgst: 6.0, sgst: 6.0, igst: 12.0, def: 1 },
      { name: 'GST 18%', rate: 18.0, cgst: 9.0, sgst: 9.0, igst: 18.0, def: 0 },
    ];
    const insertTax = database.prepare(`
      INSERT INTO tax_configurations (tax_name, rate_percent, cgst_percent, sgst_percent, igst_percent, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const t of taxes) {
      insertTax.run(t.name, t.rate, t.cgst, t.sgst, t.igst, t.def);
    }

    // 8. Categories
    const categories = [
      { name: 'Antibiotics', desc: 'Antimicrobial and antibacterial medicines', hsn: '3004' },
      { name: 'Analgesics & Antipyretics', desc: 'Pain relief and fever reduction', hsn: '3004' },
      { name: 'Antacids & Gastrointestinal', desc: 'Acidity, GERD, and stomach care', hsn: '3004' },
      { name: 'Antidiabetic', desc: 'Blood sugar management', hsn: '3004' },
      { name: 'Cardiac & Antihypertensive', desc: 'Blood pressure and heart care', hsn: '3004' },
      { name: 'Respiratory & Anti-allergic', desc: 'Cough, cold, asthma and allergies', hsn: '3004' },
      { name: 'Vitamins & Minerals', desc: 'Nutritional and immunity supplements', hsn: '2106' },
      { name: 'Sedatives & Controlled', desc: 'Schedule H1 and controlled molecules', hsn: '3004' },
    ];
    const catMap = {};
    const insertCat = database.prepare(`
      INSERT INTO medicine_categories (name, description, hsn_code, default_tax_rate)
      VALUES (?, ?, ?, 1200)
    `);
    for (const c of categories) {
      const res = insertCat.run(c.name, c.desc, c.hsn);
      catMap[c.name] = res.lastInsertRowid;
    }

    // 9. Manufacturers
    const manufacturers = [
      { code: 'SUN', name: 'Sun Pharmaceutical Industries Ltd', contact: 'M. Sharma', phone: '022-24987000' },
      { code: 'CIPLA', name: 'Cipla Ltd', contact: 'V. Rao', phone: '022-24826000' },
      { code: 'ABBOTT', name: 'Abbott Healthcare Pvt Ltd', contact: 'R. Kulkarni', phone: '022-67978888' },
      { code: 'ALKEM', name: 'Alkem Laboratories Ltd', contact: 'P. Singh', phone: '022-39829999' },
      { code: 'TORRENT', name: 'Torrent Pharmaceuticals Ltd', contact: 'D. Shah', phone: '079-27459000' },
      { code: 'GLENMARK', name: 'Glenmark Pharmaceuticals Ltd', contact: 'K. Fernandes', phone: '022-40189999' },
      { code: 'MICRO', name: 'Micro Labs Limited', contact: 'A. Joshi', phone: '080-22278000' },
    ];
    const mfgMap = {};
    const insertMfg = database.prepare(`
      INSERT INTO manufacturers (code, name, contact_person, phone) VALUES (?, ?, ?, ?)
    `);
    for (const m of manufacturers) {
      const res = insertMfg.run(m.code, m.name, m.contact, m.phone);
      mfgMap[m.code] = res.lastInsertRowid;
    }

    // 10. Salt Compositions
    const salts = [
      { name: 'Paracetamol 650mg', sched: 'NONE', desc: 'Analgesic, Antipyretic' },
      { name: 'Amoxicillin 500mg + Clavulanic Acid 125mg', sched: 'SCHEDULE_H', desc: 'Broad-spectrum beta-lactam antibiotic' },
      { name: 'Azithromycin 500mg', sched: 'SCHEDULE_H', desc: 'Macrolide antibiotic' },
      { name: 'Pantoprazole 40mg + Domperidone 30mg', sched: 'NONE', desc: 'Proton-pump inhibitor with prokinetic' },
      { name: 'Metformin 500mg + Glimepiride 2mg', sched: 'NONE', desc: 'Oral hypoglycemic agent' },
      { name: 'Telmisartan 40mg', sched: 'SCHEDULE_H', desc: 'Angiotensin II receptor blocker' },
      { name: 'Montelukast 10mg + Levocetirizine 5mg', sched: 'NONE', desc: 'Leukotriene receptor antagonist + antihistamine' },
      { name: 'Vitamin C 500mg + Zinc 10mg', sched: 'NONE', desc: 'Immunity booster' },
      { name: 'Tramadol 37.5mg + Paracetamol 325mg', sched: 'SCHEDULE_H1', desc: 'Moderate to severe pain management' },
      { name: 'Alprazolam 0.5mg', sched: 'SCHEDULE_H1', desc: 'Short-acting anxiolytic benzodiazepine' },
    ];
    const saltMap = {};
    const insertSalt = database.prepare(`
      INSERT INTO salt_compositions (name, schedule_type, description) VALUES (?, ?, ?)
    `);
    for (const s of salts) {
      const res = insertSalt.run(s.name, s.sched, s.desc);
      saltMap[s.name] = res.lastInsertRowid;
    }

    // 11. Suppliers
    const suppliers = [
      {
        code: 'SUP-001',
        name: 'Mahaveer Medical Distributors',
        contact: 'Kishore Jain',
        phone: '9820111222',
        email: 'sales@mahaveermedical.in',
        address: 'Gala 12, New Wholesale Pharma Market, Princess Street',
        city: 'Mumbai',
        gstin: '27AABCM8901F1Z2',
        dl: 'MH-DIST-1011',
        terms: 30,
        balance: 1450000, // ₹14,500 payable
      },
      {
        code: 'SUP-002',
        name: 'Metro Pharma Wholesalers',
        contact: 'Deepak Merchant',
        phone: '9820222333',
        email: 'orders@metropharma.in',
        address: 'Plot 45, MIDC Industrial Area, Andheri East',
        city: 'Mumbai',
        gstin: '27AABCM8902F1Z3',
        dl: 'MH-DIST-1012',
        terms: 21,
        balance: 2800000, // ₹28,000 payable
      },
      {
        code: 'SUP-003',
        name: 'Shree Ganesh Lifesciences',
        contact: 'Ganesh Shinde',
        phone: '9820333444',
        email: 'accounts@ganeshpharma.in',
        address: 'Shop 8, Station Road, Dadar West',
        city: 'Mumbai',
        gstin: '27AABCS9912F1Z5',
        dl: 'MH-DIST-1013',
        terms: 15,
        balance: 0,
      },
    ];
    const supMap = {};
    const insertSup = database.prepare(`
      INSERT INTO suppliers (
        code, name, contact_person, phone, email, address, city,
        gstin, drug_license_no, payment_terms_days, opening_balance, current_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of suppliers) {
      const res = insertSup.run(
        s.code, s.name, s.contact, s.phone, s.email, s.address, s.city,
        s.gstin, s.dl, s.terms, s.balance, s.balance
      );
      supMap[s.code] = res.lastInsertRowid;
    }

    // 12. Customers
    const customers = [
      {
        code: 'CUST-001',
        name: 'Counter Cash / Walk-in Customer',
        phone: '9999999999',
        group: 'RETAIL',
        limit: 0,
        balance: 0,
      },
      {
        code: 'CUST-002',
        name: 'Rajesh Sharma (Chronic Patient)',
        phone: '9820011223',
        address: 'B-402, Sea View Apartments, Worli',
        group: 'RETAIL',
        limit: 500000, // ₹5,000 credit limit
        balance: 85000, // ₹850 customer debit
      },
      {
        code: 'CUST-003',
        name: 'Sunita Verma',
        phone: '9820044556',
        address: '12, Sunrise Society, Bandra West',
        group: 'RETAIL',
        limit: 300000,
        balance: 0,
      },
      {
        code: 'CUST-004',
        name: 'Anand Day Care Clinic & Nursing Home',
        phone: '9820099887',
        address: 'Opp. Railway Station, Dadar',
        gstin: '27AABCA9000F1Z1',
        group: 'WHOLESALE',
        limit: 5000000, // ₹50,000 wholesale credit limit
        balance: 1820000, // ₹18,200 balance
      },
    ];
    const custMap = {};
    const insertCust = database.prepare(`
      INSERT INTO customers (
        code, name, phone, address, gstin, price_group, credit_limit, opening_balance, current_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of customers) {
      const res = insertCust.run(
        c.code, c.name, c.phone, c.address || null, c.gstin || null,
        c.group, c.limit, c.balance, c.balance
      );
      custMap[c.code] = res.lastInsertRowid;
    }

    // Patient Profiles & Prescriptions
    const patRes = database.prepare(`
      INSERT INTO patient_profiles (customer_id, name, age, gender, doctor_name, doctor_reg_no, notes)
      VALUES (?, 'Rajesh Sharma', 54, 'M', 'Dr. Vivek Mehta (MD Card)', 'MCI-45892', 'Hypertension & Type 2 Diabetes')
    `).run(custMap['CUST-002']);
    const patId = patRes.lastInsertRowid;

    database.prepare(`
      INSERT INTO prescriptions (patient_id, customer_id, doctor_name, doctor_reg_no, prescription_date, notes)
      VALUES (?, ?, 'Dr. Vivek Mehta', 'MCI-45892', '2026-10-01', 'Telma 40 OD, Glycomet GP2 BD for 3 months')
    `).run(patId, custMap['CUST-002']);

    // 13. Products Master
    const productsData = [
      {
        code: 'MED-001',
        barcode: '890123456001',
        brand: 'Dolo 650 Tablet',
        generic: 'Paracetamol 650mg',
        salt: 'Paracetamol 650mg',
        mfg: 'MICRO',
        cat: 'Analgesics & Antipyretics',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15, // 1 Box = 15 Strips (15 tabs per strip)
        p_rate: 2600, // ₹26.00 per strip purchase
        mrp: 3415, // ₹34.15 per strip MRP
        s_price: 3300, // ₹33.00 retail
        reorder: 20,
        rack: 'R1-S2',
        sched: 'NONE',
        rx: 0,
      },
      {
        code: 'MED-002',
        barcode: '890123456002',
        brand: 'Augmentin 625 Duo Tablet',
        generic: 'Amoxicillin + Clavulanic Acid',
        salt: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
        mfg: 'SUN',
        cat: 'Antibiotics',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 10, // 10 tablets per strip
        p_rate: 16500, // ₹165.00
        mrp: 22340, // ₹223.40
        s_price: 21500, // ₹215.00
        reorder: 15,
        rack: 'R2-S1',
        sched: 'SCHEDULE_H',
        rx: 1,
      },
      {
        code: 'MED-003',
        barcode: '890123456003',
        brand: 'Azithral 500 Tablet',
        generic: 'Azithromycin 500mg',
        salt: 'Azithromycin 500mg',
        mfg: 'CIPLA',
        cat: 'Antibiotics',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 5, // 5 tablets per strip
        p_rate: 9800, // ₹98.00
        mrp: 13200, // ₹132.00
        s_price: 12800, // ₹128.00
        reorder: 10,
        rack: 'R2-S2',
        sched: 'SCHEDULE_H',
        rx: 1,
      },
      {
        code: 'MED-004',
        barcode: '890123456004',
        brand: 'Pan-D Capsule',
        generic: 'Pantoprazole + Domperidone',
        salt: 'Pantoprazole 40mg + Domperidone 30mg',
        mfg: 'ALKEM',
        cat: 'Antacids & Gastrointestinal',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15,
        p_rate: 14500,
        mrp: 19900,
        s_price: 19000,
        reorder: 25,
        rack: 'R3-S1',
        sched: 'NONE',
        rx: 0,
      },
      {
        code: 'MED-005',
        barcode: '890123456005',
        brand: 'Glycomet GP 2 Tablet',
        generic: 'Metformin + Glimepiride',
        salt: 'Metformin 500mg + Glimepiride 2mg',
        mfg: 'SUN',
        cat: 'Antidiabetic',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15,
        p_rate: 18000,
        mrp: 24500,
        s_price: 23500,
        reorder: 20,
        rack: 'R3-S3',
        sched: 'NONE',
        rx: 1,
      },
      {
        code: 'MED-006',
        barcode: '890123456006',
        brand: 'Telma 40 Tablet',
        generic: 'Telmisartan 40mg',
        salt: 'Telmisartan 40mg',
        mfg: 'GLENMARK',
        cat: 'Cardiac & Antihypertensive',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 30, // 30 tablets blister pack
        p_rate: 19000,
        mrp: 26000,
        s_price: 25000,
        reorder: 15,
        rack: 'R4-S1',
        sched: 'SCHEDULE_H',
        rx: 1,
      },
      {
        code: 'MED-007',
        barcode: '890123456007',
        brand: 'Montair-LC Tablet',
        generic: 'Montelukast + Levocetirizine',
        salt: 'Montelukast 10mg + Levocetirizine 5mg',
        mfg: 'CIPLA',
        cat: 'Respiratory & Anti-allergic',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 10,
        p_rate: 15500,
        mrp: 21800,
        s_price: 20500,
        reorder: 20,
        rack: 'R4-S2',
        sched: 'NONE',
        rx: 0,
      },
      {
        code: 'MED-008',
        barcode: '890123456008',
        brand: 'Limcee 500mg Chewable',
        generic: 'Vitamin C + Zinc',
        salt: 'Vitamin C 500mg + Zinc 10mg',
        mfg: 'ABBOTT',
        cat: 'Vitamins & Minerals',
        hsn: '2106',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15,
        p_rate: 2200,
        mrp: 3100,
        s_price: 2900,
        reorder: 30,
        rack: 'R5-S1',
        sched: 'NONE',
        rx: 0,
      },
      {
        code: 'MED-009',
        barcode: '890123456009',
        brand: 'Ultracet Tablet',
        generic: 'Tramadol + Paracetamol',
        salt: 'Tramadol 37.5mg + Paracetamol 325mg',
        mfg: 'TORRENT',
        cat: 'Sedatives & Controlled',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15,
        p_rate: 19500,
        mrp: 27500,
        s_price: 26500,
        reorder: 10,
        rack: 'LOCKER-1',
        sched: 'SCHEDULE_H1',
        rx: 1,
      },
      {
        code: 'MED-010',
        barcode: '890123456010',
        brand: 'Alprax 0.5mg Tablet',
        generic: 'Alprazolam 0.5mg',
        salt: 'Alprazolam 0.5mg',
        mfg: 'TORRENT',
        cat: 'Sedatives & Controlled',
        hsn: '3004',
        tax: 1200,
        p_unit: 'Box',
        s_unit: 'Strip',
        ratio: 15,
        p_rate: 3400,
        mrp: 4800,
        s_price: 4500,
        reorder: 10,
        rack: 'LOCKER-2',
        sched: 'SCHEDULE_H1',
        rx: 1,
      },
    ];

    const prodMap = {};
    const insertProd = database.prepare(`
      INSERT INTO products (
        code, barcode, brand_name, generic_name, salt_id, manufacturer_id,
        category_id, hsn_code, tax_rate, purchase_unit, sale_unit, conversion_ratio,
        purchase_rate, mrp, selling_price, reorder_level, rack_shelf,
        schedule_type, is_prescription_required, is_loose_allowed
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 1
      )
    `);

    for (const p of productsData) {
      const res = insertProd.run(
        p.code, p.barcode, p.brand, p.generic, saltMap[p.salt] || null,
        mfgMap[p.mfg] || null, catMap[p.cat] || null, p.hsn, p.tax,
        p.p_unit, p.s_unit, p.ratio, p.p_rate, p.mrp, p.s_price,
        p.reorder, p.rack, p.sched, p.rx
      );
      prodMap[p.code] = res.lastInsertRowid;
    }

    // 14. Batches & Stock Movements (FEFO, Expired, Near-Expiry, Fresh)
    const batchesData = [
      // Dolo 650: Batch 1 (Fresh), Batch 2 (Near-Expiry in 35 days for testing FEFO), Batch 3 (Expired)
      {
        prod: 'MED-001',
        b_num: 'DL-24A01',
        mfg_date: '2024-05-01',
        exp_date: '2027-04-30',
        p_rate: 2600,
        mrp: 3415,
        s_price: 3300,
        qty: 120, // 120 strips
        rack: 'R1-S2-A',
      },
      {
        prod: 'MED-001',
        b_num: 'DL-23K12',
        mfg_date: '2023-11-01',
        exp_date: '2026-11-30', // Near expiry (~37 days)
        p_rate: 2500,
        mrp: 3200,
        s_price: 3100,
        qty: 35,
        rack: 'R1-S2-B',
      },
      {
        prod: 'MED-001',
        b_num: 'DL-22H05',
        mfg_date: '2022-08-01',
        exp_date: '2026-09-30', // Expired stock (~24 days ago)
        p_rate: 2400,
        mrp: 3000,
        s_price: 2900,
        qty: 18,
        rack: 'QUARANTINE-EXP',
      },
      // Augmentin 625 Duo: Fresh & Near-Expiry
      {
        prod: 'MED-002',
        b_num: 'AG-24F91',
        mfg_date: '2024-06-01',
        exp_date: '2027-05-31',
        p_rate: 16500,
        mrp: 22340,
        s_price: 21500,
        qty: 50,
        rack: 'R2-S1',
      },
      {
        prod: 'MED-002',
        b_num: 'AG-23M02',
        mfg_date: '2023-12-01',
        exp_date: '2026-12-15', // Near expiry (~52 days)
        p_rate: 16000,
        mrp: 21500,
        s_price: 20500,
        qty: 15,
        rack: 'R2-S1-FRONT',
      },
      // Azithral 500
      {
        prod: 'MED-003',
        b_num: 'AZ-2408',
        mfg_date: '2024-08-01',
        exp_date: '2027-07-31',
        p_rate: 9800,
        mrp: 13200,
        s_price: 12800,
        qty: 60,
        rack: 'R2-S2',
      },
      // Pan-D
      {
        prod: 'MED-004',
        b_num: 'PD-2477',
        mfg_date: '2024-07-01',
        exp_date: '2027-06-30',
        p_rate: 14500,
        mrp: 19900,
        s_price: 19000,
        qty: 80,
        rack: 'R3-S1',
      },
      // Glycomet GP 2
      {
        prod: 'MED-005',
        b_num: 'GM-2401',
        mfg_date: '2024-01-01',
        exp_date: '2026-12-31', // Near expiry (~68 days)
        p_rate: 18000,
        mrp: 24500,
        s_price: 23500,
        qty: 45,
        rack: 'R3-S3',
      },
      // Telma 40
      {
        prod: 'MED-006',
        b_num: 'TL-2405',
        mfg_date: '2024-05-01',
        exp_date: '2027-04-30',
        p_rate: 19000,
        mrp: 26000,
        s_price: 25000,
        qty: 70,
        rack: 'R4-S1',
      },
      // Montair-LC
      {
        prod: 'MED-007',
        b_num: 'ML-2412',
        mfg_date: '2024-04-01',
        exp_date: '2027-03-31',
        p_rate: 15500,
        mrp: 21800,
        s_price: 20500,
        qty: 40,
        rack: 'R4-S2',
      },
      // Limcee
      {
        prod: 'MED-008',
        b_num: 'LC-2490',
        mfg_date: '2024-09-01',
        exp_date: '2027-08-31',
        p_rate: 2200,
        mrp: 3100,
        s_price: 2900,
        qty: 150,
        rack: 'R5-S1',
      },
      // Ultracet (Schedule H1)
      {
        prod: 'MED-009',
        b_num: 'UL-2444',
        mfg_date: '2024-03-01',
        exp_date: '2027-02-28',
        p_rate: 19500,
        mrp: 27500,
        s_price: 26500,
        qty: 30,
        rack: 'LOCKER-1',
      },
      // Alprax (Schedule H1 / Narcotic)
      {
        prod: 'MED-010',
        b_num: 'AL-2422',
        mfg_date: '2024-02-01',
        exp_date: '2027-01-31',
        p_rate: 3400,
        mrp: 4800,
        s_price: 4500,
        qty: 25,
        rack: 'LOCKER-2',
      },
    ];

    const insertBatch = database.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiry_date,
        purchase_rate, mrp, selling_price, initial_qty, available_qty,
        rack_location, supplier_id, is_blocked
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const insertMovement = database.prepare(`
      INSERT INTO stock_movements (
        batch_id, product_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, rate, remarks, user_id, branch_id
      ) VALUES (
        ?, ?, 'OPENING', 'OPENING_STOCK', 'INIT-2026',
        ?, 'Strip', 0, ?, ?, 'Opening Stock Initial Balance', ?, ?
      )
    `);

    for (const b of batchesData) {
      const pId = prodMap[b.prod];
      const isExpired = b.exp_date < '2026-10-24';
      const bRes = insertBatch.run(
        pId, b.b_num, b.mfg_date, b.exp_date,
        b.p_rate, b.mrp, b.s_price, b.qty, b.qty,
        b.rack, supMap['SUP-001'], isExpired ? 1 : 0
      );
      const bId = bRes.lastInsertRowid;

      // Record movement ledger to guarantee audit trail matches current available_qty!
      insertMovement.run(
        bId, pId, b.qty, b.qty, b.p_rate, adminUserId, branchId
      );
    }

    // 15. Invoice Sequences
    const seqs = [
      { type: 'RETAIL_SALE', prefix: 'INV-26/', start: 100 },
      { type: 'WHOLESALE_SALE', prefix: 'WS-26/', start: 10 },
      { type: 'PURCHASE', prefix: 'PUR-26/', start: 50 },
      { type: 'SALE_RETURN', prefix: 'SRT-26/', start: 5 },
      { type: 'PURCHASE_RETURN', prefix: 'PRT-26/', start: 2 },
      { type: 'RECEIPT', prefix: 'RCP-26/', start: 20 },
      { type: 'PAYMENT', prefix: 'PAY-26/', start: 20 },
      { type: 'JOURNAL', prefix: 'JRN-26/', start: 10 },
      { type: 'EXPENSE', prefix: 'EXP-26/', start: 15 },
    ];
    const insertSeq = database.prepare(`
      INSERT INTO invoice_sequences (
        branch_id, financial_year_id, sequence_type, prefix, current_number, padding_length
      ) VALUES (?, ?, ?, ?, ?, 5)
    `);
    for (const s of seqs) {
      insertSeq.run(branchId, fyId, s.type, s.prefix, s.start);
    }

    // 16. App Settings
    const settings = [
      { key: 'PRINT_FORMAT', val: 'THERMAL_80MM', cat: 'PRINTING', desc: 'Default bill print format (THERMAL_80MM or A4)' },
      { key: 'AUTO_FEFO', val: 'true', cat: 'INVENTORY', desc: 'Automatically suggest oldest non-expired batch first' },
      { key: 'NEAR_EXPIRY_DAYS', val: '60', cat: 'INVENTORY', desc: 'Threshold in days to flag near-expiry' },
      { key: 'ALLOW_LOOSE_BILLING', val: 'true', cat: 'BILLING', desc: 'Allow loose tablet billing from strips' },
      { key: 'MANDATORY_RX_SCHEDULE_H', val: 'true', cat: 'COMPLIANCE', desc: 'Prompt for Doctor Details on Schedule H/H1 sale' },
      { key: 'MAX_DISCOUNT_PERCENT', val: '15', cat: 'BILLING', desc: 'Maximum discount percent without manager approval' },
      { key: 'TAX_ROUND_OFF', val: 'true', cat: 'ACCOUNTING', desc: 'Round off invoice totals to nearest Rupee' },
      { key: 'TIMEZONE', val: 'Asia/Kolkata', cat: 'GENERAL', desc: 'Configured business timezone' },
      { key: 'BACKUP_RETENTION_DAYS', val: '30', cat: 'BACKUP', desc: 'Days to keep automated backup files' },
    ];
    const insertSetting = database.prepare(`
      INSERT INTO app_settings (setting_key, setting_value, category, description)
      VALUES (?, ?, ?, ?)
    `);
    for (const s of settings) {
      insertSetting.run(s.key, s.val, s.cat, s.desc);
    }

    console.log('Database successfully seeded with realistic pharmacy data!');
  })();
}

// If run directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
};
