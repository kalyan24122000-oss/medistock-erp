// superadmin-desktop/main.js
// Dedicated Electron Main Process for MediStock SuperAdmin GUI Software

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
const BACKEND_PORT = process.env.PORT || 5000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Ensure the licensing backend server is running
async function ensureBackendServer() {
  try {
    const { server, startServer } = require('../backend/server');
    return new Promise((resolve) => {
      // Listen directly
      server.listen(BACKEND_PORT, () => {
        console.log('[SuperAdmin Desktop] Started in-process licensing server on port', BACKEND_PORT);
        resolve(true);
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log('[SuperAdmin Desktop] External backend server already active on port', BACKEND_PORT);
          resolve(true);
        } else {
          console.warn('[SuperAdmin Desktop] Backend server note:', err.message);
          resolve(false);
        }
      });
    });
  } catch (err) {
    console.error('[SuperAdmin Desktop] Failed to initialize backend server:', err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1100,
    minHeight: 700,
    title: 'PharmaDesk — SuperAdmin & Licensing Master Console • ByteSphere',
    icon: path.join(__dirname, '../build/icon.ico'),
    show: false,
    frame: true,
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers
ipcMain.handle('superadmin:getBackendUrl', () => BACKEND_URL);

ipcMain.handle('superadmin:checkBackendStatus', async () => {
  return new Promise((resolve) => {
    const req = http.get(`${BACKEND_URL}/api/admin/overview`, (res) => {
      resolve({ online: true, statusCode: res.statusCode, url: BACKEND_URL });
    });
    req.on('error', (err) => {
      resolve({ online: false, error: err.message, url: BACKEND_URL });
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ online: false, error: 'Connection timeout', url: BACKEND_URL });
    });
  });
});

ipcMain.handle('superadmin:openExternal', (event, targetUrl) => {
  shell.openExternal(targetUrl);
  return true;
});

ipcMain.handle('superadmin:printToPDF', async () => {
  if (!mainWindow) return null;
  try {
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
    });
    return data;
  } catch (err) {
    console.error('PDF generation error:', err);
    throw err;
  }
});

app.whenReady().then(async () => {
  await ensureBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
