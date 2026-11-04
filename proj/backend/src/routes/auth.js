import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, tx, isUniqueError } from '../db.js';
import { sign, auth, wrap, bad } from '../middleware.js';

const r = Router();
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone });
const pwError = (p) => (!p || p.length < 8 || !/\d/.test(p) || !/[a-zA-Z]/.test(p)) ? 'Password needs 8+ characters with letters and numbers' : null;
const phoneOk = (p) => !p || /^[0-9+\-\s]{7,20}$/.test(p);

// Public registration always creates a customer. Admin/mechanic accounts are created by seed/admin.
r.post('/register', wrap(async (req, res) => {
  const { name, password, phone } = req.body;
  const email = (req.body.email || '').toLowerCase().trim();
  if (!name || name.trim().length < 2) return bad(res, 'Name must be at least 2 characters');
  if (!emailRx.test(email)) return bad(res, 'Enter a valid email address');
  if (pwError(password)) return bad(res, pwError(password));
  if (!phoneOk(phone)) return bad(res, 'Enter a valid phone number');
  if ((q('SELECT id FROM users WHERE email=?', [email]))[0]) return res.status(409).json({ error: 'Email is already registered' });

  const hash = await bcrypt.hash(password, 10);
  try {
    // user + customer rows are saved together, or not at all
    const user = tx(() => {
      const u = q('INSERT INTO users(name,email,password_hash,role,phone) VALUES(?,?,?,?,?)', [name.trim(), email, hash, 'customer', phone || null]);
      q('INSERT INTO customers(user_id) VALUES(?)', [u.insertId]);
      return { id: u.insertId, name: name.trim(), email, role: 'customer', phone: phone || null };
    });
    res.status(201).json({ token: sign(user), user });
  } catch (e) {
    if (isUniqueError(e)) return res.status(409).json({ error: 'Email is already registered' });
    throw e;
  }
}));

r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return bad(res, 'Email and password are required');
  const u = (q('SELECT * FROM users WHERE email=?', [email.toLowerCase().trim()]))[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), user: pub(u) });
}));

r.get('/me', auth, wrap(async (req, res) => {
  const u = (q('SELECT * FROM users WHERE id=?', [req.user.id]))[0];
  if (!u) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: pub(u) });
}));

r.put('/me', auth, wrap(async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || name.trim().length < 2) return bad(res, 'Name must be at least 2 characters');
  if (!phoneOk(phone)) return bad(res, 'Enter a valid phone number');
  if (password && pwError(password)) return bad(res, pwError(password));
  q('UPDATE users SET name=?, phone=? WHERE id=?', [name.trim(), phone || null, req.user.id]);
  if (password) q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 10), req.user.id]);
  const u = (q('SELECT * FROM users WHERE id=?', [req.user.id]))[0];
  res.json({ user: pub(u) });
}));

export default r;
