// Pure helpers for the Scrum module (no database), so they are easy to test.
export const POINTS = [1, 2, 3, 5, 8];
export const PRIORITIES = ['low', 'medium', 'high'];

export const isDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

const addDay = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sum = (rows) => rows.reduce((a, t) => a + Number(t.story_points || 0), 0);

// Burndown from real task data. Dates are 'YYYY-MM-DD' strings.
//  total     = story points of all sprint tasks
//  ideal     = straight line from total (first day) to 0 (last day)
//  remaining = total - points of tasks whose completed_at is on or before that day (null for future days)
export function buildBurndown({ start, end, today, tasks }) {
  const total = sum(tasks), done = tasks.filter((t) => t.status === 'done'), completed = sum(done);
  const dates = [];
  for (let d = start; d <= end && dates.length < 120; d = addDay(d, 1)) dates.push(d);
  const n = dates.length;
  const days = dates.map((date, i) => ({
    date,
    ideal: Math.round((n > 1 ? total * (1 - i / (n - 1)) : 0) * 10) / 10,
    remaining: date <= today ? total - sum(done.filter((t) => String(t.completed_at || '').slice(0, 10) <= date)) : null,
  }));
  return { total, completed, remaining: total - completed, days };
}

// Sprint capacity rule used by the API: planned + new story points must not exceed capacity.
export function capacityError({ capacity, planned, adding }) {
  if (planned + adding <= capacity) return null;
  return `Sprint capacity exceeded: ${planned} pts already planned + ${adding} pts selected = ${planned + adding} pts, but the capacity is ${capacity} pts. Select fewer stories or raise the capacity.`;
}
