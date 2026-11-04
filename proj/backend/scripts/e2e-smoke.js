// End-to-end smoke test for a RUNNING VehicleFlow API. Needs Node 18+ (built-in fetch).
//   Docker:  docker compose exec backend node scripts/e2e-smoke.js
//   Local:   API_URL=http://127.0.0.1:5000 node scripts/e2e-smoke.js
// It only ADDS test records (a new customer, one vehicle, one booking, one story, one future sprint). It deletes nothing.
// Needs the demo logins (SEED_DEMO_DATA=true on first start) or ADMIN_EMAIL/ADMIN_PASSWORD/MECH_EMAIL/MECH_PASSWORD.
const API = process.env.API_URL || 'http://127.0.0.1:5000';
const ADMIN = [process.env.ADMIN_EMAIL || 'admin@vehicleflow.com', process.env.ADMIN_PASSWORD || 'Admin@123'];
const MECH = [process.env.MECH_EMAIL || 'ravi@vehicleflow.com', process.env.MECH_PASSWORD || 'Mech@1234'];
const tag = Date.now().toString().slice(-8);
let pass = 0, fail = 0, skip = 0;

async function call(token, method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
function check(name, ok, extra = '') { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`); return ok; }
const note = (m) => { skip++; console.log(`SKIP  ${m}`); };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const must = (r, code = 200) => r.status === code;

console.log(`Testing ${API}\n`);
let r = await call(null, 'GET', '/health');
check('GET /health (app + database)', must(r) && r.data.db === 'connected', JSON.stringify(r));

// ---- Service workflow ----
r = await call(null, 'POST', '/api/auth/register', { name: 'Smoke Customer', email: `smoke${tag}@example.com`, password: 'Smoke1234', phone: '9800000000' });
check('1. Customer registers + gets a token', must(r, 201) && r.data.token, JSON.stringify(r));
r = await call(null, 'POST', '/api/auth/login', { email: `smoke${tag}@example.com`, password: 'Smoke1234' });
check('1. Customer login', must(r) && r.data.user?.role === 'customer', JSON.stringify(r));
const custTok = r.data.token;

r = await call(custTok, 'POST', '/api/vehicles', { make: 'Test', model: 'Smoke', year: 2022, plate: `ZZ${tag}`, color: 'Grey', mileage: 1000 });
check('2. Vehicle registration', must(r, 201), JSON.stringify(r));
const vehicleId = r.data.id;
r = await call(custTok, 'GET', '/api/categories');
const categoryId = r.data[0]?.id;
check('   service categories load', Array.isArray(r.data) && categoryId, JSON.stringify(r));

r = await call(custTok, 'POST', '/api/bookings', { vehicle_id: vehicleId, category_id: categoryId, scheduled_date: day(1), notes: '[smoke-test] booking' });
check('3. Service booking', must(r, 201), JSON.stringify(r));
const bookingId = r.data.id;

r = await call(null, 'POST', '/api/auth/login', { email: ADMIN[0], password: ADMIN[1] });
check('   Admin login', must(r) && r.data.user?.role === 'admin', JSON.stringify(r));
const admin = r.data.token;
r = await call(null, 'POST', '/api/auth/login', { email: MECH[0], password: MECH[1] });
check('   Mechanic login', must(r) && r.data.user?.role === 'mechanic', JSON.stringify(r));
const mech = r.data.token, mechUserName = r.data.user?.name;

r = await call(admin, 'GET', '/api/bookings');
let card = Array.isArray(r.data) && r.data.find((b) => b.id === bookingId);
check('4. Booking appears on Admin Kanban (column: Booking/pending)', card && card.status === 'pending', JSON.stringify(card));

r = await call(admin, 'GET', '/api/mechanics');
const m = (r.data || []).find((x) => x.name === mechUserName);
check('   mechanics list contains the test mechanic', !!m, JSON.stringify(r.data));
r = await call(admin, 'PATCH', `/api/bookings/${bookingId}`, { mechanic_id: m?.id });
check('5. Admin assigns mechanic (moves to Inspection/confirmed)', must(r), JSON.stringify(r));
r = await call(mech, 'PATCH', `/api/bookings/${bookingId}`, { status: 'in_progress' });
check('6. Mechanic starts repair (Repairing)', must(r), JSON.stringify(r));
r = await call(mech, 'PATCH', `/api/bookings/${bookingId}`, { status: 'completed', mechanic_notes: '[smoke-test] done' });
check('7. Mechanic marks completed (Quality Check)', must(r), JSON.stringify(r));
r = await call(admin, 'PATCH', `/api/bookings/${bookingId}`, { status: 'delivered' });
check('8. Admin marks Delivered', must(r), JSON.stringify(r));
r = await call(custTok, 'GET', '/api/bookings');
card = (r.data || []).find((b) => b.id === bookingId);
check('9. Customer sees status = delivered', card?.status === 'delivered' && card.mechanic === mechUserName, JSON.stringify(card));
r = await call(admin, 'PATCH', `/api/bookings/${bookingId}`, { status: 'pending' });
check('   Rule: Delivered cannot skip back to Booking (400)', r.status === 400, JSON.stringify(r));
r = await call(custTok, 'GET', '/api/scrum/team');
check('   Role rule: customer cannot use Scrum API (403)', r.status === 403, JSON.stringify(r));
r = await call(admin, 'GET', '/api/board/wip-limits');
check('   Kanban WIP limits readable', must(r) && 'in_progress' in r.data, JSON.stringify(r));

// ---- Scrum module ----
r = await call(admin, 'POST', '/api/scrum/backlog', { title: `[smoke-test] story ${tag}`, description: 'x', acceptance_criteria: 'y', priority: 'medium', story_points: 5 });
check('S1. Product Backlog: add story', must(r, 201), JSON.stringify(r));
const storyId = r.data.id;
r = await call(admin, 'GET', '/api/scrum/backlog');
check('S1. Product Backlog: story listed', (r.data || []).some((s) => s.id === storyId), JSON.stringify(r).slice(0, 200));

const sprintFrom = day(60);
r = await call(admin, 'POST', '/api/scrum/sprints', { name: `Smoke ${tag}`, goal: 'Smoke test sprint', start_date: sprintFrom, end_date: day(74), capacity: 5 });
check('S2. Sprint Planning: create sprint (capacity 5)', must(r, 201), JSON.stringify(r));
const sprintId = r.data.id;
r = await call(admin, 'POST', '/api/scrum/backlog', { title: `[smoke-test] big story ${tag}`, priority: 'low', story_points: 8 });
const bigId = r.data.id;
r = await call(admin, 'POST', `/api/scrum/sprints/${sprintId}/tasks`, { backlog_ids: [bigId] });
check('S2. Sprint Planning: story over capacity is rejected (400)', r.status === 400, JSON.stringify(r));
r = await call(admin, 'POST', `/api/scrum/sprints/${sprintId}/tasks`, { backlog_ids: [storyId] });
check('S2. Sprint Planning: add story within capacity', must(r, 201), JSON.stringify(r));

r = await call(admin, 'GET', '/api/scrum/sprints');
const active = (r.data || []).find((s) => s.status === 'active');
if (active) {
  note(`Sprint "${active.name}" is already active (demo data), so this test does NOT start/complete a sprint. Testing board, daily scrum, burndown and retrospective on existing sprints instead.`);
  r = await call(admin, 'GET', `/api/scrum/sprints/${active.id}/tasks`);
  check('S3. Sprint Board: active sprint tasks load', must(r) && Array.isArray(r.data) && r.data.length > 0, JSON.stringify(r).slice(0, 200));
  const t = r.data?.[0];
  r = await call(admin, 'PATCH', `/api/scrum/tasks/${t?.id}`, { comment: `[smoke-test] ${tag}` });
  check('S3. Sprint Board: update a task (comment)', must(r), JSON.stringify(r));
  r = await call(admin, 'GET', `/api/scrum/sprints/${active.id}/burndown`);
  check('S5. Burndown: data returned', must(r) && r.data.days?.length > 0 && typeof r.data.total === 'number', JSON.stringify(r).slice(0, 200));
} else {
  r = await call(admin, 'POST', `/api/scrum/sprints/${sprintId}/start`);
  check('S3. Sprint Board: start sprint', must(r), JSON.stringify(r));
  r = await call(admin, 'GET', `/api/scrum/sprints/${sprintId}/tasks`);
  const t = r.data?.[0];
  for (const st of ['in_progress', 'review', 'done']) {
    r = await call(admin, 'PATCH', `/api/scrum/tasks/${t?.id}`, { status: st });
    check(`S3. Sprint Board: move task to ${st}`, must(r), JSON.stringify(r));
  }
  r = await call(admin, 'GET', `/api/scrum/sprints/${sprintId}/burndown`);
  check('S5. Burndown: data returned', must(r) && r.data.days?.length > 0 && r.data.total === 5, JSON.stringify(r).slice(0, 200));
  r = await call(admin, 'POST', `/api/scrum/sprints/${sprintId}/complete`);
  check('S3. Complete sprint', must(r), JSON.stringify(r));
}
r = await call(admin, 'POST', '/api/scrum/daily', { yesterday: 'Smoke test setup', today_plan: 'Run smoke test', blockers: 'None' });
check('S4. Daily Scrum: submit entry', must(r, 201), JSON.stringify(r));
r = await call(admin, 'GET', `/api/scrum/daily?date=${day(0)}`);
check('S4. Daily Scrum: entry listed', must(r) && Array.isArray(r.data) && r.data.length > 0, JSON.stringify(r).slice(0, 200));
const done = (await call(admin, 'GET', '/api/scrum/sprints')).data.find((s) => s.status === 'completed');
if (done) {
  r = await call(admin, 'POST', '/api/scrum/retros', { sprint_id: done.id, went_well: 'Smoke test ok', not_well: 'Nothing', improve: 'Keep testing' });
  check('S6. Retrospective: save entry on completed sprint', must(r, 201), JSON.stringify(r));
  r = await call(admin, 'GET', `/api/scrum/retros?sprint_id=${done.id}`);
  check('S6. Retrospective: entries listed', must(r) && r.data.length > 0, JSON.stringify(r).slice(0, 200));
} else note('No completed sprint exists, retrospective not tested.');
r = await call(admin, 'GET', '/api/scrum/dashboard');
check('   Scrum dashboard loads', must(r) && 'history' in r.data, JSON.stringify(r).slice(0, 200));

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped notes`);
process.exit(fail ? 1 : 0);
