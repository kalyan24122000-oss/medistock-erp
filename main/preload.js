// main/preload.js
// Secure Context Bridge Preload Script exposing strictly typed domain APIs

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Authentication & Users
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    changePassword: (oldPassword, newPassword) => ipcRenderer.invoke('auth:changePassword', { oldPassword, newPassword }),
    listUsers: () => ipcRenderer.invoke('auth:listUsers'),
    createUser: (userData) => ipcRenderer.invoke('auth:createUser', userData),
    listRoles: () => ipcRenderer.invoke('auth:listRoles'),
  },

  // Medicines Catalog
  medicines: {
    search: (query, options) => ipcRenderer.invoke('medicines:search', { query, options }),
    getById: (productId) => ipcRenderer.invoke('medicines:getById', productId),
    save: (productData) => ipcRenderer.invoke('medicines:save', productData),
    getMasters: () => ipcRenderer.invoke('medicines:getMasters'),
  },

  // Batch Inventory & FEFO
  inventory: {
    getBatches: (productId, includeExpired) => ipcRenderer.invoke('inventory:getBatches', { productId, includeExpired }),
    listBatches: (filter) => ipcRenderer.invoke('inventory:listBatches', filter),
    adjustStock: (params) => ipcRenderer.invoke('inventory:adjustStock', params),
    getMovementLedger: (filter) => ipcRenderer.invoke('inventory:getMovementLedger', filter),
  },

  // Sales & Retail POS
  sales: {
    calculateLine: (item) => ipcRenderer.invoke('sales:calculateLine', item),
    calculateTotals: (items, discPct, discAmt) => ipcRenderer.invoke('sales:calculateTotals', { items, discPct, discAmt }),
    createInvoice: (invoiceData) => ipcRenderer.invoke('sales:createInvoice', invoiceData),
    getInvoice: (invoiceId) => ipcRenderer.invoke('sales:getInvoice', invoiceId),
    listInvoices: (filter) => ipcRenderer.invoke('sales:listInvoices', filter),
  },

  // Purchase Management
  purchase: {
    createInvoice: (purchaseData) => ipcRenderer.invoke('purchase:createInvoice', purchaseData),
    listInvoices: (filter) => ipcRenderer.invoke('purchase:listInvoices', filter),
  },

  // Sales & Purchase Returns
  returns: {
    processSalesReturn: (data) => ipcRenderer.invoke('returns:processSalesReturn', data),
    processPurchaseReturn: (data) => ipcRenderer.invoke('returns:processPurchaseReturn', data),
  },

  // Customers & Suppliers
  parties: {
    listCustomers: (search) => ipcRenderer.invoke('parties:listCustomers', search),
    saveCustomer: (data) => ipcRenderer.invoke('parties:saveCustomer', data),
    listSuppliers: (search) => ipcRenderer.invoke('parties:listSuppliers', search),
    saveSupplier: (data) => ipcRenderer.invoke('parties:saveSupplier', data),
  },

  // Double-Entry Accounting
  accounts: {
    getChart: () => ipcRenderer.invoke('accounts:getChart'),
    createVoucher: (voucherData) => ipcRenderer.invoke('accounts:createVoucher', voucherData),
    getLedger: (accountId, fromDate, toDate) => ipcRenderer.invoke('accounts:getLedger', { accountId, fromDate, toDate }),
    getTrialBalance: (asOfDate) => ipcRenderer.invoke('accounts:getTrialBalance', asOfDate),
    getProfitAndLoss: (fromDate, toDate) => ipcRenderer.invoke('accounts:getProfitAndLoss', { fromDate, toDate }),
    getBalanceSheet: (asOfDate) => ipcRenderer.invoke('accounts:getBalanceSheet', asOfDate),
  },

  // GST & Tax
  gst: {
    getGstr1: (fromDate, toDate) => ipcRenderer.invoke('gst:getGstr1', { fromDate, toDate }),
    getGstr3b: (fromDate, toDate) => ipcRenderer.invoke('gst:getGstr3b', { fromDate, toDate }),
    getHsnSummary: (fromDate, toDate) => ipcRenderer.invoke('gst:getHsnSummary', { fromDate, toDate }),
  },

  // Pharmacy Compliance
  compliance: {
    getRegister: (type, fromDate, toDate) => ipcRenderer.invoke('compliance:getRegister', { type, fromDate, toDate }),
    traceBatch: (batchNumber, productId) => ipcRenderer.invoke('compliance:traceBatch', { batchNumber, productId }),
  },

  // Reports & Analytics
  reports: {
    getDashboard: () => ipcRenderer.invoke('reports:getDashboard'),
    getExpiry: (filter) => ipcRenderer.invoke('reports:getExpiry', filter),
    getReorder: () => ipcRenderer.invoke('reports:getReorder'),
    getMovementAnalysis: (days) => ipcRenderer.invoke('reports:getMovementAnalysis', days),
  },

  // Backup & Recovery
  backup: {
    createBackup: (type) => ipcRenderer.invoke('backup:createBackup', type),
    getHistory: () => ipcRenderer.invoke('backup:getHistory'),
    previewBackup: (filePath) => ipcRenderer.invoke('backup:previewBackup', filePath),
    restoreDatabase: (filePath) => ipcRenderer.invoke('backup:restoreDatabase', filePath),
    selectBackupFile: () => ipcRenderer.invoke('backup:selectBackupFile'),
  },

  // Export to Excel / CSV
  export: {
    exportToExcel: (data, fileName) => ipcRenderer.invoke('export:toExcel', { data, fileName }),
    exportToCsv: (data, fileName) => ipcRenderer.invoke('export:toCsv', { data, fileName }),
  },

  // Settings & Company
  settings: {
    getCompany: () => ipcRenderer.invoke('settings:getCompany'),
    updateCompany: (data) => ipcRenderer.invoke('settings:updateCompany', data),
    getAppSettings: () => ipcRenderer.invoke('settings:getAppSettings'),
    updateAppSetting: (key, val) => ipcRenderer.invoke('settings:updateAppSetting', { key, val }),
  },

  // Licensing & Activation
  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),
    activate: (key, serverUrl) => ipcRenderer.invoke('license:activate', { key, serverUrl }),
    sync: () => ipcRenderer.invoke('license:sync'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },

  // Hardware / Window / Print
  system: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    print: () => ipcRenderer.send('window:print'),
  },
});
