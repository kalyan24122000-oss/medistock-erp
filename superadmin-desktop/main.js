// superadmin-desktop/main.js
// Dedicated Electron Main Process for MediStock SuperAdmin GUI Software

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
const BACKEND_PORT = process.env.PORT || 5000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Attempt to ensure the backend server is running
async function ensureBackendServer() {
  return new Promise((resolve) => {
    const req = http.get(`${BACKEND_URL}/api/admin/overview`, (res) => {
      console.log('[SuperAdmin Desktop] Backend server already running on port', BACKEND_PORT);
      resolve(true);
    });

    req.on('error', () => {
      console.log('[SuperAdmin Desktop] Starting backend licensing server on port', BACKEND_PORT);
      try {
        const { startServer } = require('../backend/server');
        startServer(BACKEND_PORT)
          .then(() => resolve(true))
          .catch((err) => {
            console.warn('[SuperAdmin Desktop] Backend start note:', err.message);
            resolve(false);
          });
      } catch (err) {
        console.error('[SuperAdmin Desktop] Failed to load backend/server.js:', err);
        resolve(false);
      }
    });

    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1100,
    minHeight: 700,
    title: 'MediStock Technologies — SuperAdmin & Licensing Master Console',
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
