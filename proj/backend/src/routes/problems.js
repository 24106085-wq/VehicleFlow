import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { q, tx, DB_PATH, BOOKING_SQL } from '../db.js';
import { auth, allow, wrap, bad, customerId, mechanicId } from '../middleware.js';

// Customer problem reports. A "problem" is a service booking (so admins, mechanics, the Kanban board and the
// customer's tracker all share ONE record) plus a Product Backlog story created in the same transaction.
const r = Router();
r.use(auth);
const PRIORITIES = ['low', 'medium', 'high'];
const POINTS = { low: 1, medium: 3, high: 5 };
const UPLOADS = path.join(path.dirname(DB_PATH), 'uploads');
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const MAX_BYTES = 5 * 1024 * 1024;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

r.post('/', allow('customer'), wrap(async (req, res) => {
  const b = req.body || {};
  const title = clip(b.title, 100), description = clip(b.description, 1000);
  const priority = b.priority;
  if (!b.vehicle_id || !b.category_id) return bad(res, 'Select a vehicle and a problem category');
  if (title.length < 3) return bad(res, 'Problem title must be at least 3 characters');
  if (description.length < 10) return bad(res, 'Please describe the problem (at least 10 characters)');
  if (!PRIORITIES.includes(priority)) return bad(res, 'Priority must be low, medium or high');

  const cid = customerId(req.user.id);
  const v = q('SELECT * FROM vehicles WHERE id=?', [b.vehicle_id])[0];
  if (!v) return bad(res, 'Vehicle not found');
  if (v.customer_id !== cid) return res.status(403).json({ error: 'This is not your vehicle' });
  const cat = q('SELECT id,name FROM service_categories WHERE id=? AND active=1', [b.category_id])[0];
  if (!cat) return bad(res, 'Problem category not found');

  // Optional image (base64 in JSON, PNG/JPG up to 5 MB) is validated BEFORE anything is saved.
  let img = null;
  if (b.image) {
    const ext = TYPES[b.image.type];
    if (!ext) return bad(res, 'Image must be a PNG or JPG');
    const buf = Buffer.from(String(b.image.data || ''), 'base64');
    if (!buf.length) return bad(res, 'The image could not be read');
    if (buf.length > MAX_BYTES) return bad(res, 'Image must be 5 MB or smaller');
    const png = buf.subarray(0, 4).toString('hex') === '89504e47', jpg = buf.subarray(0, 2).toString('hex') === 'ffd8';
    if ((ext === 'png' && !png) || (ext === 'jpg' && !jpg)) return bad(res, 'The file is not a valid image');
    img = { buf, name: `problem-${crypto.randomBytes(12).toString('hex')}.${ext}` };
  }

  // No duplicate: the same open problem (same vehicle + title) cannot be reported twice.
  const dup = q(`SELECT id FROM service_bookings WHERE customer_id=? AND vehicle_id=? AND lower(title)=lower(?) AND status NOT IN ('delivered','cancelled')`, [cid, v.id, title])[0];
  if (dup) return res.status(409).json({ error: 'You have already reported this problem for this vehicle and it is still open' });

  const today = q("SELECT date('now') d")[0].d;
  let id;
  try {
    if (img) { fs.mkdirSync(UPLOADS, { recursive: true }); fs.writeFileSync(path.join(UPLOADS, img.name), img.buf); }
    id = tx(() => {
      const story = q('INSERT INTO product_backlog(title,description,acceptance_criteria,priority,story_points,created_by) VALUES(?,?,?,?,?,?)', [
        `${title} (${v.make} ${v.model}, ${v.plate})`.slice(0, 150),
        `[${cat.name}] ${description}\nReported by customer ${req.user.name || ''} for ${v.make} ${v.model} (${v.plate}).`.slice(0, 2000),
        'Problem diagnosed and resolved; vehicle returned and customer informed of the outcome.',
        priority, POINTS[priority], req.user.id]);
      const x = q(`INSERT INTO service_bookings(customer_id,vehicle_id,category_id,scheduled_date,notes,estimated_cost,priority,title,image_path,backlog_id)
        VALUES(?,?,?,?,?,(SELECT base_price FROM service_categories WHERE id=?),?,?,?,?)`,
      [cid, v.id, cat.id, today, description, cat.id, priority, title, img?.name || null, story.insertId]);
      q('INSERT INTO service_activity(booking_id,user_id,action) VALUES(?,?,?)', [x.insertId, req.user.id, 'Problem reported']);
      q(`INSERT INTO notifications(user_id,message) SELECT id,? FROM users WHERE role='admin'`, [`New problem reported: ${title} (${v.plate})`]);
      return x.insertId;
    });
  } catch (e) {
    if (img) fs.rmSync(path.join(UPLOADS, img.name), { force: true }); // do not leave an orphan file behind
    throw e;
  }
  res.status(201).json(q(`${BOOKING_SQL} WHERE b.id=?`, [id])[0]);
}));

// Image of one problem: only its owner, an admin, or the assigned mechanic can see it.
r.get('/:id/image', wrap(async (req, res) => {
  const b = q('SELECT customer_id, mechanic_id, image_path FROM service_bookings WHERE id=?', [req.params.id])[0];
  if (!b || !b.image_path) return res.status(404).json({ error: 'No image' });
  if (req.user.role === 'customer' && b.customer_id !== customerId(req.user.id)) return res.status(403).json({ error: 'This is not your problem report' });
  if (req.user.role === 'mechanic' && b.mechanic_id !== mechanicId(req.user.id)) return res.status(403).json({ error: 'This job is not assigned to you' });
  const file = path.join(UPLOADS, path.basename(b.image_path));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Image file missing' });
  res.type(file.endsWith('.png') ? 'image/png' : 'image/jpeg').sendFile(file);
}));

export default r;
