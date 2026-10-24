// services/export-service.js
// Excel/CSV Data Export and Import Utilities using XLSX

const XLSX = require('xlsx');

/**
 * Converts array of tabular records into an Excel (.xlsx) Buffer.
 * @param {Array<object>} data
 * @param {string} [sheetName='Report']
 * @returns {Buffer}
 */
function exportToExcelBuffer(data, sheetName = 'Report') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Converts array of tabular records into CSV string.
 * @param {Array<object>} data
 * @returns {string}
 */
function exportToCsvString(data) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Parses an Excel or CSV file buffer into an array of objects.
 * Useful for bulk importing medicines and purchase invoices.
 * @param {Buffer} buffer
 * @returns {Array<object>}
 */
function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

module.exports = {
  exportToExcelBuffer,
  exportToCsvString,
  parseSpreadsheetBuffer,
};
