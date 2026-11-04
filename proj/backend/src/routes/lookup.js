import { Router } from 'express';
import { q } from '../db.js';
import { auth, allow, wrap } from '../middleware.js';

const r = Router();
r.use(auth);
r.get('/categories', wrap(async (_, res) => res.json(q('SELECT * FROM service_categories WHERE active=1 ORDER BY name'))));
r.get('/customers', allow('admin'), wrap(async (_, res) => res.json(q("SELECT c.id,u.name,u.email FROM customers c JOIN users u ON u.id=c.user_id ORDER BY u.name"))));
r.get('/mechanics', allow('admin'), wrap(async (_, res) => res.json(q("SELECT m.id,u.name,m.specialization,m.availability FROM mechanics m JOIN users u ON u.id=m.user_id ORDER BY u.name"))));
export default r;
