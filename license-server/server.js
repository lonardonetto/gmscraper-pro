require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-admin-secret';
const DB_PATH = path.join(__dirname, 'licenses.db');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit admin endpoints to 20 requests per windowMs
  message: { error: 'Too many admin requests, please try again later' }
});

app.use('/api/', limiter);
app.use('/api/admin/', adminLimiter);

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
app.use(cors({ origin: '*' }));
app.use(express.json());

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

// Serve static files
app.use(express.static('public'));

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API: Get all licenses
app.get('/api/admin/licenses', requireAdmin, (req, res) => {
  try {
    const licenses = db.prepare(`
      SELECT 
        l.key,
        l.plan,
        l.max_activations,
        l.expires_at,
        l.created_at,
        l.notes,
        COUNT(a.license_key) as activations
      FROM licenses l
      LEFT JOIN activations a ON l.key = a.license_key
      GROUP BY l.key
      ORDER BY l.created_at DESC
    `).all();
    
    res.json({ licenses });
  } catch (error) {
    console.error('Error fetching licenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get license details with activations
app.get('/api/admin/licenses/:key', requireAdmin, (req, res) => {
  try {
    const { key } = req.params;
    
    const license = db.prepare('SELECT * FROM licenses WHERE key = ?').get(key);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    const activations = db.prepare(`
      SELECT * FROM activations 
      WHERE license_key = ? 
      ORDER BY activated_at DESC
    `).all(key);
    
    res.json({ license, activations });
  } catch (error) {
    console.error('Error fetching license details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get statistics
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const now = new Date().toISOString();
    
    const totalLicenses = db.prepare('SELECT COUNT(*) as count FROM licenses').get().count;
    const activeLicenses = db.prepare('SELECT COUNT(*) as count FROM licenses l JOIN activations a ON l.key = a.license_key WHERE a.is_active = 1').get().count;
    const totalActivations = db.prepare('SELECT COUNT(*) as count FROM activations WHERE is_active = 1').get().count;
    const expiredLicenses = db.prepare('SELECT COUNT(*) as count FROM licenses WHERE expires_at < ?').get(now).count;
    
    res.json({
      totalLicenses,
      activeLicenses,
      totalActivations,
      expiredLicenses
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Delete license
app.delete('/api/admin/licenses/:key', requireAdmin, (req, res) => {
  try {
    const { key } = req.params;
    
    // Delete activations first
    db.prepare('DELETE FROM activations WHERE license_key = ?').run(key);
    
    // Delete license
    const result = db.prepare('DELETE FROM licenses WHERE key = ?').run(key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    persistDb();
    res.json({ success: true, message: 'License deleted successfully' });
  } catch (error) {
    console.error('Error deleting license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Deactivate specific activation
app.post('/api/admin/deactivate', requireAdmin, (req, res) => {
  try {
    const { licenseKey, machineId } = req.body;
    
    if (!licenseKey || !machineId) {
      return res.status(400).json({ error: 'License key and machine ID are required' });
    }
    
    const result = db.prepare(`
      UPDATE activations 
      SET is_active = 0 
      WHERE license_key = ? AND machine_id = ?
    `).run(licenseKey, machineId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Activation not found' });
    }
    
    persistDb();
    res.json({ success: true, message: 'Activation deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating license:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Export data
app.get('/api/admin/export', requireAdmin, (req, res) => {
  try {
    const licenses = db.prepare(`
      SELECT 
        l.key,
        l.plan,
        l.max_activations,
        l.expires_at,
        l.created_at,
        l.notes,
        a.machine_id,
        a.activated_at,
        a.last_validated,
        a.is_active
      FROM licenses l
      LEFT JOIN activations a ON l.key = a.license_key
      ORDER BY l.created_at DESC, a.activated_at DESC
    `).all();
    
    // Convert to CSV
    const csv = [
      'License Key,Plan,Max Activations,Expires At,Created At,Notes,Machine ID,Activated At,Last Validated,Is Active',
      ...licenses.map(license => [
        license.key,
        license.plan,
        license.max_activations,
        license.expires_at || '',
        license.created_at,
        license.notes || '',
        license.machine_id || '',
        license.activated_at || '',
        license.last_validated || '',
        license.is_active || ''
      ].join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="licenses-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🔑 GMScraper License Server running on port ${PORT}`);
    console.log(`   Admin Secret: ${ADMIN_SECRET}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Dashboard available at: http://localhost:${PORT}/dashboard\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
