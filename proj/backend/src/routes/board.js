import { Router } from 'express';
import { q } from '../db.js';
import { auth, allow, wrap, bad } from '../middleware.js';

// Kanban board settings (admin only). Columns are keyed by booking status:
// pending = Booking, confirmed = Inspection, in_progress = Repairing, completed = Quality Check, delivered = Delivered
const r = Router();
r.use(auth, allow('admin'));
const COLUMNS = ['pending', 'confirmed', 'in_progress', 'completed', 'delivered'];

// GET /api/board/wip-limits -> { pending: 0, confirmed: 3, ... }   (0 means "no limit")
r.get('/wip-limits', wrap(async (_, res) => {
  const limits = Object.fromEntries(COLUMNS.map((s) => [s, 0]));
  for (const row of q('SELECT status, wip_limit FROM kanban_wip_limits')) if (row.status in limits) limits[row.status] = row.wip_limit;
  res.json(limits);
}));

// PUT /api/board/wip-limits/:status  body: { limit: 3 }
r.put('/wip-limits/:status', wrap(async (req, res) => {
  const { status } = req.params, n = Number(req.body.limit);
  if (!COLUMNS.includes(status)) return bad(res, 'Unknown column');
  if (!Number.isInteger(n) || n < 0 || n > 99) return bad(res, 'WIP limit must be a whole number from 0 to 99 (0 = no limit)');
  q('INSERT INTO kanban_wip_limits(status,wip_limit) VALUES(?,?) ON CONFLICT(status) DO UPDATE SET wip_limit=excluded.wip_limit', [status, n]);
  res.json({ ok: true });
}));

export default r;
