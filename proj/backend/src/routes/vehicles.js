import { Router } from 'express';
import { q, isUniqueError, isForeignKeyError } from '../db.js';
import { auth, allow, wrap, bad, customerId } from '../middleware.js';

const r = Router();
r.use(auth, allow('admin', 'customer'));
const maxYear = new Date().getFullYear() + 1;

function check(b) {
  if (!b.make?.trim() || !b.model?.trim()) return 'Make and model are required';
  const y = +b.year;
  if (!Number.isInteger(y) || y < 1980 || y > maxYear) return `Year must be between 1980 and ${maxYear}`;
  if (!/^[A-Z0-9 -]{4,15}$/i.test(b.plate || '')) return 'Enter a valid registration plate';
  if (b.mileage !== '' && b.mileage != null && (!Number.isInteger(+b.mileage) || +b.mileage < 0)) return 'Mileage must be a whole number, 0 or more';
  return null;
}
const clean = (b) => [b.make.trim(), b.model.trim(), +b.year, b.plate.trim().toUpperCase(), b.color?.trim() || null, +b.mileage || 0];

function owned(req, res) {
  const v = (q('SELECT * FROM vehicles WHERE id=?', [req.params.id]))[0];
  if (!v) { res.status(404).json({ error: 'Vehicle not found' }); return null; }
  if (req.user.role === 'customer' && v.customer_id !== customerId(req.user.id)) { res.status(403).json({ error: 'This is not your vehicle' }); return null; }
  return v;
}

r.get('/', wrap(async (req, res) => {
  const cid = req.user.role === 'customer' ? customerId(req.user.id) : null;
  res.json(q(`SELECT v.*, u.name owner FROM vehicles v JOIN customers c ON c.id=v.customer_id JOIN users u ON u.id=c.user_id ${cid ? 'WHERE v.customer_id=?' : ''} ORDER BY v.id DESC`, cid ? [cid] : []));
}));

r.post('/', wrap(async (req, res) => {
  const e = check(req.body); if (e) return bad(res, e);
  const cid = req.user.role === 'customer' ? customerId(req.user.id) : +req.body.customer_id;
  if (!cid) return bad(res, 'Select a customer');
  try {
    const x = q('INSERT INTO vehicles(make,model,year,plate,color,mileage,customer_id) VALUES(?,?,?,?,?,?,?)', [...clean(req.body), cid]);
    res.status(201).json({ id: x.insertId });
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'This plate is already registered' });
    if (isForeignKeyError(err)) return bad(res, 'Customer not found');
    throw err;
  }
}));

r.put('/:id', wrap(async (req, res) => {
  if (!owned(req, res)) return;
  const e = check(req.body); if (e) return bad(res, e);
  try {
    q('UPDATE vehicles SET make=?,model=?,year=?,plate=?,color=?,mileage=? WHERE id=?', [...clean(req.body), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'This plate is already registered' });
    throw err;
  }
}));

r.delete('/:id', wrap(async (req, res) => {
  if (!owned(req, res)) return;
  try { q('DELETE FROM vehicles WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) {
    if (isForeignKeyError(err)) return res.status(409).json({ error: 'This vehicle has service bookings and cannot be deleted' });
    throw err;
  }
}));

export default r;
