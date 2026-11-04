// Safe, repeatable database preparation used by the server on every start and by `npm run migrate`.
//  * creates data/vehicleflow.db automatically (see db.js)
//  * keeps a schema_migrations table; each migration runs ONCE and is itself safe to repeat
//  * only ever runs CREATE ... IF NOT EXISTS / ADD COLUMN when missing / INSERT OR IGNORE -> existing data is never touched
//  * never drops a table and never deletes records
//  * demo data is inserted ONLY when SEED_DEMO_DATA=true AND the database has no users/bookings/backlog/sprints yet
import 'dotenv/config';
import fs from 'fs';
import { db, q, tx, DB_PATH } from './db.js';
import { insertDemoData } from './demoData.js';

const hasColumn = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

// Add new migrations to the END of this list (never edit or reorder old ones).
const MIGRATIONS = [
  { name: 'initial schema (database/schema.sql)', run() {
    db.exec(fs.readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')); // all IF NOT EXISTS
  } },
  { name: 'service_bookings.priority column', run() {
    if (!hasColumn('service_bookings', 'priority'))
      db.exec("ALTER TABLE service_bookings ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high'))");
  } },
  { name: 'default Kanban WIP limits', run() {
    db.exec("INSERT OR IGNORE INTO kanban_wip_limits(status,wip_limit) VALUES ('pending',0),('confirmed',3),('in_progress',2),('completed',2),('delivered',0)");
  } },
  { name: 'customer problem reports: title, image, backlog link + problem categories', run() {
    if (!hasColumn('service_bookings', 'title')) db.exec('ALTER TABLE service_bookings ADD COLUMN title TEXT');
    if (!hasColumn('service_bookings', 'image_path')) db.exec('ALTER TABLE service_bookings ADD COLUMN image_path TEXT');
    if (!hasColumn('service_bookings', 'backlog_id')) db.exec('ALTER TABLE service_bookings ADD COLUMN backlog_id INTEGER REFERENCES product_backlog(id) ON DELETE SET NULL');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_backlog ON service_bookings(backlog_id) WHERE backlog_id IS NOT NULL');
    const add = db.prepare('INSERT OR IGNORE INTO service_categories(name,description,base_price,est_hours) VALUES(?,?,?,?)');
    for (const c of [['Engine', 'Engine noise, overheating, performance issues', 2500, 3], ['Brakes', 'Brake noise, pedal feel, pads and discs', 3200, 3], ['AC', 'Cooling, gas, compressor and vents', 3800, 4],
      ['Battery', 'Starting problems, battery and charging', 5500, 1], ['Tyres', 'Tyre wear, puncture, replacement and balancing', 2000, 1], ['Electrical', 'Lights, wiring, sensors and electronics', 2200, 2], ['General Service', 'Routine service and general checks', 1800, 2]])
      add.run(...c);
  } },
];

export function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const done = new Set(q('SELECT version FROM schema_migrations').map((r) => r.version));
  MIGRATIONS.forEach((m, i) => {
    const version = i + 1;
    if (done.has(version)) return;
    tx(() => { m.run(); q('INSERT INTO schema_migrations(version,name) VALUES(?,?)', [version, m.name]); });
    console.log(`[migrate] applied #${version}: ${m.name}`);
  });
  console.log(`[migrate] Database ready (schema version ${MIGRATIONS.length}) at ${DB_PATH}`);
}

function isEmpty() {
  return ['users', 'customers', 'mechanics', 'vehicles', 'service_bookings', 'product_backlog', 'sprints']
    .every((t) => q(`SELECT COUNT(*) n FROM ${t}`)[0].n === 0);
}

// force = true ignores SEED_DEMO_DATA (used by `npm run seed`). The database still has to be completely empty.
export function seedDemoIfEmpty({ force = false } = {}) {
  if (!force && String(process.env.SEED_DEMO_DATA).toLowerCase() !== 'true') return console.log('[seed] SEED_DEMO_DATA is not "true" - no demo data added.');
  if (!isEmpty()) return console.log('[seed] Database already has data - demo data skipped, nothing changed.');
  tx(() => insertDemoData());
  console.log('[seed] Demo data added to the empty database.');
}

// Called by server.js before it starts listening.
export function prepareDatabase() {
  runMigrations();
  seedDemoIfEmpty();
}
