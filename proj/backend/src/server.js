import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { q, db } from './db.js';
import { prepareDatabase } from './bootstrap.js';
import auth from './routes/auth.js';
import vehicles from './routes/vehicles.js';
import bookings from './routes/bookings.js';
import dashboard from './routes/dashboard.js';
import board from './routes/board.js';
import admin from './routes/admin.js';
import lookup from './routes/lookup.js';
import scrum from './routes/scrum.js';
import problems from './routes/problems.js';
import notifications from './routes/notifications.js';
import serviceBoard from './routes/serviceBoard.js';

const PLACEHOLDER_SECRETS = ['replace_with_a_secure_random_secret', 'your_secure_random_secret', 'change-this-to-a-long-random-string'];
if (!process.env.JWT_SECRET || PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET)) {
  console.error('JWT_SECRET is missing or still the example value. Generate one and put it in .env (see README).'); process.exit(1);
}
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '8mb' })); // problem reports may carry a base64 image (max 5 MB file)

// Health check (also used by Docker): the app is up AND the SQLite database answers. /api/health is kept for the existing frontend/docs.
const health = (_, res) => {
  try {
    q('SELECT 1');
    res.json({ ok: true, status: 'ok', db: 'connected', uptime: Math.round(process.uptime()) });
  } catch { res.status(503).json({ ok: false, status: 'unhealthy', db: 'unreachable' }); }
};
app.get('/health', health);
app.get('/api/health', health);
app.use('/api/auth', auth);
app.use('/api/vehicles', vehicles);
app.use('/api/bookings', bookings);
app.use('/api/problems', problems);
app.use('/api/service-board', serviceBoard);
app.use('/api/notifications', notifications);
app.use('/api/dashboard', dashboard);
app.use('/api/board', board);
app.use('/api/admin', admin);
app.use('/api/scrum', scrum);
app.use('/api', lookup);
app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
app.use((e, _req, res, _next) => { console.error(e); res.status(500).json({ error: 'Something went wrong on the server' }); });

// Create/open the SQLite file, apply the safe migrations, then start listening on all interfaces (required inside a container).
const port = process.env.PORT || 5000;
try { prepareDatabase(); }
catch (e) { console.error('Database preparation failed:', e.message); process.exit(1); }
const server = app.listen(port, '0.0.0.0', () => console.log(`VehicleFlow API on 0.0.0.0:${port}`));

// "docker compose stop/down" sends SIGTERM: stop accepting requests, then close SQLite so everything is flushed to the file.
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => server.close(() => { try { db.close(); } catch {} process.exit(0); }));
