/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unit tests for security and validation logic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRandomPin, validateNisn, validatePin, hashPin, verifyPin } from './security.ts';

test('generateRandomPin produces 6-character strings without confusing chars', () => {
  const pin1 = generateRandomPin();
  const pin2 = generateRandomPin();
  assert.equal(pin1.length, 6);
  assert.equal(pin2.length, 6);
  assert.equal(typeof pin1, 'string');
  // Must not contain 0, O, 1, I, L
  assert.equal(/[0O1IL]/.test(pin1), false);
  assert.equal(/[0O1IL]/.test(pin2), false);
});

test('validateNisn correctly checks 10-digit requirements', () => {
  assert.equal(validateNisn('0081234567').isValid, true);
  assert.equal(validateNisn('1234567890').isValid, true);
  // Invalid cases
  assert.equal(validateNisn('12345').isValid, false);
  assert.equal(validateNisn('0081234567A').isValid, false);
  assert.equal(validateNisn('').isValid, false);
  assert.equal(validateNisn('          ').isValid, false);
});

test('validatePin checks 6-character alphanumeric format', () => {
  assert.equal(validatePin('A7B9X2').isValid, true);
  assert.equal(validatePin('a7b9x2').isValid, true); // Should normalize case
  assert.equal(validatePin('12345').isValid, false);
  assert.equal(validatePin('1234567').isValid, false);
  assert.equal(validatePin('A-B!C?').isValid, false);
});

test('hashPin and verifyPin behave deterministically', () => {
  const pin = 'A7B9X2';
  const hash = hashPin(pin);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.startsWith('sha256_'), true);

  // Verification matching
  assert.equal(verifyPin('A7B9X2', hash), true);
  assert.equal(verifyPin('a7b9x2', hash), true); // Case-insensitive input
  assert.equal(verifyPin('WRONG1', hash), false);
});
