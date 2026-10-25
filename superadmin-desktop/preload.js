// superadmin-desktop/preload.js
// Secure Context Bridge for SuperAdmin Desktop Software

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('superadminApi', {
  getBackendUrl: () => ipcRenderer.invoke('superadmin:getBackendUrl'),
  checkBackendStatus: () => ipcRenderer.invoke('superadmin:checkBackendStatus'),
  openExternal: (url) => ipcRenderer.invoke('superadmin:openExternal', url),
  printToPDF: () => ipcRenderer.invoke('superadmin:printToPDF'),
  version: '1.0.0-SuperAdmin',
  platform: process.platform,
});
