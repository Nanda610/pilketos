/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unit tests for ElectionStore logic: multi-period invariant & atomic anonymous voting
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectionStore } from './store.ts';

test('Multi-period invariant: exactly one period is active', () => {
  const store = new ElectionStore();
  const periods = store.getPeriods();
  const activePeriods = periods.filter((p) => p.status === 'active');
  assert.equal(activePeriods.length, 1);

  // Switch to another period
  const pastPeriod = periods.find((p) => p.status !== 'active');
  if (pastPeriod) {
    store.setActivePeriod(pastPeriod.id);
    const updatedPeriods = store.getPeriods();
    const newActive = updatedPeriods.filter((p) => p.status === 'active');
    assert.equal(newActive.length, 1);
    assert.equal(newActive[0].id, pastPeriod.id);
  }
});

test('Atomic voting: registers anonymous vote without voter link and prevents double voting', () => {
  const store = new ElectionStore();
  // Find an unvoted voter
  const unvoted = store.getVoters().find((v) => !v.hasVoted);
  assert.ok(unvoted, 'Must have at least one unvoted student in initial seed');

  const candidates = store.getCandidates();
  assert.ok(candidates.length > 0, 'Must have candidates');
  const targetCandidate = candidates[0];

  const initialSummary = store.getSummary();
  const initialCandVotes = initialSummary.candidatesResults.find(
    (c) => c.candidate.id === targetCandidate.id
  )?.voteCount || 0;

  // Cast vote
  const result = store.submitAnonymousVote(unvoted.id, targetCandidate.id);
  assert.equal(result.success, true);
  assert.ok(result.receiptCode);

  // Check that voter is now marked hasVoted
  const updatedVoter = store.getVoters().find((v) => v.id === unvoted.id);
  assert.equal(updatedVoter?.hasVoted, true);
  assert.equal(updatedVoter?.pinPlain, undefined); // PIN burned

  // Attempt double voting with same voter ID
  const secondAttempt = store.submitAnonymousVote(unvoted.id, targetCandidate.id);
  assert.equal(secondAttempt.success, false);
  assert.equal(secondAttempt.message.includes('telah digunakan'), true);

  // Check candidate vote count incremented by exactly 1
  const updatedSummary = store.getSummary();
  const newCandVotes = updatedSummary.candidatesResults.find(
    (c) => c.candidate.id === targetCandidate.id
  )?.voteCount || 0;
  assert.equal(newCandVotes, initialCandVotes + 1);
});
