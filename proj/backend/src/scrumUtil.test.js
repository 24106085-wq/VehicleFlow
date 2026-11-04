import test from 'node:test';
import assert from 'node:assert/strict';
import { isDate, buildBurndown } from './scrumUtil.js';

test('isDate accepts real dates only', () => {
  assert.equal(isDate('2026-11-03'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('03-11-2026'), false);
  assert.equal(isDate(undefined), false);
});

const tasks = [
  { story_points: 5, status: 'done', completed_at: '2026-11-02 10:00:00' },
  { story_points: 3, status: 'done', completed_at: '2026-11-03 09:00:00' },
  { story_points: 2, status: 'in_progress', completed_at: null },
];

test('burndown is calculated from task data', () => {
  const b = buildBurndown({ start: '2026-11-01', end: '2026-11-05', today: '2026-11-03', tasks });
  assert.equal(b.total, 10);
  assert.equal(b.completed, 8);
  assert.equal(b.remaining, 2);
  assert.deepEqual(b.days.map((d) => d.remaining), [10, 5, 2, null, null]);
  assert.deepEqual(b.days.map((d) => d.ideal), [10, 7.5, 5, 2.5, 0]);
});

test('burndown handles a sprint that has not started and an empty sprint', () => {
  const b = buildBurndown({ start: '2026-11-10', end: '2026-11-12', today: '2026-11-03', tasks });
  assert.ok(b.days.every((d) => d.remaining === null));
  const e = buildBurndown({ start: '2026-11-01', end: '2026-11-02', today: '2026-11-02', tasks: [] });
  assert.equal(e.total, 0);
  assert.deepEqual(e.days.map((d) => d.remaining), [0, 0]);
});

import { capacityError } from './scrumUtil.js';
test('capacity validation', () => {
  assert.equal(capacityError({ capacity: 20, planned: 12, adding: 8 }), null);
  assert.match(capacityError({ capacity: 20, planned: 12, adding: 9 }), /capacity is 20 pts/);
  assert.equal(capacityError({ capacity: 5, planned: 0, adding: 0 }), null);
});

test('burndown goes back up when a task leaves Done', () => {
  const t = [{ story_points: 5, status: 'done', completed_at: '2026-11-02 10:00:00' }, { story_points: 3, status: 'review', completed_at: null }];
  assert.equal(buildBurndown({ start: '2026-11-01', end: '2026-11-03', today: '2026-11-03', tasks: t }).remaining, 3);
  t[0] = { ...t[0], status: 'in_progress', completed_at: null };
  const b = buildBurndown({ start: '2026-11-01', end: '2026-11-03', today: '2026-11-03', tasks: t });
  assert.equal(b.remaining, 8);
  assert.deepEqual(b.days.map((d) => d.remaining), [8, 8, 8]);
});
