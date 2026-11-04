import test from 'node:test';
import assert from 'node:assert/strict';
import { columnOf, statusFor, statsOf } from './serviceBoard.js';

test('booking statuses map to exactly three columns', () => {
  assert.equal(columnOf('pending'), 'todo');
  assert.equal(columnOf('confirmed'), 'todo');
  assert.equal(columnOf('in_progress'), 'in_progress');
  assert.equal(columnOf('completed'), 'done');
  assert.equal(columnOf('delivered'), 'done');
  assert.equal(columnOf('cancelled'), null);
});
test('moving to a column picks the right booking status', () => {
  assert.equal(statusFor('pending', 'in_progress'), 'in_progress');
  assert.equal(statusFor('in_progress', 'done'), 'completed');
  assert.equal(statusFor('completed', 'todo'), 'pending');
  assert.equal(statusFor('confirmed', 'todo'), 'confirmed'); // same group: exact status kept
  assert.equal(statusFor('delivered', 'done'), 'delivered');
  assert.equal(statusFor('pending', 'bogus'), null);
});
test('statistics count only board tasks', () => {
  const s = statsOf([{ status: 'pending' }, { status: 'confirmed' }, { status: 'in_progress' }, { status: 'delivered' }, { status: 'cancelled' }]);
  assert.deepEqual(s, { total: 4, todo: 2, in_progress: 1, done: 1 });
});
