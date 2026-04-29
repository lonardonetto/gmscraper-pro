/**
 * GMScraper Pro — License Key Generator
 * Usage:
 *   node keygen.js                          → generate 1 pro key (1 activation, no expiry)
 *   node keygen.js --count 5                → generate 5 keys
 *   node keygen.js --plan pro --max 3       → 3 activations per key
 *   node keygen.js --expires 2025-12-31     → key expires on date
 *   node keygen.js --notes "Client: Acme"   → attach a note
 *   node keygen.js --list                   → list all keys in DB
 */

require('dotenv').config();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'licenses.db');

// ── CLI arg parser ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag, def = null) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const has = (flag) => args.includes(flag);

const COUNT     = parseInt(get('--count', '1'), 10);
const PLAN      = get('--plan', 'pro');
const MAX_ACT   = parseInt(get('--max', '1'), 10);
const EXPIRES   = get('--expires', null);
const NOTES     = get('--notes', '');
const LIST_ONLY = has('--list');

// ── Key generator ──────────────────────────────────────────────────────────
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n) => Array.from({ length: n },
    () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
initSqlJs().then((SQL) => {
  let db;
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  // Ensure tables exist
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

  const save = () => fs.writeFileSync(DB_PATH, Buffer.from(db.export()));

  // ── List mode ─────────────────────────────────────────────────────────────
  if (LIST_ONLY) {
    const stmt = db.prepare(`
      SELECT l.key, l.plan, l.max_activations, l.expires_at, l.created_at, l.notes,
             COUNT(a.id) as activations
      FROM licenses l
      LEFT JOIN activations a ON a.license_key = l.key AND a.is_active = 1
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    if (rows.length === 0) {
      console.log('\n  No licenses in database.\n');
      return;
    }

    console.log('\n' + '─'.repeat(90));
    console.log(
      ' KEY                  PLAN  MAX  ACTV  EXPIRES      CREATED              NOTES'
    );
    console.log('─'.repeat(90));
    for (const r of rows) {
      const exp = r.expires_at ? r.expires_at.substring(0, 10) : 'Never      ';
      const created = (r.created_at || '').substring(0, 16);
      const note = (r.notes || '').substring(0, 20);
      console.log(
        ` ${r.key}  ${r.plan.padEnd(5)} ${String(r.max_activations).padEnd(4)} ` +
        `${String(r.activations).padEnd(5)} ${exp}  ${created}  ${note}`
      );
    }
    console.log('─'.repeat(90));
    console.log(` Total: ${rows.length} license(s)\n`);
    return;
  }

  // ── Generate mode ─────────────────────────────────────────────────────────
  const generated = [];

  for (let i = 0; i < COUNT; i++) {
    let key;
    let attempts = 0;

    // Retry on collision (extremely unlikely but safe)
    while (attempts < 10) {
      key = generateKey();
      try {
        db.run(
          'INSERT INTO licenses (key, plan, max_activations, expires_at, notes) VALUES (?, ?, ?, ?, ?)',
          [key, PLAN, MAX_ACT, EXPIRES, NOTES]
        );
        generated.push(key);
        break;
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          attempts++;
        } else {
          throw e;
        }
      }
    }
  }

  save();

  console.log('\n' + '═'.repeat(60));
  console.log('  GMScraper Pro — Generated License Keys');
  console.log('═'.repeat(60));
  console.log(`  Plan         : ${PLAN}`);
  console.log(`  Max devices  : ${MAX_ACT}`);
  console.log(`  Expires      : ${EXPIRES || 'Never'}`);
  console.log(`  Notes        : ${NOTES || '—'}`);
  console.log('─'.repeat(60));
  generated.forEach((k, idx) => {
    console.log(`  [${String(idx + 1).padStart(3)}]  ${k}`);
  });
  console.log('═'.repeat(60) + '\n');

  if (generated.length !== COUNT) {
    console.warn(`  ⚠ Warning: Only ${generated.length}/${COUNT} keys generated (collision retries exhausted)\n`);
  }

}).catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
