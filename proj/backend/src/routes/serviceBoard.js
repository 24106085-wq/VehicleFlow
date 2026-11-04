import { Router } from 'express';
import { q, tx, BOOKING_SQL } from '../db.js';
import { auth, allow, wrap, bad } from '../middleware.js';
import { columnOf, statusFor, statsOf, COLUMN_TITLE } from '../serviceBoard.js';

// Admin Dashboard + Service Kanban Board. Admin only; reads and writes the same service_bookings rows the customer sees,
// so a status change here shows up in the customer's "My Problems" page straight away.
const r = Router();
r.use(auth, allow('admin'));
const PRIORITIES = ['low', 'medium', 'high'];
const log = (bookingId, userId, text) => q('INSERT INTO service_activity(booking_id,user_id,action) VALUES(?,?,?)', [bookingId, userId, text]);
const OPEN = "WHERE b.status <> 'cancelled' ORDER BY b.created_at DESC, b.id DESC";

const shape = (b) => ({
  id: b.id, title: b.title || b.category, category: b.category, plate: b.plate, make: b.make, model: b.model,
  priority: b.priority, status: b.status, column: columnOf(b.status), customer: b.customer,
  mechanic_id: b.mechanic_id, mechanic: b.mechanic, description: b.notes, resolution_notes: b.mechanic_notes,
  reported_at: b.created_at, has_image: !!b.image_path,
});
const load = () => q(`${BOOKING_SQL} ${OPEN}`);
const board = () => { const rows = load(); return { stats: statsOf(rows), tasks: rows.map(shape) }; };

r.get('/', wrap(async (_, res) => res.json(board())));

// Product Backlog: every customer-reported problem (bookings), cancelled ones included so the list is complete.
r.get('/backlog', wrap(async (_, res) => {
  const rows = q(`${BOOKING_SQL} ORDER BY b.created_at DESC, b.id DESC`);
  res.json({ problems: rows.map(shape), stats: statsOf(rows) });
}));

// Sprint Summary: sprint name, goal and dates come from the sprints table (active sprint, else the most recent one);
// every number comes from the real vehicle problem records and their statuses (cancelled requests are not counted).
r.get('/sprint-summary', wrap(async (_, res) => {
  const sprint = q(`SELECT id,name,goal,start_date,end_date,status FROM sprints
    ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END, start_date DESC, id DESC LIMIT 1`)[0] || null;
  const stats = statsOf(q(`${BOOKING_SQL} ${OPEN}`));
  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  res.json({ sprint, stats, percent });
}));

// Details also open for cancelled requests (read-only: PATCH below still refuses them).
r.get('/:id', wrap(async (req, res) => {
  const b = q(`${BOOKING_SQL} WHERE b.id=?`, [req.params.id])[0];
  if (!b) return res.status(404).json({ error: 'Service request not found' });
  const history = q('SELECT a.id, a.action, a.created_at, u.name actor FROM service_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.booking_id=? ORDER BY a.id DESC', [b.id]);
  res.json({ ...shape(b), history });
}));

// One endpoint for everything the admin can change: status (column), priority, mechanic, resolution notes.
r.patch('/:id', wrap(async (req, res) => {
  const b = q('SELECT b.*, c.user_id cuser FROM service_bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?', [req.params.id])[0];
  if (!b || b.status === 'cancelled') return res.status(404).json({ error: 'Service request not found' });
  const i = req.body || {}, set = {};

  if (i.status !== undefined) {
    const next = statusFor(b.status, i.status);
    if (!next) return bad(res, 'Status must be todo, in_progress or done');
    if (next !== b.status) set.status = next;
  }
  if (i.priority !== undefined) {
    if (!PRIORITIES.includes(i.priority)) return bad(res, 'Priority must be low, medium or high');
    if (i.priority !== b.priority) set.priority = i.priority;
  }
  if (i.mechanic_id !== undefined) {
    const mid = i.mechanic_id ? Number(i.mechanic_id) : null;
    if (mid && !q('SELECT id FROM mechanics WHERE id=?', [mid])[0]) return bad(res, 'Mechanic not found');
    if (mid !== b.mechanic_id) set.mechanic_id = mid;
  }
  if (i.resolution_notes !== undefined) {
    const n = String(i.resolution_notes).trim().slice(0, 2000);
    if (n !== (b.mechanic_notes || '')) set.mechanic_notes = n || null;
  }
  if (set.status === 'completed' && b.final_cost == null) set.final_cost = b.estimated_cost;

  const keys = Object.keys(set);
  if (keys.length) {
    // update + activity history + customer notification are saved together, or not at all
    tx(() => {
      q(`UPDATE service_bookings SET ${keys.map((k) => k + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...keys.map((k) => set[k]), b.id]);
      if (set.status) {
        log(b.id, req.user.id, `Moved from ${COLUMN_TITLE[columnOf(b.status)]} to ${COLUMN_TITLE[columnOf(set.status)]}`);
        q('INSERT INTO notifications(user_id,message) VALUES(?,?)', [b.cuser, `Your service request #${b.id} is now ${COLUMN_TITLE[columnOf(set.status)]}`]);
      }
      if (set.priority) log(b.id, req.user.id, `Priority changed to ${set.priority}`);
      if ('mechanic_id' in set) {
        const name = set.mechanic_id ? q('SELECT u.name FROM mechanics m JOIN users u ON u.id=m.user_id WHERE m.id=?', [set.mechanic_id])[0]?.name : null;
        log(b.id, req.user.id, name ? `Mechanic assigned: ${name}` : 'Mechanic unassigned');
      }
      if ('mechanic_notes' in set) log(b.id, req.user.id, 'Resolution notes updated');
    });
  }
  // The fresh statistics travel with the answer, so the dashboard refreshes without another request.
  const rows = load();
  res.json({ changed: keys.length > 0, task: shape(rows.find((x) => x.id === b.id)), stats: statsOf(rows) });
}));

export default r;
