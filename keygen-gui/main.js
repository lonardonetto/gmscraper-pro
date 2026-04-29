const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const CryptoJS = require('crypto-js');

// ── Encryption key (change before distributing to clients) ──────────────────
const ENC_KEY = 'GMS-PRO-DB-SECRET-2024-xK9pZq7r';

// ── Hidden AppData folder — stored in %APPDATA%\.gmsdata (hidden dot-folder) ─
// On Windows, prefix with a dot makes it hidden from casual browsing
function getHiddenDataDir() {
  const base = app.getPath('appData'); // e.g. C:\Users\User\AppData\Roaming
  const dir  = path.join(base, '.gmsdata');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Mark folder as hidden on Windows using attrib
    try { require('child_process').execSync(`attrib +h "${dir}"`, { windowsHide: true }); } catch {}
  }
  return dir;
}

// DB stored as encrypted binary — extension .dat looks innocuous
let DB_PATH = null;

// ── Encrypt/Decrypt helpers ─────────────────────────────────────────────────
function encryptBuffer(buf) {
  const wordArray = CryptoJS.lib.WordArray.create(buf);
  const encrypted = CryptoJS.AES.encrypt(wordArray, ENC_KEY).toString();
  return Buffer.from(encrypted, 'utf8');
}

function decryptBuffer(encBuf) {
  try {
    const encStr   = encBuf.toString('utf8');
    const decrypted = CryptoJS.AES.decrypt(encStr, ENC_KEY);
    const bytes = [];
    for (let i = 0; i < decrypted.sigBytes; i++) {
      bytes.push((decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
    }
    return Buffer.from(bytes);
  } catch { return null; }
}

let win = null;
let db  = null;
let SQL = null;

async function initDb() {
  const dataDir = getHiddenDataDir();
  DB_PATH = path.join(dataDir, 'store.dat');

  const initSqlJs = require('sql.js');
  const wasmPath  = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  SQL = await initSqlJs({ locateFile: () => wasmPath });

  if (fs.existsSync(DB_PATH)) {
    const encBuf = fs.readFileSync(DB_PATH);
    const rawBuf = decryptBuffer(encBuf);
    if (rawBuf && rawBuf.length > 0) {
      db = new SQL.Database(rawBuf);
    } else {
      // Corrupted or plain old unencrypted db — start fresh
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL DEFAULT 'pro',
      max_activations INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_validated DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      UNIQUE(license_key, machine_id)
    );
  `);
  saveDb();
}

function saveDb() {
  if (!db || !DB_PATH) return;
  try {
    const raw = Buffer.from(db.export());
    const enc = encryptBuffer(raw);
    fs.writeFileSync(DB_PATH, enc);
  } catch (e) {
    require('electron-log')?.error('saveDb error:', e);
  }
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  await initDb();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Window controls ─────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => win?.minimize());
ipcMain.on('win-maximize', () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',    () => win?.close());

// ── IPC: list all licenses ───────────────────────────────────────────────────
ipcMain.handle('list-licenses', () => {
  if (!db) return [];
  return dbAll(`
    SELECT l.*, COUNT(a.id) AS activation_count
    FROM licenses l
    LEFT JOIN activations a ON a.license_key = l.key AND a.is_active = 1
    GROUP BY l.id ORDER BY l.created_at DESC
  `);
});

// ── IPC: generate keys ───────────────────────────────────────────────────────
ipcMain.handle('generate-keys', (e, { count, plan, maxActivations, expiresAt, notes }) => {
  if (!db) return { ok: false, error: 'DB not ready' };
  const keys = [];
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 10) {
      const key = generateKey();
      try {
        db.run(
          'INSERT INTO licenses (key, plan, max_activations, expires_at, notes) VALUES (?, ?, ?, ?, ?)',
          [key, plan, maxActivations, expiresAt || null, notes || '']
        );
        keys.push(key);
        break;
      } catch (err) {
        if (err.message?.includes('UNIQUE')) { attempts++; } else throw err;
      }
    }
  }
  saveDb();
  return { ok: true, keys };
});

// ── IPC: delete license ──────────────────────────────────────────────────────
ipcMain.handle('delete-license', (e, key) => {
  if (!db) return { ok: false };
  db.run('DELETE FROM activations WHERE license_key = ?', [key]);
  db.run('DELETE FROM licenses WHERE key = ?', [key]);
  saveDb();
  return { ok: true };
});

// ── IPC: export CSV (to user-chosen location, no path leaking internals) ─────
ipcMain.handle('export-keys-csv', async (e, keys) => {
  const result = await dialog.showSaveDialog(win, {
    title: 'Export License Keys',
    defaultPath: `licenses-${new Date().toISOString().slice(0,10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled) return { ok: false };
  const header = 'Key,Plan,MaxActivations,Expires,Notes,Created\n';
  const rows = keys.map(k =>
    `${k.key},${k.plan},${k.max_activations},${k.expires_at || ''},${(k.notes||'').replace(/,/g,';')},${k.created_at}`
  ).join('\n');
  fs.writeFileSync(result.filePath, header + rows, 'utf8');
  return { ok: true, path: result.filePath };
});

// ── IPC: get activations for a key ───────────────────────────────────────────
ipcMain.handle('get-activations', (e, key) => {
  if (!db) return [];
  return dbAll(
    'SELECT * FROM activations WHERE license_key = ? ORDER BY activated_at DESC',
    [key]
  );
});

// ── IPC: reset (force-deactivate) all devices for a key ──────────────────────
ipcMain.handle('reset-activation', (e, key) => {
  if (!db) return { ok: false };
  db.run('UPDATE activations SET is_active = 0 WHERE license_key = ?', [key]);
  saveDb();
  return { ok: true };
});

// ── IPC: export encrypted DB backup ──────────────────────────────────────────
ipcMain.handle('backup-db', async () => {
  const result = await dialog.showSaveDialog(win, {
    title: 'Backup License Database',
    defaultPath: `gms-backup-${new Date().toISOString().slice(0,10)}.dat`,
    filters: [{ name: 'Backup', extensions: ['dat'] }]
  });
  if (result.canceled) return { ok: false };
  fs.copyFileSync(DB_PATH, result.filePath);
  return { ok: true, path: result.filePath };
});

// ── IPC: restore DB from backup ───────────────────────────────────────────────
ipcMain.handle('restore-db', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Restore License Database',
    filters: [{ name: 'Backup', extensions: ['dat'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const encBuf = fs.readFileSync(result.filePaths[0]);
  const rawBuf = decryptBuffer(encBuf);
  if (!rawBuf) return { ok: false, error: 'Invalid or corrupted backup file' };
  db = new SQL.Database(rawBuf);
  saveDb();
  return { ok: true };
});
