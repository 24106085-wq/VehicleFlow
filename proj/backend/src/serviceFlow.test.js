import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTransition } from './serviceFlow.js';

test('moving one stage forward or back is allowed', () => {
  for (const [a, b] of [['pending', 'confirmed'], ['confirmed', 'in_progress'], ['in_progress', 'completed'], ['completed', 'delivered'], ['completed', 'in_progress'], ['delivered', 'completed']])
    assert.equal(checkTransition(a, b), null, `${a} -> ${b}`);
});
test('skipping stages is rejected', () => {
  assert.match(checkTransition('pending', 'delivered'), /Booking to Delivered/);
  assert.match(checkTransition('pending', 'in_progress'), /one stage at a time/);
  assert.match(checkTransition('confirmed', 'completed'), /one stage at a time/);
  assert.ok(checkTransition('in_progress', 'delivered'));
});
test('cancelled and delivered bookings are protected', () => {
  assert.equal(checkTransition('pending', 'cancelled'), null);
  assert.ok(checkTransition('delivered', 'cancelled'));
  assert.ok(checkTransition('cancelled', 'pending'));
});
