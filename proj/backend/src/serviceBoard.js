// Admin service board rules (pure functions, no database).
// The board has exactly three columns. Each one groups the existing booking statuses, so no new column is needed in SQLite.
//   To Do = pending, confirmed   In Progress = in_progress   Done = completed, delivered   (cancelled bookings are not shown)
export const COLUMNS = ['todo', 'in_progress', 'done'];
export const COLUMN_TITLE = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const OF = { pending: 'todo', confirmed: 'todo', in_progress: 'in_progress', completed: 'done', delivered: 'done' };
export const columnOf = (status) => OF[status] || null;

// Booking status to save when a task is moved to a column. Moving inside the same group keeps the exact status.
export function statusFor(current, column) {
  if (!COLUMNS.includes(column)) return null;
  if (columnOf(current) === column) return current;
  return { todo: 'pending', in_progress: 'in_progress', done: 'completed' }[column];
}

export function statsOf(rows) {
  const s = { total: 0, todo: 0, in_progress: 0, done: 0 };
  for (const r of rows) { const c = columnOf(r.status); if (c) { s[c]++; s.total++; } }
  return s;
}
