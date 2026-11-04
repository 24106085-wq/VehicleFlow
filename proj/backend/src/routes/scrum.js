import { Router } from 'express';
import { q, tx, marks } from '../db.js';
import { auth, allow, wrap, bad } from '../middleware.js';
import { POINTS, PRIORITIES, isDate, buildBurndown, capacityError } from '../scrumUtil.js';

// Scrum module. Team members = existing users with role admin or mechanic. Customers have no access.
// Admin: everything.  Mechanic: own sprint tasks, daily scrum, retrospective entries.
const r = Router();
r.use(auth, allow('admin', 'mechanic'));
const admin = allow('admin');
const TASK_STATUS = ['todo', 'in_progress', 'review', 'done'];
const clip = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const num = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]));
const getSprint = (id) => (q('SELECT * FROM sprints WHERE id=?', [id]))[0];
const today = () => q("SELECT date('now') d")[0].d; // UTC date, same as the booking date check

// A story is 'done' once a sprint task for it is done, 'in_sprint' while it sits in an unfinished sprint, otherwise 'open'.
const STORY_SQL = `SELECT pb.*, CASE
  WHEN EXISTS(SELECT 1 FROM sprint_tasks t WHERE t.backlog_id=pb.id AND t.status='done') THEN 'done'
  WHEN EXISTS(SELECT 1 FROM sprint_tasks t JOIN sprints s ON s.id=t.sprint_id WHERE t.backlog_id=pb.id AND s.status<>'completed') THEN 'in_sprint'
  ELSE 'open' END state,
  (SELECT s.name FROM sprint_tasks t JOIN sprints s ON s.id=t.sprint_id WHERE t.backlog_id=pb.id AND s.status='completed' AND t.status<>'done' ORDER BY s.id DESC LIMIT 1) carried_from
  FROM product_backlog pb`;
const plannedPoints = (sprintId) => Number((q('SELECT COALESCE(SUM(story_points),0) n FROM sprint_tasks WHERE sprint_id=?', [sprintId]))[0].n);

r.get('/team', wrap(async (_, res) => res.json(q("SELECT id,name,role FROM users WHERE role IN ('admin','mechanic') ORDER BY name"))));

// ---------- Product backlog (admin) ----------
function storyValues(b) {
  const title = clip(b.title, 150);
  if (title.length < 3) return { error: 'Title must be at least 3 characters' };
  const priority = b.priority || 'medium';
  if (!PRIORITIES.includes(priority)) return { error: 'Priority must be low, medium or high' };
  const points = Number(b.story_points);
  if (!POINTS.includes(points)) return { error: 'Story points must be 1, 2, 3, 5 or 8' };
  return { v: [title, clip(b.description, 2000) || null, clip(b.acceptance_criteria, 2000) || null, priority, points] };
}

r.get('/backlog', admin, wrap(async (_, res) => res.json(q(`${STORY_SQL} ORDER BY CASE pb.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, pb.id`))));

r.post('/backlog', admin, wrap(async (req, res) => {
  const { error, v } = storyValues(req.body); if (error) return bad(res, error);
  const x = q('INSERT INTO product_backlog(title,description,acceptance_criteria,priority,story_points,created_by) VALUES(?,?,?,?,?,?)', [...v, req.user.id]);
  res.status(201).json({ id: x.insertId });
}));

r.put('/backlog/:id', admin, wrap(async (req, res) => {
  if (!(q('SELECT id FROM product_backlog WHERE id=?', [req.params.id]))[0]) return res.status(404).json({ error: 'User story not found' });
  const { error, v } = storyValues(req.body); if (error) return bad(res, error);
  q('UPDATE product_backlog SET title=?,description=?,acceptance_criteria=?,priority=?,story_points=? WHERE id=?', [...v, req.params.id]);
  res.json({ ok: true });
}));

r.delete('/backlog/:id', admin, wrap(async (req, res) => {
  const s = (q(`${STORY_SQL} WHERE pb.id=?`, [req.params.id]))[0];
  if (!s) return res.status(404).json({ error: 'User story not found' });
  if (s.state === 'in_sprint') return bad(res, 'This story is in a sprint. Remove it from the sprint first');
  q('DELETE FROM product_backlog WHERE id=?', [s.id]);
  res.json({ ok: true });
}));

// ---------- Sprints ----------
function sprintValues(b, selfId = 0) {
  const name = clip(b.name, 100), goal = clip(b.goal, 500), cap = Number(b.capacity);
  if (name.length < 3) return { error: 'Sprint name must be at least 3 characters' };
  if (goal.length < 3) return { error: 'Enter a sprint goal' };
  if (!isDate(b.start_date) || !isDate(b.end_date)) return { error: 'Enter valid start and end dates' };
  if (b.end_date < b.start_date) return { error: 'End date cannot be before the start date' };
  if (!Number.isInteger(cap) || cap < 1 || cap > 999) return { error: 'Capacity must be a whole number of story points (1 to 999)' };
  const clash = (q("SELECT name FROM sprints WHERE status<>'completed' AND id<>? AND start_date<=? AND end_date>=?", [selfId, b.end_date, b.start_date]))[0];
  if (clash) return { error: `These dates overlap with sprint "${clash.name}"` };
  return { v: [name, goal, b.start_date, b.end_date, cap] };
}

r.get('/sprints', wrap(async (_, res) => res.json(q(`SELECT s.*,
  (SELECT COUNT(*) FROM sprint_tasks t WHERE t.sprint_id=s.id) tasks,
  (SELECT COALESCE(SUM(story_points),0) FROM sprint_tasks t WHERE t.sprint_id=s.id) points
  FROM sprints s ORDER BY CASE s.status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END, s.start_date DESC, s.id DESC`))));

r.post('/sprints', admin, wrap(async (req, res) => {
  const { error, v } = sprintValues(req.body); if (error) return bad(res, error);
  const x = q('INSERT INTO sprints(name,goal,start_date,end_date,capacity) VALUES(?,?,?,?,?)', v);
  res.status(201).json({ id: x.insertId });
}));

r.put('/sprints/:id', admin, wrap(async (req, res) => {
  const s = getSprint(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sprint not found' });
  if (s.status === 'completed') return bad(res, 'A completed sprint cannot be edited');
  const { error, v } = sprintValues(req.body, s.id); if (error) return bad(res, error);
  const planned = plannedPoints(s.id);
  if (v[4] < planned) return bad(res, `Capacity cannot be lower than the ${planned} story points already planned in this sprint`);
  q('UPDATE sprints SET name=?,goal=?,start_date=?,end_date=?,capacity=? WHERE id=?', [...v, s.id]);
  res.json({ ok: true });
}));

r.post('/sprints/:id/start', admin, wrap(async (req, res) => {
  const s = getSprint(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sprint not found' });
  if (s.status !== 'planned') return bad(res, 'Only a planned sprint can be started');
  const other = (q("SELECT name FROM sprints WHERE status='active' LIMIT 1"))[0];
  if (other) return bad(res, `Sprint "${other.name}" is already active. Complete it before starting another`);
  if (!(q('SELECT COUNT(*) n FROM sprint_tasks WHERE sprint_id=?', [s.id]))[0].n) return bad(res, 'Add at least one user story to the sprint before starting it');
  q("UPDATE sprints SET status='active', started_at=datetime('now') WHERE id=?", [s.id]);
  res.json({ ok: true });
}));

r.post('/sprints/:id/complete', admin, wrap(async (req, res) => {
  const s = getSprint(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sprint not found' });
  if (s.status !== 'active') return bad(res, 'Only an active sprint can be completed');
  q("UPDATE sprints SET status='completed', completed_at=datetime('now') WHERE id=?", [s.id]);
  res.json({ ok: true }); // unfinished stories automatically return to the open backlog
}));

// ---------- Sprint tasks ----------
r.get('/sprints/:id/tasks', wrap(async (req, res) => {
  const mine = req.user.role === 'mechanic';
  res.json(q(`SELECT t.*, u.name assignee FROM sprint_tasks t LEFT JOIN users u ON u.id=t.assignee_id
    WHERE t.sprint_id=? ${mine ? 'AND t.assignee_id=?' : ''} ORDER BY t.id`, mine ? [req.params.id, req.user.id] : [req.params.id]));
}));

r.post('/sprints/:id/tasks', admin, wrap(async (req, res) => {
  const s = getSprint(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sprint not found' });
  if (s.status === 'completed') return bad(res, 'A completed sprint cannot be changed');
  const ids = [...new Set((Array.isArray(req.body.backlog_ids) ? req.body.backlog_ids : []).map(Number))].filter(Boolean);
  if (!ids.length) return bad(res, 'Select at least one user story');
  const rows = q(`${STORY_SQL} WHERE pb.id IN (${marks(ids)})`, ids);
  if (rows.length !== ids.length) return bad(res, 'A selected story no longer exists');
  const taken = rows.find((x) => x.state !== 'open');
  if (taken) return bad(res, `"${taken.title}" is already in a sprint or finished`);
  const full = capacityError({ capacity: s.capacity, planned: plannedPoints(s.id), adding: rows.reduce((a, x) => a + x.story_points, 0) });
  if (full) return bad(res, full);
  tx(() => { for (const x of rows) q('INSERT INTO sprint_tasks(sprint_id,backlog_id,title,story_points) VALUES(?,?,?,?)', [s.id, x.id, x.title, x.story_points]); });
  res.status(201).json({ added: rows.length });
}));

r.patch('/tasks/:id', wrap(async (req, res) => {
  const t = (q('SELECT t.*, s.status sprint_status FROM sprint_tasks t JOIN sprints s ON s.id=t.sprint_id WHERE t.id=?', [req.params.id]))[0];
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role === 'mechanic' && t.assignee_id !== req.user.id) return res.status(403).json({ error: 'This task is not assigned to you' });
  if (t.sprint_status === 'completed') return bad(res, 'This sprint is completed, so its tasks are locked');
  const i = req.body, set = {};
  if (req.user.role === 'admin' && i.assignee_id !== undefined) {
    if (i.assignee_id && !(q("SELECT id FROM users WHERE id=? AND role IN ('admin','mechanic')", [i.assignee_id]))[0]) return bad(res, 'Team member not found');
    set.assignee_id = i.assignee_id || null;
  }
  if (i.status !== undefined) {
    if (!TASK_STATUS.includes(i.status)) return bad(res, 'Invalid task status');
    if (t.sprint_status !== 'active') return bad(res, 'Start the sprint before moving its tasks');
    set.status = i.status;
    if (i.status === 'done') set.blocked = 0;
  }
  if (i.blocked !== undefined && set.blocked === undefined) set.blocked = i.blocked ? 1 : 0;
  if (i.comment !== undefined) set.comment = clip(i.comment, 300) || null;
  const keys = Object.keys(set);
  if (!keys.length) return bad(res, 'Nothing to update');
  tx(() => {
    q(`UPDATE sprint_tasks SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`, [...keys.map((k) => set[k]), t.id]);
    // completed_at drives the burndown chart: set when a task reaches Done, cleared if it moves back.
    if (set.status) q("UPDATE sprint_tasks SET completed_at = CASE WHEN status='done' THEN COALESCE(completed_at, datetime('now')) ELSE NULL END WHERE id=?", [t.id]);
  });
  res.json({ ok: true });
}));

r.delete('/tasks/:id', admin, wrap(async (req, res) => {
  const t = (q('SELECT t.id, s.status sprint_status FROM sprint_tasks t JOIN sprints s ON s.id=t.sprint_id WHERE t.id=?', [req.params.id]))[0];
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (t.sprint_status === 'completed') return bad(res, 'A completed sprint cannot be changed');
  q('DELETE FROM sprint_tasks WHERE id=?', [t.id]);
  res.json({ ok: true });
}));

// ---------- Dashboard and burndown (admin) ----------
r.get('/dashboard', admin, wrap(async (_, res) => {
  const history = (q(`SELECT s.id, s.name, s.start_date, s.end_date, s.completed_at,
    (SELECT COUNT(*) FROM sprint_tasks t WHERE t.sprint_id=s.id) tasks,
    (SELECT COUNT(*) FROM sprint_tasks t WHERE t.sprint_id=s.id AND t.status='done') done,
    (SELECT COALESCE(SUM(story_points),0) FROM sprint_tasks t WHERE t.sprint_id=s.id) points,
    (SELECT COALESCE(SUM(story_points),0) FROM sprint_tasks t WHERE t.sprint_id=s.id AND t.status='done') donePoints
    FROM sprints s WHERE s.status='completed' ORDER BY s.completed_at DESC, s.id DESC LIMIT 5`)).map((h) => ({ ...h, ...num({ tasks: h.tasks, done: h.done, points: h.points, donePoints: h.donePoints }) }));
  const sprint = (q("SELECT * FROM sprints WHERE status='active' LIMIT 1"))[0];
  if (!sprint) return res.json({ sprint: null, history });
  const [c] = q(`SELECT COUNT(*) total,
    COALESCE(SUM(status='done'),0) done, COALESCE(SUM(status='todo'),0) pending,
    COALESCE(SUM(status IN ('in_progress','review')),0) inProgress, COALESCE(SUM(blocked=1),0) blocked,
    COALESCE(SUM(story_points),0) points, COALESCE(SUM(CASE WHEN status='done' THEN story_points ELSE 0 END),0) donePoints
    FROM sprint_tasks WHERE sprint_id=?`, [sprint.id]);
  const stats = num(c);
  stats.percent = stats.points ? Math.round((stats.donePoints / stats.points) * 100) : 0;
  res.json({ sprint, stats, history });
}));

r.get('/sprints/:id/burndown', admin, wrap(async (req, res) => {
  const s = getSprint(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sprint not found' });
  const tasks = q('SELECT story_points, status, completed_at FROM sprint_tasks WHERE sprint_id=?', [s.id]);
  res.json(buildBurndown({ start: s.start_date, end: s.end_date, today: today(), tasks }));
}));

// ---------- Daily Scrum ----------
r.get('/daily', wrap(async (req, res) => {
  const where = [], p = [];
  if (req.user.role === 'mechanic') { where.push('d.user_id=?'); p.push(req.user.id); }
  else if (req.query.user_id) { where.push('d.user_id=?'); p.push(Number(req.query.user_id) || 0); }
  if (req.query.date) { if (!isDate(req.query.date)) return bad(res, 'Invalid date'); where.push('d.scrum_date=?'); p.push(req.query.date); }
  res.json(q(`SELECT d.*, u.name FROM daily_scrum d JOIN users u ON u.id=d.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY d.scrum_date DESC, u.name LIMIT 200`, p));
}));

// One entry per person per day; submitting again on the same day updates it.
r.post('/daily', wrap(async (req, res) => {
  const y = clip(req.body.yesterday), t = clip(req.body.today_plan), bl = clip(req.body.blockers) || 'None';
  if (y.length < 2 || t.length < 2) return bad(res, 'Please answer what you completed yesterday and what you will do today');
  const sprint = (q("SELECT id FROM sprints WHERE status='active' LIMIT 1"))[0];
  q(`INSERT INTO daily_scrum(user_id,sprint_id,scrum_date,yesterday,today_plan,blockers) VALUES(?,?,date('now'),?,?,?)
    ON CONFLICT(user_id,scrum_date) DO UPDATE SET sprint_id=excluded.sprint_id, yesterday=excluded.yesterday, today_plan=excluded.today_plan, blockers=excluded.blockers`,
    [req.user.id, sprint?.id ?? null, y, t, bl]);
  res.status(201).json({ ok: true });
}));

// ---------- Retrospective ----------
r.get('/retros', wrap(async (req, res) => {
  if (!Number(req.query.sprint_id)) return bad(res, 'sprint_id is required');
  res.json(q(`SELECT r.*, u.name FROM sprint_retrospectives r JOIN users u ON u.id=r.user_id WHERE r.sprint_id=? ORDER BY r.id`, [req.query.sprint_id]));
}));

r.post('/retros', wrap(async (req, res) => {
  const s = getSprint(req.body.sprint_id);
  if (!s) return bad(res, 'Choose a sprint');
  if (s.status !== 'completed') return bad(res, 'A retrospective can only be recorded after the sprint is completed');
  const a = clip(req.body.went_well), b = clip(req.body.not_well), c = clip(req.body.improve);
  if (!a || !b || !c) return bad(res, 'Please answer all three questions');
  q(`INSERT INTO sprint_retrospectives(sprint_id,user_id,went_well,not_well,improve) VALUES(?,?,?,?,?)
    ON CONFLICT(sprint_id,user_id) DO UPDATE SET went_well=excluded.went_well, not_well=excluded.not_well, improve=excluded.improve`, [s.id, req.user.id, a, b, c]);
  res.status(201).json({ ok: true });
}));

// Turns a retrospective "what should be improved" answer into a Product Backlog item.
r.post('/retros/:id/improvement', admin, wrap(async (req, res) => {
  const x = (q(`SELECT r.*, u.name, s.name sprint FROM sprint_retrospectives r JOIN users u ON u.id=r.user_id JOIN sprints s ON s.id=r.sprint_id WHERE r.id=?`, [req.params.id]))[0];
  if (!x) return res.status(404).json({ error: 'Retrospective entry not found' });
  if (x.improvement_id) return bad(res, 'An improvement task was already created from this feedback');
  // the new backlog item and the link back to the retrospective are saved together
  const id = tx(() => {
    const ins = q('INSERT INTO product_backlog(title,description,acceptance_criteria,priority,story_points,created_by) VALUES(?,?,?,?,?,?)',
      [`Improve: ${x.improve}`.slice(0, 150), `From the retrospective of "${x.sprint}" (${x.name}). What did not go well: ${x.not_well}`.slice(0, 2000), null, 'medium', 2, req.user.id]);
    q('UPDATE sprint_retrospectives SET improvement_id=? WHERE id=?', [ins.insertId, x.id]);
    return ins.insertId;
  });
  res.status(201).json({ id });
}));

export default r;
