// Makes a consistent copy of the SQLite database while the app is running (safe with WAL mode).
// Docker:  docker compose exec backend node scripts/backup.js     -> /app/data/backups/vehicleflow-<time>.db
// Local:   npm run backup                                          -> ./data/backups/vehicleflow-<time>.db
import fs from 'fs';
import path from 'path';
import { db, DB_PATH } from '../src/db.js';

const dir = path.join(path.dirname(DB_PATH), 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `vehicleflow-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.db`);
db.prepare('VACUUM INTO ?').run(file); // writes a complete, consistent copy; never changes the live database
console.log(`Backup written: ${file}`);
db.close();
