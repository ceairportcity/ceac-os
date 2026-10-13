import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedHrRequestScope } from '../src/lib/protectedHrRequestScope.js';

test('late protected summary for employee A cannot become employee B detail', () => {
  const scope = createProtectedHrRequestScope();
  scope.select('employee-A');
  const first = scope.begin('employee-A');
  scope.select('employee-B');
  const second = scope.begin('employee-B');
  assert.equal(scope.matches(first), false);
  assert.equal(scope.matches(second), true);
});

test('a newer reload invalidates the earlier summary for the same employee', () => {
  const scope = createProtectedHrRequestScope();
  scope.select('employee-A');
  const earlier = scope.begin('employee-A');
  const latest = scope.begin('employee-A');
  assert.equal(scope.matches(earlier), false);
  assert.equal(scope.matches(latest), true);
});

test('late signed-document URL is rejected after an employee switch', () => {
  const scope = createProtectedHrRequestScope();
  scope.select('employee-A');
  const signedLink = scope.snapshot();
  assert.equal(scope.matches(signedLink), true);
  scope.select('employee-B');
  assert.equal(scope.matches(signedLink), false);
});

test('an old employee refresh cannot begin under a newly selected employee', () => {
  const scope = createProtectedHrRequestScope();
  scope.select('employee-B');
  assert.equal(scope.begin('employee-A'), null);
  assert.equal(scope.begin('employee-B')?.employeeId, 'employee-B');
});

test('clearing selection invalidates pending private data', () => {
  const scope = createProtectedHrRequestScope();
  scope.select('employee-A');
  const pending = scope.begin('employee-A');
  scope.select(null);
  assert.equal(scope.matches(pending), false);
  assert.equal(scope.begin('employee-A'), null);
});
