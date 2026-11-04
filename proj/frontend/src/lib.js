// Customer-facing problem helpers shared by the report and tracking pages.
export const PROBLEM_CATEGORIES = ['Engine', 'Brakes', 'AC', 'Battery', 'Tyres', 'Electrical', 'General Service'];
// Booking status (backend) -> the three customer-facing groups.
export const GROUP_OF = { pending: 'todo', confirmed: 'todo', in_progress: 'progress', completed: 'done', delivered: 'done', cancelled: 'cancelled' };
export const GROUP_LABEL = { todo: 'To Do', progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' };
export const GROUP_BADGE = { todo: 'todo', progress: 'in_progress', done: 'done', cancelled: 'cancelled' };
export const fmtDate = (s) => (s ? new Date(String(s).replace(' ', 'T') + (String(s).includes('T') || String(s).includes('Z') ? '' : 'Z')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
