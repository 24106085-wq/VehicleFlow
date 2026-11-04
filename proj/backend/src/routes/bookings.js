import { Router } from 'express';
import { q, tx, BOOKING_SQL } from '../db.js';
import { auth, allow, wrap, bad, customerId, mechanicId } from '../middleware.js';
import { checkTransition, STAGE_TITLE } from '../serviceFlow.js';

const r = Router();
r.use(auth);
const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'delivered', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high'];
// Service activity history: one row per important change, shown on the Kanban card.
const log = (bookingId, userId, text) => q('INSERT INTO service_activity(booking_id,user_id,action) VALUES(?,?,?)', [bookingId, userId, text]);

r.get('/', wrap(async (req, res) => {
  let where = '', p = [];
  if (req.user.role === 'customer') { where = 'WHERE b.customer_id=?'; p = [customerId(req.user.id)]; }
  if (req.user.role === 'mechanic') { where = 'WHERE b.mechanic_id=?'; p = [mechanicId(req.user.id)]; }
  res.json(q(`${BOOKING_SQL} ${where} ORDER BY b.created_at DESC, b.id DESC`, p));
}));

r.post('/', allow('admin', 'customer'), wrap(async (req, res) => {
  const { vehicle_id, category_id, scheduled_date, notes } = req.body;
  if (!vehicle_id || !category_id || !scheduled_date) return bad(res, 'Vehicle, service and date are required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date) || scheduled_date < new Date().toISOString().slice(0, 10)) return bad(res, 'Choose today or a future date');
  const v = (q('SELECT customer_id FROM vehicles WHERE id=?', [vehicle_id]))[0];
  if (!v) return bad(res, 'Vehicle not found');
  if (req.user.role === 'customer' && v.customer_id !== customerId(req.user.id)) return res.status(403).json({ error: 'This is not your vehicle' });
  const c = (q('SELECT base_price FROM service_categories WHERE id=? AND active=1', [category_id]))[0];
  if (!c) return bad(res, 'Service not found');
  // Only admins choose a priority; customer bookings always start as medium.
  const priority = req.user.role === 'admin' ? req.body.priority || 'medium' : 'medium';
  if (!PRIORITIES.includes(priority)) return bad(res, 'Priority must be low, medium or high');
  // booking + history + admin notifications are saved together, or not at all
  const id = tx(() => {
    const x = q('INSERT INTO service_bookings(customer_id,vehicle_id,category_id,scheduled_date,notes,estimated_cost,priority) VALUES(?,?,?,?,?,?,?)',
      [v.customer_id, vehicle_id, category_id, scheduled_date, (notes || '').slice(0, 1000) || null, c.base_price, priority]);
    log(x.insertId, req.user.id, 'Booking created');
    q(`INSERT INTO notifications(user_id,message) SELECT id,? FROM users WHERE role='admin'`, [`New booking #${x.insertId} received`]);
    return x.insertId;
  });
  res.status(201).json({ id });
}));

r.get('/:id/history', wrap(async (req, res) => {
  const b = (q('SELECT id, customer_id, mechanic_id FROM service_bookings WHERE id=?', [req.params.id]))[0];
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role === 'customer' && b.customer_id !== customerId(req.user.id)) return res.status(403).json({ error: 'This is not your booking' });
  if (req.user.role === 'mechanic' && b.mechanic_id !== mechanicId(req.user.id)) return res.status(403).json({ error: 'This job is not assigned to you' });
  res.json(q('SELECT a.id, a.action, a.created_at, u.name actor FROM service_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.booking_id=? ORDER BY a.id DESC', [b.id]));
}));

// Role-scoped updates: admin = assign/status/cost, mechanic = progress on own jobs, customer = cancel own pending booking.
r.patch('/:id', wrap(async (req, res) => {
  const b = (q('SELECT b.*, c.user_id cuser FROM service_bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?', [req.params.id]))[0];
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const { role, id } = req.user, i = req.body, set = {};

  if (role === 'admin') {
    if (i.mechanic_id !== undefined) {
      if (i.mechanic_id && !(q('SELECT id FROM mechanics WHERE id=?', [i.mechanic_id]))[0]) return bad(res, 'Mechanic not found');
      set.mechanic_id = i.mechanic_id ? Number(i.mechanic_id) : null;
      if (i.mechanic_id && b.status === 'pending' && i.status === undefined) set.status = 'confirmed';
    }
    if (i.status !== undefined) {
      if (!STATUSES.includes(i.status)) return bad(res, 'Invalid status');
      // Kanban rule: one stage at a time (see serviceFlow.js), and a mechanic must be assigned before repair starts.
      const moveError = checkTransition(b.status, i.status);
      if (moveError) return bad(res, moveError);
      const mech = set.mechanic_id !== undefined ? set.mechanic_id : b.mechanic_id;
      if (['in_progress', 'completed', 'delivered'].includes(i.status) && !mech) return bad(res, 'Assign a mechanic before moving a booking to Repairing');
      set.status = i.status;
    }
    if (i.priority !== undefined) { if (!PRIORITIES.includes(i.priority)) return bad(res, 'Priority must be low, medium or high'); set.priority = i.priority; }
    for (const k of ['estimated_cost', 'final_cost'])
      if (i[k] !== undefined && i[k] !== '') { if (isNaN(i[k]) || +i[k] < 0) return bad(res, `Invalid ${k.replace('_', ' ')}`); set[k] = +i[k]; }
    if (i.mechanic_notes !== undefined) set.mechanic_notes = String(i.mechanic_notes).slice(0, 2000);
  } else if (role === 'mechanic') {
    if (b.mechanic_id !== mechanicId(id)) return res.status(403).json({ error: 'This job is not assigned to you' });
    if (i.status !== undefined) {
      if (!['in_progress', 'completed'].includes(i.status)) return bad(res, 'Mechanics can set In progress or Completed');
      // Finished jobs are locked for mechanics so a job already on Quality Check / Delivered cannot be pulled back.
      if (['completed', 'delivered', 'cancelled'].includes(b.status)) return bad(res, `This job is already ${b.status}. Ask the admin if it needs to change`);
      const moveError = checkTransition(b.status, i.status);
      if (moveError) return bad(res, moveError);
      set.status = i.status;
    }
    if (i.mechanic_notes !== undefined) set.mechanic_notes = String(i.mechanic_notes).slice(0, 2000);
  } else {
    if (b.customer_id !== customerId(id) || b.status !== 'pending' || i.status !== 'cancelled')
      return res.status(403).json({ error: 'Customers can only cancel their own pending bookings' });
    set.status = 'cancelled';
  }

  if (['completed', 'delivered'].includes(set.status) && b.final_cost == null && set.final_cost === undefined) set.final_cost = b.estimated_cost;
  const keys = Object.keys(set);
  if (!keys.length) return bad(res, 'Nothing to update');
  // the update, its activity history and the customer notification are saved together, or not at all
  tx(() => {
    q(`UPDATE service_bookings SET ${keys.map((k) => k + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...keys.map((k) => set[k]), b.id]);
    if (set.status && set.status !== b.status) log(b.id, id, `Moved from ${STAGE_TITLE[b.status]} to ${STAGE_TITLE[set.status]}`);
    if (set.mechanic_id !== undefined && set.mechanic_id !== b.mechanic_id) {
      const name = set.mechanic_id ? (q('SELECT u.name FROM mechanics m JOIN users u ON u.id=m.user_id WHERE m.id=?', [set.mechanic_id]))[0]?.name : null;
      log(b.id, id, name ? `Mechanic assigned: ${name}` : 'Mechanic unassigned');
    }
    for (const k of ['estimated_cost', 'final_cost'])
      if (set[k] !== undefined && set[k] !== b[k]) log(b.id, id, `${k === 'final_cost' ? 'Final' : 'Estimated'} cost set to ₹${set[k]}`);
    if (set.priority && set.priority !== b.priority) log(b.id, id, `Priority changed to ${set.priority}`);
    if (set.mechanic_notes !== undefined && set.mechanic_notes !== (b.mechanic_notes || '')) log(b.id, id, 'Repair notes updated');
    if (set.status && set.status !== b.status)
      q('INSERT INTO notifications(user_id,message) VALUES(?,?)', [b.cuser, `Booking #${b.id} is now ${set.status.replace('_', ' ')}`]);
  });
  res.json({ ok: true });
}));

export default r;
