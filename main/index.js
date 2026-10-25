// main/index.js
// Electron Main Process for MediStock ERP

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Database and domain services
const { getDatabase, closeDatabase } = require('../database/db');
const { seedDatabase } = require('../database/seed');
const authService = require('../services/auth-service');
const medicineService = require('../services/medicine-service');
const batchService = require('../services/batch-service');
const salesService = require('../services/sales-service');
const purchaseService = require('../services/purchase-service');
const returnService = require('../services/return-service');
const partyService = require('../services/party-service');
const accountingService = require('../services/accounting-service');
const gstService = require('../services/gst-service');
const complianceService = require('../services/compliance-service');
const reportService = require('../services/report-service');
const backupService = require('../services/backup-service');
const exportService = require('../services/export-service');
const licenseService = require('../services/license-service');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: 'PharmaDesk — Pharmacy ERP & POS',
    icon: path.join(__dirname, '../build/icon.ico'),
    show: true,
    frame: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Renderer Load Failed] ${errorCode}: ${errorDescription}`);
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register all IPC Handlers
function registerIpcHandlers() {
  // Auth & User Management
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    return authService.login(username, password);
  });
  ipcMain.handle('auth:changePassword', async (_, params) => {
    return authService.changePassword(params);
  });
  ipcMain.handle('auth:updateProfile', async (_, { userId, data }) => {
    return authService.updateUserProfile(userId, data);
  });
  ipcMain.handle('auth:adminResetPassword', async (_, { userId, newPassword }) => {
    return authService.adminResetPassword(userId, newPassword);
  });
  ipcMain.handle('auth:deleteUser', async (_, userId) => {
    return authService.deleteUser(userId);
  });
  ipcMain.handle('auth:getUserById', async (_, userId) => {
    return authService.getUserById(userId);
  });
  ipcMain.handle('auth:listUsers', async () => authService.listUsers());
  ipcMain.handle('auth:createUser', async (_, data) => authService.createUser(data));
  ipcMain.handle('auth:listRoles', async () => authService.listRoles());

  // Medicines
  ipcMain.handle('medicines:search', async (_, { query, options }) => medicineService.searchMedicines(query, options));
  ipcMain.handle('medicines:getById', async (_, id) => medicineService.getProductById(id));
  ipcMain.handle('medicines:save', async (_, data) => medicineService.saveProduct(data));
  ipcMain.handle('medicines:getMasters', async () => medicineService.getMedicineMasters());

  // Inventory & Batches
  ipcMain.handle('inventory:getBatches', async (_, { productId, includeExpired }) => batchService.getProductBatches(productId, includeExpired));
  ipcMain.handle('inventory:listBatches', async (_, filter) => batchService.listInventoryBatches(filter));
  ipcMain.handle('inventory:adjustStock', async (_, params) => batchService.adjustStock(params));
  ipcMain.handle('inventory:getMovementLedger', async (_, filter) => batchService.getStockMovementLedger(filter));

  // Sales
  ipcMain.handle('sales:calculateLine', async (_, item) => salesService.calculateLineItem(item));
  ipcMain.handle('sales:calculateTotals', async (_, { items, discPct, discAmt }) => salesService.calculateInvoiceTotals(items, discPct, discAmt));
  ipcMain.handle('sales:createInvoice', async (_, data) => salesService.createSalesInvoice(data));
  ipcMain.handle('sales:getInvoice', async (_, id) => salesService.getInvoiceDetails(id));
  ipcMain.handle('sales:listInvoices', async (_, filter) => salesService.listSalesInvoices(filter));

  // Purchase
  ipcMain.handle('purchase:createInvoice', async (_, data) => purchaseService.createPurchaseInvoice(data));
  ipcMain.handle('purchase:listInvoices', async (_, filter) => purchaseService.listPurchaseInvoices(filter));

  // Returns
  ipcMain.handle('returns:processSalesReturn', async (_, data) => returnService.processSalesReturn(data));
  ipcMain.handle('returns:processPurchaseReturn', async (_, data) => returnService.processPurchaseReturn(data));

  // Parties (Customers & Suppliers)
  ipcMain.handle('parties:listCustomers', async (_, search) => partyService.listCustomers(search));
  ipcMain.handle('parties:saveCustomer', async (_, data) => partyService.saveCustomer(data));
  ipcMain.handle('parties:listSuppliers', async (_, search) => partyService.listSuppliers(search));
  ipcMain.handle('parties:saveSupplier', async (_, data) => partyService.saveSupplier(data));

  // Double-Entry Accounting
  ipcMain.handle('accounts:getChart', async () => accountingService.getChartOfAccounts());
  ipcMain.handle('accounts:createVoucher', async (_, data) => accountingService.createJournalVoucher(data));
  ipcMain.handle('accounts:getLedger', async (_, { accountId, fromDate, toDate }) => accountingService.getAccountLedger(accountId, fromDate, toDate));
  ipcMain.handle('accounts:getTrialBalance', async (_, asOfDate) => accountingService.getTrialBalance(asOfDate));
  ipcMain.handle('accounts:getProfitAndLoss', async (_, { fromDate, toDate }) => accountingService.getProfitAndLoss(fromDate, toDate));
  ipcMain.handle('accounts:getBalanceSheet', async (_, asOfDate) => accountingService.getBalanceSheet(asOfDate));

  // GST
  ipcMain.handle('gst:getGstr1', async (_, { fromDate, toDate }) => gstService.getGstr1Report(fromDate, toDate));
  ipcMain.handle('gst:getGstr3b', async (_, { fromDate, toDate }) => gstService.getGstr3bReport(fromDate, toDate));
  ipcMain.handle('gst:getHsnSummary', async (_, { fromDate, toDate }) => gstService.getHsnSummary(fromDate, toDate));

  // Compliance
  ipcMain.handle('compliance:getRegister', async (_, { type, fromDate, toDate }) => complianceService.getComplianceRegister(type, fromDate, toDate));
  ipcMain.handle('compliance:traceBatch', async (_, { batchNumber, productId }) => complianceService.traceBatchHistory(batchNumber, productId));

  // Reports
  ipcMain.handle('reports:getDashboard', async () => reportService.getDashboardMetrics());
  ipcMain.handle('reports:getExpiry', async (_, filter) => reportService.getExpiryReport(filter));
  ipcMain.handle('reports:getReorder', async () => reportService.getReorderReport());
  ipcMain.handle('reports:getMovementAnalysis', async (_, days) => reportService.getMovementAnalysis(days));

  // Backup & Recovery
  ipcMain.handle('backup:createBackup', async (_, type) => backupService.createBackup(type));
  ipcMain.handle('backup:getHistory', async () => backupService.getBackupHistory());
  ipcMain.handle('backup:previewBackup', async (_, filePath) => backupService.previewBackup(filePath));
  ipcMain.handle('backup:restoreDatabase', async (_, filePath) => backupService.restoreDatabase(filePath));
  ipcMain.handle('backup:selectBackupFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select MediStock SQLite Backup File',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
      properties: ['openFile'],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  // Export to Excel / CSV with Save Dialog
  ipcMain.handle('export:toExcel', async (_, { data, fileName = 'MediStock_Export.xlsx' }) => {
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Excel File',
      defaultPath: fileName,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }],
    });
    if (saveDialog.canceled || !saveDialog.filePath) return { success: false };

    const buffer = exportService.exportToExcelBuffer(data);
    fs.writeFileSync(saveDialog.filePath, buffer);
    return { success: true, filePath: saveDialog.filePath };
  });

  ipcMain.handle('export:toCsv', async (_, { data, fileName = 'MediStock_Export.csv' }) => {
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Save CSV File',
      defaultPath: fileName,
      filters: [{ name: 'CSV File (*.csv)', extensions: ['csv'] }],
    });
    if (saveDialog.canceled || !saveDialog.filePath) return { success: false };

    const csvStr = exportService.exportToCsvString(data);
    fs.writeFileSync(saveDialog.filePath, csvStr, 'utf8');
    return { success: true, filePath: saveDialog.filePath };
  });

  // Settings
  ipcMain.handle('settings:getCompany', async () => partyService.getCompanyDetails());
  ipcMain.handle('settings:updateCompany', async (_, data) => partyService.updateCompanyDetails(data));
  ipcMain.handle('settings:getAppSettings', async () => partyService.getAppSettings());
  ipcMain.handle('settings:updateAppSetting', async (_, { key, val }) => partyService.updateAppSetting(key, val));

  // Licensing
  ipcMain.handle('license:getStatus', async () => licenseService.getLicenseStatus());
  ipcMain.handle('license:getHardwareId', async () => licenseService.getMachineHardwareId());
  ipcMain.handle('license:activate', async (_, { key, serverUrl }) => licenseService.activateLicenseOnline(key, serverUrl));
  ipcMain.handle('license:sync', async () => licenseService.syncLicenseHeartbeat());
  ipcMain.handle('license:deactivate', async () => licenseService.deactivateLocalLicense());

  // System & Window Actions
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());
  ipcMain.on('window:print', () => {
    if (!mainWindow) return;
    mainWindow.webContents.print({ silent: false, printBackground: true });
  });
}

// App Lifecycle
app.whenReady().then(() => {
  // Initialize Database
  const db = getDatabase();
  seedDatabase(db);

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
