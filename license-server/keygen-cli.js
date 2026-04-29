#!/usr/bin/env node
/**
 * GMScraper Pro — License Key Generator (Standalone EXE)
 * -------------------------------------------------------
 * Usage:
 *   keygen.exe                              List all keys
 *   keygen.exe generate                     Generate 1 key (defaults)
 *   keygen.exe generate --count 5           Generate 5 keys
 *   keygen.exe generate --max 3             3 activations per key
 *   keygen.exe generate --expires 2026-12-31
 *   keygen.exe generate --notes "Client: ACME"
 *   keygen.exe delete <KEY>                 Delete a key from DB
 *   keygen.exe help                         Show help
 *
 * DB file: licenses.db  (same folder as the .exe)
 */

const path = require('path');
const fs   = require('fs');

// When compiled with pkg, __dirname is the snapshot; process.execPath dir is the real exe dir
const IS_PKG  = typeof process.pkg !== 'undefined';
const EXE_DIR = IS_PKG ? path.dirname(process.execPath) : __dirname;

// If running from a dist/ subfolder, use the parent's licenses.db (shared with server)
function resolveDbPath() {
  const local  = path.join(EXE_DIR, 'licenses.db');
  const parent = path.join(EXE_DIR, '..', 'licenses.db');
  const dirName = path.basename(EXE_DIR).toLowerCase();
  // Prefer parent db if we are in dist/ and parent has a licenses.db already
  if (dirName === 'dist' && fs.existsSync(parent)) return parent;
  // Or always use parent when in dist/ (creates it there on first run)
  if (dirName === 'dist') return parent;
  return local;
}

const DB_PATH = resolveDbPath();

// wasm-data.js is a pre-generated JS module containing the wasm as a Buffer
// pkg bundles .js files natively — no filesystem issues
function getSqlJsConfig() {
  const wasmBinary = require('./wasm-data');
  return { wasmBinary };
}

// ── Arg parsing ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd  = args[0] || 'list';

const getArg = (flag, def = null) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

// ── Key generator ──────────────────────────────────────────────────────────
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n) => Array.from({ length: n },
    () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function line(c = '─', n = 72) { return c.repeat(n); }
function pad(s, n) { return String(s ?? '').padEnd(n); }

// ── Main (async) ───────────────────────────────────────────────────────────
async function main() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs(getSqlJsConfig());

  let db;
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  // Ensure schema
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

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (cmd === 'list' || cmd === '--list') {
    const stmt = db.prepare(`
      SELECT l.key, l.plan, l.max_activations, l.expires_at, l.created_at, l.notes,
             COUNT(a.id) AS activations
      FROM licenses l
      LEFT JOIN activations a ON a.license_key = l.key AND a.is_active = 1
      GROUP BY l.id ORDER BY l.created_at DESC
    `);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    console.log('\n' + line('═'));
    console.log('  GMScraper Pro — License Database');
    console.log(line('═'));
    if (rows.length === 0) {
      console.log('  No licenses found.\n');
      return;
    }
    console.log(`  ${pad('KEY',20)} ${pad('PLAN',6)} ${pad('MAX',4)} ${pad('ACTV',5)} ${pad('EXPIRES',12)} ${pad('CREATED',17)} NOTES`);
    console.log(line());
    for (const r of rows) {
      const exp     = (r.expires_at || 'Never').substring(0, 10);
      const created = (r.created_at || '').substring(0, 16);
      const note    = (r.notes || '').substring(0, 22);
      console.log(`  ${pad(r.key,20)} ${pad(r.plan,6)} ${pad(r.max_activations,4)} ${pad(r.activations,5)} ${pad(exp,12)} ${pad(created,17)} ${note}`);
    }
    console.log(line());
    console.log(`  Total: ${rows.length} license(s)\n`);
    return;
  }

  // ── GENERATE ──────────────────────────────────────────────────────────────
  if (cmd === 'generate' || cmd === 'gen' || cmd === '--generate') {
    const count   = parseInt(getArg('--count',   '1'),  10);
    const plan    = getArg('--plan',    'pro');
    const maxAct  = parseInt(getArg('--max',     '1'),  10);
    const expires = getArg('--expires', null);
    const notes   = getArg('--notes',   '');

    const generated = [];

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      while (attempts < 10) {
        const key = generateKey();
        try {
          db.run(
            'INSERT INTO licenses (key, plan, max_activations, expires_at, notes) VALUES (?, ?, ?, ?, ?)',
            [key, plan, maxAct, expires, notes]
          );
          generated.push(key);
          break;
        } catch (e) {
          if (e.message && e.message.includes('UNIQUE')) { attempts++; }
          else throw e;
        }
      }
    }

    save();

    console.log('\n' + line('═'));
    console.log('  GMScraper Pro — Generated License Keys');
    console.log(line('═'));
    console.log(`  Plan        : ${plan}`);
    console.log(`  Max devices : ${maxAct}`);
    console.log(`  Expires     : ${expires || 'Never'}`);
    console.log(`  Notes       : ${notes || '—'}`);
    console.log(line());
    generated.forEach((k, idx) => console.log(`  [${String(idx + 1).padStart(3)}]  ${k}`));
    console.log(line('═') + '\n');

    console.log(`  ✅ Saved to: ${DB_PATH}\n`);
    return;
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (cmd === 'delete' || cmd === 'revoke') {
    const key = args[1];
    if (!key) { console.error('\n  ✖ Provide a key to delete: keygen.exe delete XXXX-XXXX-XXXX-XXXX\n'); process.exit(1); }
    db.run('DELETE FROM activations WHERE license_key = ?', [key.toUpperCase()]);
    db.run('DELETE FROM licenses WHERE key = ?', [key.toUpperCase()]);
    save();
    console.log(`\n  ✅ Deleted key: ${key.toUpperCase()}\n`);
    return;
  }

  // ── HELP ──────────────────────────────────────────────────────────────────
  console.log(`
  GMScraper Pro — Keygen
  ──────────────────────────────────────────────
  keygen.exe                          List all keys
  keygen.exe generate                 Generate 1 pro key
  keygen.exe generate --count 5       Generate 5 keys
  keygen.exe generate --max 3         3 activations per key
  keygen.exe generate --expires DATE  Expiry date (YYYY-MM-DD)
  keygen.exe generate --notes "TEXT"  Attach a note
  keygen.exe delete  XXXX-XXXX        Delete/revoke a key
  keygen.exe help                     Show this help
  `);
}

main().catch(err => { console.error('\n  Fatal error:', err.message, '\n'); process.exit(1); });
