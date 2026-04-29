const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const log = require('electron-log');

let db = null;
let SQL = null;
let dbPath = null;

function persistDb() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    log.error('DB persist error:', err);
  }
}

function runQuery(sql, params = []) {
  if (!db) { log.warn('DB not ready, skipping query:', sql); return; }
  db.run(sql, params);
  persistDb();
}

function allRows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getRow(sql, params = []) {
  const rows = allRows(sql, params);
  return rows[0] || null;
}

function initialize() {
  const initSqlJs = require('sql.js');
  dbPath = path.join(app.getPath('userData'), 'scraper-data.db');

  return initSqlJs().then((SqlJs) => {
    SQL = SqlJs;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        result_count INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        name TEXT,
        address TEXT,
        phone TEXT,
        website TEXT,
        rating TEXT,
        review_count TEXT,
        category TEXT,
        hours TEXT,
        scraped_at TEXT
      );
    `);
    persistDb();
    log.info('Database initialized at:', dbPath);
  }).catch(err => {
    log.error('sql.js init error:', err);
    throw err;
  });
}

function saveResults(sessionName, results) {
  if (!db || !results.length) return;

  db.run('INSERT INTO sessions (name, result_count) VALUES (?, ?)', [sessionName, results.length]);
  const sessionRow = getRow('SELECT last_insert_rowid() as id');
  const sessionId = sessionRow ? sessionRow.id : null;
  if (!sessionId) return;

  for (const row of results) {
    db.run(
      `INSERT INTO results (session_id, name, address, phone, website, rating, review_count, category, hours, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        row.name || '',
        row.address || '',
        row.phone || '',
        row.website || '',
        row.rating || '',
        row.reviewCount || '',
        row.category || '',
        row.hours || '',
        row.scrapedAt || new Date().toISOString()
      ]
    );
  }
  persistDb();
  log.info(`Saved ${results.length} results to session "${sessionName}"`);
  return sessionId;
}

function getSessions() {
  if (!db) return [];
  return allRows('SELECT * FROM sessions ORDER BY created_at DESC');
}

function getResults(sessionId) {
  if (!db) return [];
  return allRows('SELECT * FROM results WHERE session_id = ?', [sessionId]);
}

function deleteSession(sessionId) {
  if (!db) return { success: false };
  runQuery('DELETE FROM results WHERE session_id = ?', [sessionId]);
  runQuery('DELETE FROM sessions WHERE id = ?', [sessionId]);
  return { success: true };
}

function getStats() {
  if (!db) return { totalSessions: 0, totalResults: 0, recentSessions: [] };
  const sessions = getRow('SELECT COUNT(*) as count FROM sessions');
  const results = getRow('SELECT COUNT(*) as count FROM results');
  const recent = allRows('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5');
  return {
    totalSessions: sessions ? sessions.count : 0,
    totalResults: results ? results.count : 0,
    recentSessions: recent
  };
}

module.exports = { initialize, saveResults, getSessions, getResults, deleteSession, getStats };
