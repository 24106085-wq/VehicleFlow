// Small helpers shared by the Product Backlog and Service Request Details pages.
export const problemId = (id) => `P-${String(id).padStart(3, '0')}`;
export const COLUMN_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
export const statusLabel = (r) => (r.column ? COLUMN_LABEL[r.column] : 'Cancelled');
export const statusBadge = (r) => (r.column ? { todo: 'todo', in_progress: 'in_progress', done: 'done' }[r.column] : 'cancelled');
export const fmtDateTime = (s) => (s ? new Date(String(s).replace(' ', 'T') + (/[TZ]/.test(String(s)) ? '' : 'Z')).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
