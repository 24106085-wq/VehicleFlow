import jwt from 'jsonwebtoken';
import { q } from './db.js';

export const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
export function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Authentication required' }); }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have access to this resource' });
// Works for both normal and async handlers: any error (including a thrown database error) goes to the Express error handler.
export const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
export const bad = (res, error) => res.status(400).json({ error });
export const customerId = (uid) => q('SELECT id FROM customers WHERE user_id=?', [uid])[0]?.id;
export const mechanicId = (uid) => q('SELECT id FROM mechanics WHERE user_id=?', [uid])[0]?.id;
