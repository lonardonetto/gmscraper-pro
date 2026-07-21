const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');

const licenseManager = require('./license-manager');
const scraperEngine = require('./scraper-engine');
const exportManager = require('./export-manager');
const proxyManager = require('./proxy-manager');
const dbManager = require('./db-manager');

log.initialize({ preload: true });
log.transports.file.level = 'info';

const store = new Store({
  encryptionKey: 'gms-pro-2024-secure-key-x7z9',
  name: 'app-config'
});

let mainWindow = null;
let licenseWindow = null;
let isScraperRunning = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupAutoUpdater();
}

function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    frame: false,
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false
  });

  licenseWindow.loadFile(path.join(__dirname, '../renderer/license.html'));

  licenseWindow.once('ready-to-show', () => {
    licenseWindow.show();
  });

  licenseWindow.on('closed', () => {
    licenseWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', progress);
    }
  });

  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdates().catch(err => log.error('Auto-update check failed:', err));
  }
}

app.whenReady().then(async () => {
  log.info('App starting...');
  
  await dbManager.initialize();

  // Bypassed license check
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// ─── IPC: Window controls ────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// ─── IPC: License ────────────────────────────────────────────────────────────
ipcMain.handle('validate-license', async (event, licenseKey) => {
  try {
    const result = await licenseManager.validateLicense(licenseKey);
    if (result.valid) {
      licenseWindow?.close();
      createMainWindow();
    }
    return result;
  } catch (err) {
    log.error('License validation error:', err);
    return { valid: false, message: err.message };
  }
});

ipcMain.handle('get-license-info', async () => {
  return licenseManager.getLicenseInfo();
});

ipcMain.handle('deactivate-license', async () => {
  return licenseManager.deactivateLicense();
});

// ─── IPC: Scraper ────────────────────────────────────────────────────────────
ipcMain.handle('start-scrape', async (event, config) => {
  if (isScraperRunning) return { success: false, message: 'Scraper already running' };

  isScraperRunning = true;
  mainWindow?.webContents.send('scraper-status', { running: true });

  try {
    const results = await scraperEngine.run(config, (progress) => {
      mainWindow?.webContents.send('scraper-progress', progress);
    }, (logEntry) => {
      mainWindow?.webContents.send('scraper-log', logEntry);
    }, () => isScraperRunning);

    dbManager.saveResults(config.sessionName || `Session_${Date.now()}`, results);
    mainWindow?.webContents.send('scraper-complete', { count: results.length });
    return { success: true, count: results.length };
  } catch (err) {
    log.error('Scrape error:', err);
    mainWindow?.webContents.send('scraper-error', err.message);
    return { success: false, message: err.message };
  } finally {
    isScraperRunning = false;
    mainWindow?.webContents.send('scraper-status', { running: false });
  }
});

ipcMain.on('stop-scrape', () => {
  isScraperRunning = false;
  scraperEngine.stop();
  log.info('Scraper stop requested');
});

// ─── IPC: Results ────────────────────────────────────────────────────────────
ipcMain.handle('get-sessions', () => dbManager.getSessions());
ipcMain.handle('get-results', (event, sessionId) => dbManager.getResults(sessionId));
ipcMain.handle('delete-session', (event, sessionId) => dbManager.deleteSession(sessionId));
ipcMain.handle('get-stats', () => dbManager.getStats());

// ─── IPC: Export ────────────────────────────────────────────────────────────
ipcMain.handle('export-csv', async (event, { sessionId, filePath }) => {
  const results = dbManager.getResults(sessionId);
  return exportManager.exportCSV(results, filePath);
});

ipcMain.handle('export-excel', async (event, { sessionId, filePath }) => {
  const results = dbManager.getResults(sessionId);
  return exportManager.exportExcel(results, filePath);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.getFocusedWindow();
  return dialog.showSaveDialog(win, options);
});

ipcMain.handle('open-path', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ─── IPC: Settings ────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => store.get('settings', {}));
ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return { success: true };
});

// ─── IPC: Proxy ────────────────────────────────────────────────────────────
ipcMain.handle('test-proxy', async (event, proxy) => {
  return proxyManager.testProxy(proxy);
});

ipcMain.handle('get-proxy-list', () => store.get('proxies', []));
ipcMain.handle('save-proxy-list', (event, proxies) => {
  store.set('proxies', proxies);
  return { success: true };
});

// ─── IPC: Auto-update ────────────────────────────────────────────────────────
ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
ipcMain.handle('check-update', () => autoUpdater.checkForUpdates());

// ─── IPC: Machine ID ────────────────────────────────────────────────────────
ipcMain.handle('get-machine-id', async () => {
  const { machineIdSync } = require('node-machine-id');
  return machineIdSync({ original: true });
});
