import { test, expect } from 'bun:test';
import { selectedPendingIds, approveSelectedLateReasons } from './lateReasonApprovalSelection';

test('bulk approval includes only selected pending requests, once each', () => {
  expect(selectedPendingIds([
    { id: 'a', status: 'pending' }, { id: 'b', status: 'approved' },
    { id: 'c', status: 'rejected' }, { id: 'd', status: 'pending' },
  ], ['a', 'a', 'b', 'c', 'missing'])).toEqual(['a']);
});

test('bulk approval invokes the existing decision once per selected request', async () => {
  const calls = [];
  const result = await approveSelectedLateReasons(['a', 'b', 'a'], async id => {
    calls.push(id);
    return { error: null };
  });
  expect(calls).toEqual(['a', 'b']);
  expect(result).toEqual({ approved: ['a', 'b'], failed: [] });
});

test('partial failure retains failed requests without retrying successful decisions', async () => {
  const result = await approveSelectedLateReasons(['a', 'b', 'c'], async id => {
    if (id === 'c') throw new Error('network failure');
    return { error: id === 'b' ? new Error('already decided') : null };
  });
  expect(result).toEqual({ approved: ['a'], failed: ['b', 'c'] });
});