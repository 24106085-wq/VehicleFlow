// Vehicle-service workflow rules (pure functions, no database).
// Kanban stage = booking status: Booking -> Inspection -> Repairing -> Quality Check -> Delivered.
export const STAGES = ['pending', 'confirmed', 'in_progress', 'completed', 'delivered'];
export const STAGE_TITLE = { pending: 'Booking', confirmed: 'Inspection', in_progress: 'Repairing', completed: 'Quality Check', delivered: 'Delivered', cancelled: 'Cancelled' };

// Returns an error message when a move is not allowed, otherwise null.
// Rules: one stage forward or one stage back; no skipping stages; cancelled bookings are closed; delivered ones cannot be cancelled.
export function checkTransition(from, to) {
  if (from === to) return null;
  if (from === 'cancelled') return 'A cancelled booking cannot be moved';
  if (to === 'cancelled') return from === 'delivered' ? 'A delivered booking cannot be cancelled' : null;
  const a = STAGES.indexOf(from), b = STAGES.indexOf(to);
  if (a < 0 || b < 0) return 'Invalid status';
  if (Math.abs(a - b) !== 1) return `A booking cannot move directly from ${STAGE_TITLE[from]} to ${STAGE_TITLE[to]}. Move it one stage at a time`;
  return null;
}
