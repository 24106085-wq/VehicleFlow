// Demo data for VehicleFlow. Assumes the tables exist and are EMPTY (ids 1..n are referenced below).
// Used by `npm run seed` and by the safe first-run bootstrap - both only run it on a completely empty database.
// bootstrap.js calls this inside a transaction, so it is all-or-nothing.
import bcrypt from 'bcryptjs';
import { q } from './db.js';

// Inserts several rows with the same parameterized statement (SQLite has no "VALUES ?" bulk insert).
const insertMany = (sql, rows) => rows.forEach((r) => q(sql, r));

export function insertDemoData() {
const mechs = [['Engine & Transmission', 'available'], ['Brakes & Suspension', 'busy'], ['Electrical & AC', 'available']];
const users = [
  ['Aarav Mehta', 'admin@vehicleflow.com', 'Admin@123', 'admin', '9820000001'],
  ['Vedant Mayekar', 'customer24106085@apsit.edu.in', 'Vedant@2005', 'customer', '9820000085'],
  ['Ravi Kulkarni', 'ravi@vehicleflow.com', 'Mech@1234', 'mechanic', '9820000002'],
  ['Sunil Patil', 'sunil@vehicleflow.com', 'Mech@1234', 'mechanic', '9820000003'],
  ['Imran Shaikh', 'imran@vehicleflow.com', 'Mech@1234', 'mechanic', '9820000004'],
  ['Priya Sharma', 'priya@example.com', 'Cust@1234', 'customer', '9820000011'],
  ['Rohan Desai', 'rohan@example.com', 'Cust@1234', 'customer', '9820000012'],
  ['Neha Joshi', 'neha@example.com', 'Cust@1234', 'customer', '9820000013'],
];
for (const [n, e, p, r, ph] of users) {
  const x = q('INSERT INTO users(name,email,password_hash,role,phone) VALUES(?,?,?,?,?)', [n, e, bcrypt.hashSync(p, 10), r, ph]);
  if (r === 'customer') q('INSERT INTO customers(user_id) VALUES(?)', [x.insertId]);
  if (r === 'mechanic') q('INSERT INTO mechanics(user_id,specialization,availability) VALUES(?,?,?)', [x.insertId, ...mechs.shift()]);
}

insertMany('INSERT INTO service_categories(name,description,base_price,est_hours) VALUES(?,?,?,?)', [
  ['Basic Service', 'Oil, filter and general checks', 1800, 2], ['Full Service', 'Complete inspection and fluid change', 4500, 5],
  ['Oil Change', 'Engine oil and filter replacement', 1200, 1], ['Brake Service', 'Pads, discs and brake fluid', 3200, 3],
  ['AC Repair', 'Gas refill, compressor and leak check', 3800, 4], ['Wheel Alignment', 'Alignment and balancing', 900, 1.5],
  ['Battery Replacement', 'Test and replace battery', 5500, 1], ['Engine Diagnostics', 'Scan, fault codes and road test', 2500, 2],
]);

insertMany('INSERT INTO vehicles(customer_id,make,model,year,plate,color,mileage) VALUES(?,?,?,?,?,?,?)', [
  [1, 'Maruti Suzuki', 'Swift', 2019, 'MH05AB1234', 'White', 42000], [1, 'Hyundai', 'Creta', 2021, 'MH05CD5678', 'Grey', 21000],
  [2, 'Honda', 'City', 2018, 'MH04EF9012', 'Silver', 63000], [2, 'Tata', 'Nexon', 2022, 'MH04GH3456', 'Blue', 15000],
  [3, 'Toyota', 'Innova Crysta', 2020, 'MH43JK7890', 'Black', 55000], [3, 'Mahindra', 'XUV700', 2023, 'MH43LM1122', 'Red', 8000],
]);

// [customer, vehicle, category, mechanic, day offset, status, notes]
const bookings = [
  [1, 1, 2, 1, -6, 'delivered', 'Full service due at 40,000 km'], [1, 2, 3, 2, -2, 'completed', 'Routine oil change'],
  [2, 3, 4, 2, 0, 'in_progress', 'Grinding noise when braking'], [2, 4, 6, null, 2, 'pending', 'Steering pulls to the left'],
  [3, 5, 5, 3, 0, 'in_progress', 'AC not cooling'], [3, 6, 8, null, 3, 'pending', 'Check engine light is on'],
  [1, 1, 1, 1, 1, 'confirmed', 'Regular service'], [2, 3, 7, null, 5, 'pending', 'Battery drains overnight'],
];
for (const [cu, v, cat, m, d, s, n] of bookings)
  q(`INSERT INTO service_bookings(customer_id,vehicle_id,category_id,mechanic_id,scheduled_date,status,notes,estimated_cost)
    SELECT ?,?,?,?,date('now', ? || ' days'),?,?,base_price FROM service_categories WHERE id=?`, [cu, v, cat, m, d, s, n, cat]);
q("INSERT INTO service_activity(booking_id,user_id,action) SELECT id,1,'Booking created' FROM service_bookings");
q("INSERT INTO service_activity(booking_id,user_id,action) SELECT id,1,'Status is now ' || REPLACE(status,'_',' ') FROM service_bookings WHERE status<>'pending'");
q("UPDATE service_bookings SET priority='high' WHERE id IN (3,6)");
q("UPDATE service_bookings SET priority='low' WHERE id IN (1,2,8)");
q("INSERT OR IGNORE INTO kanban_wip_limits(status,wip_limit) VALUES ('pending',0),('confirmed',3),('in_progress',2),('completed',2),('delivered',0)");
q("UPDATE service_bookings SET final_cost=estimated_cost WHERE status IN ('completed','delivered')");
q("UPDATE service_bookings SET mechanic_notes='Front pads worn out. Waiting on replacement part.' WHERE id=3");
q("INSERT INTO service_tasks(booking_id,mechanic_id,title,status) VALUES (3,2,'Inspect brake discs','done'),(3,2,'Replace front pads','blocked'),(5,3,'Leak test AC lines','in_progress')");
q("INSERT INTO notifications(user_id,message) VALUES (1,'New booking #8 received')");

// ---- Scrum demo data: a finished Sprint 0 (with a retrospective) and an active Sprint 1 ----
insertMany('INSERT INTO product_backlog(title,description,acceptance_criteria,priority,story_points,created_by) VALUES(?,?,?,?,?,?)', [
  ['As a customer, I want to track my vehicle repair status so that I know when my vehicle will be ready.', 'Customer dashboard shows the five service stages.', 'Progress updates within 20 seconds of a change', 'high', 5, 1],
  ['As an admin, I want a Kanban board so that I can see every vehicle service at a glance.', 'Five columns with drag and drop.', 'Cards can be moved and the status is saved', 'high', 8, 1],
  ['As a mechanic, I want to update repair status so that the admin and customer see my progress.', 'Start repair and Mark completed buttons.', 'Status change is visible to the admin', 'medium', 3, 1],
  ['As a customer, I want to book a service online so that I do not have to call the garage.', 'Booking form with vehicle, service and date.', 'New booking appears on the Kanban board', 'high', 3, 1],
  ['As an admin, I want WIP limits on each column so that mechanics are not overloaded.', 'Editable limit per column.', 'A warning shows when a limit is exceeded', 'medium', 2, 1],
  ['As an admin, I want a monthly revenue report so that I can plan the business.', 'Revenue grouped by month.', 'Report matches completed bookings', 'low', 5, 1],
]);
q(`INSERT INTO sprints(name,goal,start_date,end_date,capacity,status,started_at,completed_at) VALUES
  ('Sprint 0','Customers can book a service online',date('now','-21 days'),date('now','-8 days'),10,'completed',datetime('now','-21 days'),datetime('now','-8 days')),
  ('Sprint 1','Admin, mechanic and customer can follow a vehicle through all five service stages',date('now','-3 days'),date('now','+10 days'),20,'active',datetime('now','-3 days'),NULL)`);
// [sprint, story, assignee user id, status, blocked, comment, completed_at SQL]
const stasks = [
  [1, 4, 2, 'done', 0, 'Booking form finished', "datetime('now','-10 days')"],
  [2, 1, 2, 'in_progress', 0, null, 'NULL'], [2, 2, 3, 'review', 0, 'Needs a quick check of the WIP warning', 'NULL'],
  [2, 3, 4, 'done', 0, 'Done and tested', "datetime('now','-1 days')"], [2, 5, 3, 'todo', 1, 'Waiting for design approval', 'NULL'],
];
for (const [sp, st, who, status, blocked, cm, done] of stasks)
  q(`INSERT INTO sprint_tasks(sprint_id,backlog_id,title,story_points,assignee_id,status,blocked,comment,completed_at)
    SELECT ?,id,title,story_points,?,?,?,?,${done} FROM product_backlog WHERE id=?`, [sp, who, status, blocked, cm, st]);
q(`INSERT INTO daily_scrum(user_id,sprint_id,scrum_date,yesterday,today_plan,blockers) VALUES
  (2,2,date('now'),'Finished the status tracker layout','Connect tracker to the API','None'),
  (3,2,date('now'),'Built the WIP limit inputs','Test the warning messages','Waiting for design approval'),
  (4,2,date('now','-1 days'),'Mechanic job cards','Test Mark completed','None')`);
q(`INSERT INTO sprint_retrospectives(sprint_id,user_id,went_well,not_well,improve) VALUES
  (1,2,'Booking form was done early','Requirements changed twice','Confirm requirements before the sprint starts'),
  (1,1,'Good teamwork','Too many tasks at once','Keep the sprint inside the team capacity')`);
}
