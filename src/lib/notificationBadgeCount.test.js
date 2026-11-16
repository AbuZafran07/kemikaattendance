import { test, expect } from 'bun:test';
import { notificationBadgeTotal } from './notificationBadgeCount';

test('badge adds three employee attendance notices to existing request counts', () => {
  expect(notificationBadgeTotal([2, 1, 4, 3])).toBe(10);
  expect(notificationBadgeTotal([2, 1, 4, 0])).toBe(7);
});
test('badge clears when all notifications have been seen', () => {
  expect(notificationBadgeTotal([0, 0, 0, 0])).toBe(0);
  expect(notificationBadgeTotal([null, undefined, 0, 2])).toBe(2);
});