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

test('Creating a new period preserves all 5 datasets on source period and supports permanent cloning with/without votes until manual delete', () => {
  const store = new ElectionStore();
  const sourcePeriod = store.getActivePeriod();
  const beforeSourceStats = store.getPeriodStats(sourcePeriod.id);

  assert.ok(beforeSourceStats.votersCount > 0);
  assert.ok(beforeSourceStats.candidatesCount > 0);
  assert.ok(beforeSourceStats.votesCount > 0);
  assert.ok(beforeSourceStats.unvotedCount > 0);
  assert.ok(beforeSourceStats.committeeCount > 0);

  // 1. Create new period carrying DPT & PIN, Pasangan Calon, and Panitia SK (fresh election votes = 0)
  const freshPeriod = store.addPeriod(
    {
      schoolId: store.getSchool().id,
      periodName: 'Pemilihan OSIS 2027/2028',
      academicYear: '2027/2028',
      startDate: '2027-09-10',
      endDate: '2027-09-10',
      votingOpenTime: '07:30',
      votingCloseTime: '15:00',
      status: 'active',
      description: 'Periode baru',
    },
    {
      copyFromPeriodId: sourcePeriod.id,
      copyVoters: true,
      copyCandidates: true,
      copyCommittee: true,
      copyVotes: false,
    }
  );

  // Source period data MUST remain 100% intact
  assert.deepEqual(store.getPeriodStats(sourcePeriod.id), beforeSourceStats);

  // New period preserves all DPT & PIN, Pasangan Calon, Panitia SK, with everyone Belum Memilih
  const freshStats = store.getPeriodStats(freshPeriod.id);
  assert.equal(freshStats.votersCount, beforeSourceStats.votersCount);
  assert.equal(freshStats.candidatesCount, beforeSourceStats.candidatesCount);
  assert.equal(freshStats.committeeCount, beforeSourceStats.committeeCount);
  assert.equal(freshStats.votesCount, 0);
  assert.equal(freshStats.unvotedCount, beforeSourceStats.votersCount);
  assert.ok(store.getVoters(freshPeriod.id).every((v) => Boolean(v.pinPlain)));

  // 2. Create another period cloning ALL 5 datasets including Suara Masuk & Belum Memilih
  const fullClonePeriod = store.addPeriod(
    {
      schoolId: store.getSchool().id,
      periodName: 'Duplikasi Lengkap 2027/2028',
      academicYear: '2027/2028',
      startDate: '2027-09-11',
      endDate: '2027-09-11',
      votingOpenTime: '07:30',
      votingCloseTime: '15:00',
      status: 'draft',
      description: 'Clone lengkap',
    },
    {
      copyFromPeriodId: sourcePeriod.id,
      copyVoters: true,
      copyCandidates: true,
      copyCommittee: true,
      copyVotes: true,
    }
  );

  const fullCloneStats = store.getPeriodStats(fullClonePeriod.id);
  assert.deepEqual(fullCloneStats, beforeSourceStats);

  // 3. Manually deleting fullClonePeriod only removes fullClonePeriod; sourcePeriod and freshPeriod stay permanent
  const delRes = store.deletePeriod(fullClonePeriod.id);
  assert.equal(delRes.success, true);
  assert.equal(store.getPeriods().some((p) => p.id === fullClonePeriod.id), false);
  assert.deepEqual(store.getPeriodStats(sourcePeriod.id), beforeSourceStats);
  assert.equal(store.getPeriodStats(freshPeriod.id).votersCount, beforeSourceStats.votersCount);
  assert.equal(store.getPeriodStats(freshPeriod.id).candidatesCount, beforeSourceStats.candidatesCount);
  assert.equal(store.getPeriodStats(freshPeriod.id).committeeCount, beforeSourceStats.committeeCount);
});

