// scripts/generate-templates.js
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const templateRows = [
  {
    'Product Code': 'MED001',
    'Barcode': '890103000101',
    'Brand Name': 'Paracetamol 650mg',
    'Generic Name': 'Paracetamol',
    'Salt Composition': 'Paracetamol',
    'Manufacturer': 'Micro Labs Ltd',
    'Category': 'Analgesics & Antipyretics',
    'HSN Code': '30049060',
    'Tax Rate (%)': 12,
    'Purchase Unit': 'Box',
    'Sale Unit': 'Strip',
    'Conversion Ratio': 10,
    'Purchase Rate (Rs)': 25.00,
    'MRP (Rs)': 33.15,
    'Selling Price (Rs)': 31.50,
    'Reorder Level': 20,
    'Max Level': 500,
    'Rack Location': 'R1-S2',
    'Schedule Type': 'NONE',
    'Prescription Required (Y/N)': 'N',
    'Loose Sale Allowed (Y/N)': 'Y'
  },
  {
    'Product Code': 'MED002',
    'Barcode': '890103000102',
    'Brand Name': 'Amoxicillin 500mg',
    'Generic Name': 'Amoxicillin Trihydrate',
    'Salt Composition': 'Amoxicillin Trihydrate',
    'Manufacturer': 'Cipla Ltd',
    'Category': 'Antibiotics',
    'HSN Code': '30041010',
    'Tax Rate (%)': 12,
    'Purchase Unit': 'Box',
    'Sale Unit': 'Strip',
    'Conversion Ratio': 10,
    'Purchase Rate (Rs)': 85.00,
    'MRP (Rs)': 115.00,
    'Selling Price (Rs)': 110.00,
    'Reorder Level': 15,
    'Max Level': 300,
    'Rack Location': 'R2-S1',
    'Schedule Type': 'SCHEDULE_H',
    'Prescription Required (Y/N)': 'Y',
    'Loose Sale Allowed (Y/N)': 'N'
  },
  {
    'Product Code': 'MED003',
    'Barcode': '890103000103',
    'Brand Name': 'Alprazolam 0.5mg',
    'Generic Name': 'Alprazolam',
    'Salt Composition': 'Alprazolam',
    'Manufacturer': 'Torrent Pharmaceuticals',
    'Category': 'CNS Agents & Sedatives',
    'HSN Code': '30049099',
    'Tax Rate (%)': 12,
    'Purchase Unit': 'Box',
    'Sale Unit': 'Strip',
    'Conversion Ratio': 15,
    'Purchase Rate (Rs)': 45.00,
    'MRP (Rs)': 62.00,
    'Selling Price (Rs)': 58.00,
    'Reorder Level': 10,
    'Max Level': 150,
    'Rack Location': 'LOCK-A1',
    'Schedule Type': 'SCHEDULE_H1',
    'Prescription Required (Y/N)': 'Y',
    'Loose Sale Allowed (Y/N)': 'N'
  }
];

const targetDir = path.join(__dirname, '..', 'templates');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Generate XLSX
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(templateRows);

// Set column widths
const colWidths = Object.keys(templateRows[0]).map(key => ({
  wch: Math.max(key.length, 16)
}));
ws['!cols'] = colWidths;

XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
const xlsxPath = path.join(targetDir, 'medicine_import_template.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log('Created Excel template:', xlsxPath);

// 2. Generate CSV
const csvContent = XLSX.utils.sheet_to_csv(ws);
const csvPath = path.join(targetDir, 'medicine_import_template.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log('Created CSV template:', csvPath);
