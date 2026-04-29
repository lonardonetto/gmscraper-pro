/**
 * Quick seed script — creates a test license key in the DB.
 * Usage: node seed-license.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'licenses.db');

initSqlJs().then((SQL) => {
  let db;
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
      max_activations INTEGER NOT NULL DEFAULT 3,
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

  const key = 'TEST-1234-ABCD-5678';

  try {
    db.run(
      'INSERT INTO licenses (key, plan, max_activations, notes) VALUES (?, ?, ?, ?)',
      [key, 'pro', 3, 'Test license']
    );
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    console.log(`\n✅ Test license created: ${key}\n`);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      console.log(`\n⚠️  License already exists: ${key}\n`);
    } else {
      console.error(e);
    }
  }
}).catch(console.error);
