import { Router } from 'express';
import { q, BOOKING_SQL } from '../db.js';
import { auth, wrap, customerId, mechanicId } from '../middleware.js';

const r = Router();
r.use(auth);
const DONE = "('completed','delivered')";

r.get('/', wrap(async (req, res) => {
  const { role, id } = req.user;
  if (role === 'admin') {
    const [stats] = q(`SELECT
      (SELECT COUNT(*) FROM vehicles) vehicles,
      (SELECT COUNT(*) FROM service_bookings) bookings,
      (SELECT COUNT(*) FROM service_bookings WHERE status='pending') pending,
      (SELECT COUNT(*) FROM service_bookings WHERE status='in_progress') underRepair,
      (SELECT COUNT(*) FROM service_bookings WHERE status IN ${DONE}) completed,
      (SELECT COALESCE(SUM(final_cost),0) FROM service_bookings WHERE status IN ${DONE}) revenue`);
    const recent = q(`${BOOKING_SQL} ORDER BY b.created_at DESC, b.id DESC LIMIT 6`);
    const mechanics = q(`SELECT m.id,u.name,m.specialization,m.availability,
      (SELECT COUNT(*) FROM service_bookings b WHERE b.mechanic_id=m.id AND b.status IN ('confirmed','in_progress')) active
      FROM mechanics m JOIN users u ON u.id=m.user_id`);
    const [x] = q(`SELECT (SELECT COUNT(*) FROM customers) customers,
      (SELECT COUNT(*) FROM service_bookings WHERE mechanic_id IS NULL AND status IN ('pending','confirmed')) unassigned,
      (SELECT COUNT(*) FROM service_bookings WHERE status='cancelled') cancelled,
      (SELECT COUNT(*) FROM service_bookings WHERE priority='high' AND status IN ('pending','confirmed','in_progress')) urgent,
      (SELECT COALESCE(SUM(estimated_cost),0) FROM service_bookings WHERE status IN ('pending','confirmed','in_progress')) pipeline`);
    Object.assign(stats, x);
    const topServices = q(`SELECT sc.name, COUNT(*) n FROM service_bookings b JOIN service_categories sc ON sc.id=b.category_id GROUP BY sc.id ORDER BY n DESC LIMIT 5`);
    return res.json({ stats, recent, mechanics, topServices });
  }
  if (role === 'mechanic') {
    const mid = mechanicId(id);
    // vehicles = distinct vehicles assigned, pending = jobs not finished yet, completed = repairs done (cancelled jobs ignored)
    const [stats] = q(`SELECT COUNT(DISTINCT vehicle_id) vehicles,
      COALESCE(SUM(status IN ('pending','confirmed','in_progress')),0) pending,
      COALESCE(SUM(status IN ${DONE}),0) completed FROM service_bookings WHERE mechanic_id=? AND status<>'cancelled'`, [mid]);
    return res.json({ stats });
  }
  const cid = customerId(id);
  const [stats] = q(`SELECT
    (SELECT COUNT(*) FROM vehicles WHERE customer_id=?) vehicles,
    (SELECT COUNT(*) FROM service_bookings WHERE customer_id=? AND status IN ('pending','confirmed','in_progress')) active,
    (SELECT COUNT(*) FROM service_bookings WHERE customer_id=? AND status IN ${DONE}) completed,
    (SELECT COALESCE(SUM(final_cost),0) FROM service_bookings WHERE customer_id=? AND status IN ${DONE}) spent`, [cid, cid, cid, cid]);
  const recent = q(`${BOOKING_SQL} WHERE b.customer_id=? ORDER BY b.created_at DESC LIMIT 6`, [cid]);
  res.json({ stats, recent });
}));

export default r;
