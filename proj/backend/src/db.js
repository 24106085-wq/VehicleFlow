// SQLite database (better-sqlite3). Everything is synchronous: no await is needed for queries.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Local database file. Relative paths are resolved from the folder you start the backend in (backend/).
export const DB_PATH = path.resolve(process.env.DB_PATH || './data/vehicleflow.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); // creates data/ automatically if it is missing

export const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');   // enforce FOREIGN KEY rules (SQLite has them OFF by default)
db.pragma('journal_mode = WAL');  // safer + faster for a web app
db.pragma('busy_timeout = 5000'); // wait up to 5 s instead of failing if the file is briefly locked

// Run one parameterized query.  SELECT -> array of rows.  INSERT/UPDATE/DELETE -> { insertId, affectedRows }.
// Always pass user input through the params array (the ? marks), never by joining strings into the SQL.
export const q = (sql, params = []) => {
  const p = params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? +v : v));
  const stmt = db.prepare(sql);
  if (stmt.reader) return stmt.all(...p);
  const r = stmt.run(...p);
  return { insertId: Number(r.lastInsertRowid), affectedRows: r.changes };
};

// Run several writes as ONE transaction: everything is saved, or (if anything throws) nothing is.
//   const id = tx(() => { q('INSERT ...'); q('INSERT ...'); return 5; });
export const tx = (fn) => db.transaction(fn).immediate();

// Error helpers (replace the old MySQL ER_DUP_ENTRY / ER_NO_REFERENCED_ROW_2 checks).
export const isUniqueError = (e) => String(e?.code).startsWith('SQLITE_CONSTRAINT') && /UNIQUE|PRIMARYKEY/.test(e.code + e.message);
export const isForeignKeyError = (e) => e?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY/i.test(e?.message || '');

// SQLite has no JOIN-friendly "IN (?)" with an array, so this builds "?,?,?" for you.
export const marks = (arr) => arr.map(() => '?').join(',');

export const BOOKING_SQL = `SELECT b.*, v.make, v.model, v.plate, sc.name category, cu.name customer, mu.name mechanic
FROM service_bookings b
JOIN vehicles v ON v.id=b.vehicle_id
JOIN service_categories sc ON sc.id=b.category_id
JOIN customers c ON c.id=b.customer_id
JOIN users cu ON cu.id=c.user_id
LEFT JOIN mechanics m ON m.id=b.mechanic_id
LEFT JOIN users mu ON mu.id=m.user_id`;
