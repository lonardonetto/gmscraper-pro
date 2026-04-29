require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-admin-secret';
const DB_PATH = path.join(__dirname, 'licenses.db');

// ─── sql.js helpers ──────────────────────────────────────────────────────────
let db = null;

function persistDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  persistDb();
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
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
  persistDb();
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { valid: false, message: 'Too many requests. Try again later.' }
});
app.use('/api/license', limiter);

// ─── Admin auth middleware ────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── POST /api/license/validate ──────────────────────────────────────────────
app.post('/api/license/validate', (req, res) => {
  const { licenseKey, machineId } = req.body;

  if (!licenseKey || !machineId) {
    return res.json({ valid: false, message: 'Missing license key or machine ID' });
  }

  const key = licenseKey.toUpperCase().trim();
  const license = dbGet('SELECT * FROM licenses WHERE key = ?', [key]);

  if (!license) {
    return res.json({ valid: false, message: 'Invalid license key' });
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return res.json({ valid: false, message: 'License has expired' });
  }

  // Check if THIS machine already has an active activation
  const ownActivation = dbGet(
    'SELECT * FROM activations WHERE license_key = ? AND machine_id = ? AND is_active = 1',
    [key, machineId]
  );

  if (ownActivation) {
    // Refresh last_validated timestamp
    dbRun('UPDATE activations SET last_validated = CURRENT_TIMESTAMP WHERE id = ?', [ownActivation.id]);
    return res.json({ valid: true, message: 'License valid', plan: license.plan, expiresAt: license.expires_at });
  }

  // Check if a DIFFERENT machine has already activated this key
  const otherActivation = dbGet(
    'SELECT machine_id FROM activations WHERE license_key = ? AND is_active = 1',
    [key]
  );

  if (otherActivation) {
    // Already locked to another device — block strictly
    return res.json({
      valid: false,
      message: 'This license key is already activated on another device. Contact support to transfer it.'
    });
  }

  // First activation — bind to this machine
  dbRun('INSERT INTO activations (license_key, machine_id) VALUES (?, ?)', [key, machineId]);

  return res.json({
    valid: true,
    message: 'License activated successfully',
    plan: license.plan,
    expiresAt: license.expires_at
  });
});

// ─── POST /api/license/deactivate ────────────────────────────────────────────
app.post('/api/license/deactivate', (req, res) => {
  const { licenseKey, machineId } = req.body;

  if (!licenseKey || !machineId) {
    return res.json({ success: false, message: 'Missing parameters' });
  }

  dbRun('UPDATE activations SET is_active = 0 WHERE license_key = ? AND machine_id = ?', [licenseKey.toUpperCase(), machineId]);

  return res.json({ success: true, message: 'Deactivated successfully' });
});

// ─── Admin: Create license ────────────────────────────────────────────────────
app.post('/api/admin/create-license', requireAdmin, (req, res) => {
  const { plan = 'pro', maxActivations = 1, expiresAt = null, notes = '' } = req.body;

  const key = generateLicenseKey();

  dbRun('INSERT INTO licenses (key, plan, max_activations, expires_at, notes) VALUES (?, ?, ?, ?, ?)', [key, plan, maxActivations, expiresAt, notes]);

  return res.json({ success: true, key, plan, maxActivations, expiresAt });
});

// ─── Admin: List licenses ─────────────────────────────────────────────────────
app.get('/api/admin/licenses', requireAdmin, (req, res) => {
  const licenses = dbAll(`
    SELECT l.*, COUNT(a.id) as activation_count
    FROM licenses l
    LEFT JOIN activations a ON a.license_key = l.key AND a.is_active = 1
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `);
  return res.json(licenses);
});

// ─── Admin: Revoke license ────────────────────────────────────────────────────
app.delete('/api/admin/licenses/:key', requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  dbRun('DELETE FROM activations WHERE license_key = ?', [key]);
  dbRun('DELETE FROM licenses WHERE key = ?', [key]);
  return res.json({ success: true });
});

// ─── Admin: Get activations for a key ────────────────────────────────────────
app.get('/api/admin/licenses/:key/activations', requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const activations = dbAll('SELECT * FROM activations WHERE license_key = ?', [key]);
  return res.json(activations);
});

// ─── Admin: Force-deactivate all devices for a key (reset / transfer) ────────
app.post('/api/admin/licenses/:key/reset', requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const license = dbGet('SELECT * FROM licenses WHERE key = ?', [key]);
  if (!license) return res.status(404).json({ error: 'License not found' });
  dbRun('UPDATE activations SET is_active = 0 WHERE license_key = ?', [key]);
  return res.json({ success: true, message: `All activations reset for ${key}` });
});

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Key generator ────────────────────────────────────────────────────────────
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment(4)}-${segment(4)}-${segment(4)}-${segment(4)}`;
}

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🔑 GMScraper License Server running on port ${PORT}`);
    console.log(`   Admin Secret: ${ADMIN_SECRET}`);
    console.log(`   Health check: http://localhost:${PORT}/health\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
