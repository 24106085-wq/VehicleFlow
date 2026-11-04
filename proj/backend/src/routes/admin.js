import { Router } from 'express';
import { q, BOOKING_SQL } from '../db.js';
import { auth, allow, wrap, bad } from '../middleware.js';

// Admin customer management: list/search, details, edit.
const r = Router();
r.use(auth, allow('admin'));

r.get('/customers', wrap(async (_, res) => {
  res.json(q(`SELECT c.id, u.name, u.email, u.phone, c.address, u.created_at,
    (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id=c.id) vehicles,
    (SELECT COUNT(*) FROM service_bookings b WHERE b.customer_id=c.id) bookings,
    (SELECT COUNT(*) FROM service_bookings b WHERE b.customer_id=c.id AND b.status IN ('pending','confirmed','in_progress','completed')) active,
    (SELECT COALESCE(SUM(final_cost),0) FROM service_bookings b WHERE b.customer_id=c.id AND b.status IN ('completed','delivered')) spent
    FROM customers c JOIN users u ON u.id=c.user_id ORDER BY u.name`));
}));

r.get('/customers/:id', wrap(async (req, res) => {
  const c = q('SELECT c.id, u.name, u.email, u.phone, c.address, u.created_at FROM customers c JOIN users u ON u.id=c.user_id WHERE c.id=?', [req.params.id])[0];
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  res.json({ ...c, vehicles: q('SELECT * FROM vehicles WHERE customer_id=? ORDER BY id DESC', [c.id]), bookings: q(`${BOOKING_SQL} WHERE b.customer_id=? ORDER BY b.created_at DESC, b.id DESC`, [c.id]) });
}));

r.put('/customers/:id', wrap(async (req, res) => {
  const c = q('SELECT id, user_id FROM customers WHERE id=?', [req.params.id])[0];
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const { name, phone, address } = req.body;
  if (!name || name.trim().length < 2) return bad(res, 'Name must be at least 2 characters');
  if (phone && !/^[0-9+\-\s]{7,20}$/.test(phone)) return bad(res, 'Enter a valid phone number');
  q("UPDATE users SET name=?, phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [name.trim(), phone || null, c.user_id]);
  q('UPDATE customers SET address=? WHERE id=?', [(address || '').trim().slice(0, 300) || null, c.id]);
  res.json({ ok: true });
}));

export default r;
