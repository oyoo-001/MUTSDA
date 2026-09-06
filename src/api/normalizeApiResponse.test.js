import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiListResponse } from './normalizeApiResponse.js';

test('normalizes array payloads', () => {
  const payload = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(normalizeApiListResponse(payload), payload);
});

test('unwraps axios-style payload objects', () => {
  const payload = { data: [{ id: 3 }] };
  assert.deepEqual(normalizeApiListResponse(payload), [{ id: 3 }]);
});

test('falls back to an empty array for nullish or unexpected values', () => {
  assert.deepEqual(normalizeApiListResponse(null), []);
  assert.deepEqual(normalizeApiListResponse({ ok: true }), []);
});
