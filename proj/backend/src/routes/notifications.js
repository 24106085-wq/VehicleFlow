import { Router } from 'express';
import { q } from '../db.js';
import { auth, wrap } from '../middleware.js';

// The signed-in user's own notifications (the bell in the header). Nobody can read another user's rows.
const r = Router();
r.use(auth);
r.get('/', wrap(async (req, res) => {
  const items = q('SELECT id, message, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 15', [req.user.id]);
  const unread = q('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id])[0].n;
  res.json({ items, unread });
}));
r.post('/read', wrap(async (req, res) => {
  q('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0', [req.user.id]);
  res.json({ ok: true });
}));
export default r;
