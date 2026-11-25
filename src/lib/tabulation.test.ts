/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Comprehensive unit tests for unified cross-menu tabulation & server merge parity
 * across Papan Hitung Cepat, Bilik Suara, Portal Panitia, and Admin Sekolah.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectionStore } from './store.ts';
import { computePeriodTabulation, getTabulationLeaderInfo } from './tabulation.ts';
import { applyAuthoritativeStateUpdate } from './stateMerge.ts';
import {
  INITIAL_ACCOUNTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CANDIDATES,
  INITIAL_COMMITTEE,
  INITIAL_PERIODS,
  INITIAL_SCHOOL,
  INITIAL_VOTERS,
  INITIAL_VOTES,
} from './initialData.ts';
import { DEFAULT_EPOCH_ID } from './realtimeSync.ts';
import { ElectionStateSnapshot } from '../types/index.ts';

function assertAllMenuTabulationsMatch(store: ElectionStore, periodId: string) {
  const summary = store.getSummary(periodId);
  const adminStats = store.getPeriodStats(periodId);
  const voters = store.getVoters(periodId);
  const candidates = store.getCandidates(periodId);
  const committee = store.getCommittee(periodId);

  const votedVotersCount = voters.filter((v) => v.hasVoted).length;
  const unvotedVotersCount = voters.filter((v) => !v.hasVoted).length;
  const candidateVoteSum = summary.candidatesResults.reduce((acc, r) => acc + r.voteCount, 0);
  const classVotedSum = summary.classParticipation.reduce((acc, c) => acc + c.voted, 0);
  const classTotalSum = summary.classParticipation.reduce((acc, c) => acc + c.total, 0);

  // Admin Period Stats === QuickCount Summary === Panitia DPT & Monitoring
  assert.equal(adminStats.votersCount, summary.totalVoters, 'Admin votersCount must equal summary.totalVoters');
  assert.equal(voters.length, summary.totalVoters, 'Panitia DPT count must equal summary.totalVoters');
  assert.equal(classTotalSum, summary.totalVoters, 'Class participation total must equal totalVoters');

  assert.equal(adminStats.votesCount, summary.totalVoted, 'Admin votesCount must equal summary.totalVoted');
  assert.equal(votedVotersCount, summary.totalVoted, 'Panitia Sudah Memilih must equal summary.totalVoted');
  assert.equal(candidateVoteSum, summary.totalVoted, 'Sum of candidate votes must equal summary.totalVoted');
  assert.equal(classVotedSum, summary.totalVoted, 'Sum of class voted must equal summary.totalVoted');

  assert.equal(adminStats.unvotedCount, summary.totalUnvoted, 'Admin unvotedCount must equal summary.totalUnvoted');
  assert.equal(unvotedVotersCount, summary.totalUnvoted, 'Panitia Belum Memilih must equal summary.totalUnvoted');
  assert.equal(summary.totalVoted + summary.totalUnvoted, summary.totalVoters, 'Voted + Unvoted must equal Total DPT');

  assert.equal(adminStats.participationPercentage, summary.participationPercentage);
  assert.equal(adminStats.candidatesCount, candidates.length);
  assert.equal(candidates.length, summary.candidatesResults.length);
  assert.equal(adminStats.committeeCount, committee.length);
}

test('All menus share identical tabulation initially, after adding voter, and after Bilik Suara vote', () => {
  const store = new ElectionStore();
  const activePeriodId = store.getActivePeriod().id;

  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Add a new voter via Panitia
  const addRes = store.addVoter(
    {
      nisn: '0123456789',
      fullName: 'Siswa Sinkronisasi',
      className: 'VII A',
      gradeLevel: 'VII',
      gender: 'L',
    },
    activePeriodId
  );
  assert.equal(addRes.success, true);
  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Student votes via Bilik Suara
  const candidates = store.getCandidates(activePeriodId);
  const voteRes = store.submitAnonymousVote(addRes.voter!.id, candidates[0].id);
  assert.equal(voteRes.success, true);
  assertAllMenuTabulationsMatch(store, activePeriodId);
});

test('Resetting single voted student keeps DPT, QuickCount, Monitoring, and Admin Period Stats 100% synchronized', () => {
  const store = new ElectionStore();
  const activePeriodId = store.getActivePeriod().id;
  const beforeSummary = store.getSummary(activePeriodId);

  const votedVoter = store.getVoters(activePeriodId).find((v) => v.hasVoted);
  assert.ok(votedVoter, 'Seed data must contain a voted student');

  // Reset single student back to Belum Memilih
  const resetRes = store.resetSingleVoterStatusToUnvoted(votedVoter.id);
  assert.equal(resetRes.success, true);
  assert.ok(resetRes.newPin);

  const afterResetSummary = store.getSummary(activePeriodId);
  assert.equal(afterResetSummary.totalVoted, beforeSummary.totalVoted - 1);
  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Same student re-votes -> returns cleanly to original totalVoted without exceeding totalVoters
  const candidates = store.getCandidates(activePeriodId);
  const reVoteRes = store.submitAnonymousVote(votedVoter.id, candidates[1].id);
  assert.equal(reVoteRes.success, true);

  const afterReVoteSummary = store.getSummary(activePeriodId);
  assert.equal(afterReVoteSummary.totalVoted, beforeSummary.totalVoted);
  assertAllMenuTabulationsMatch(store, activePeriodId);
});

test('Deleting candidate with or without votes succeeds and preserves 100% cross-menu tabulation parity', () => {
  const store = new ElectionStore();
  const activePeriodId = store.getActivePeriod().id;
  const beforeSummary = store.getSummary(activePeriodId);
  const existingCandWithVotes = store.getCandidates(activePeriodId)[0];
  const candVotesBefore =
    beforeSummary.candidatesResults.find((r) => r.candidate.id === existingCandWithVotes.id)?.voteCount || 0;
  assert.ok(candVotesBefore > 0, 'Initial candidate 1 should have seeded votes');

  // Deleting a candidate who already has votes reconciles voter slots and votes cleanly
  const deleteVotedCand = store.deleteCandidate(existingCandWithVotes.id);
  assert.equal(deleteVotedCand.success, true);
  assert.equal(
    store.getCandidates(activePeriodId).some((c) => c.id === existingCandWithVotes.id),
    false
  );
  assert.equal(store.getSummary(activePeriodId).totalVoted, beforeSummary.totalVoted - candVotesBefore);
  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Adding a fresh candidate with 0 votes and deleting it also succeeds cleanly
  const newCand = store.addCandidate({
    electionPeriodId: activePeriodId,
    ballotNumber: 4,
    chairmanName: 'Calon Sementara',
    viceChairmanName: 'Wakil Sementara',
    chairmanClass: 'VIII A',
    viceChairmanClass: 'VIII B',
    photoUrl: '',
    motto: 'Tes Hapus',
    vision: 'Visi',
    mission: ['Misi'],
    programs: ['Proker'],
  });
  assertAllMenuTabulationsMatch(store, activePeriodId);

  const allowedDelete = store.deleteCandidate(newCand.id);
  assert.equal(allowedDelete.success, true);
  assertAllMenuTabulationsMatch(store, activePeriodId);
});

test('Deleting voted/unvoted voters and deleting all DPT keeps all menus synchronized at zero mismatch', () => {
  const store = new ElectionStore();
  const activePeriodId = store.getActivePeriod().id;
  const beforeSummary = store.getSummary(activePeriodId);

  // Delete 1 voted student -> totalVoters - 1 AND totalVoted - 1
  const votedVoter = store.getVoters(activePeriodId).find((v) => v.hasVoted);
  assert.ok(votedVoter);
  const delVotedRes = store.deleteVoter(votedVoter.id);
  assert.equal(delVotedRes.success, true);

  const afterVotedDel = store.getSummary(activePeriodId);
  assert.equal(afterVotedDel.totalVoters, beforeSummary.totalVoters - 1);
  assert.equal(afterVotedDel.totalVoted, beforeSummary.totalVoted - 1);
  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Delete 1 unvoted student -> totalVoters - 1, totalVoted unchanged
  const unvotedVoter = store.getVoters(activePeriodId).find((v) => !v.hasVoted);
  assert.ok(unvotedVoter);
  const delUnvotedRes = store.deleteVoter(unvotedVoter.id);
  assert.equal(delUnvotedRes.success, true);

  const afterUnvotedDel = store.getSummary(activePeriodId);
  assert.equal(afterUnvotedDel.totalVoters, beforeSummary.totalVoters - 2);
  assert.equal(afterUnvotedDel.totalVoted, beforeSummary.totalVoted - 1);
  assertAllMenuTabulationsMatch(store, activePeriodId);

  // Delete all remaining DPT -> 0 voters, 0 votes, 0% turnout
  const delAllRes = store.deleteAllVoters(activePeriodId);
  assert.equal(delAllRes.success, true);
  assert.equal(store.getVoters(activePeriodId).length, 0);
  assert.equal(store.getSummary(activePeriodId).totalVoted, 0);
  assertAllMenuTabulationsMatch(store, activePeriodId);
});

test('Authoritative server state merge adopts vote reductions on RESET_STATUS_PEMILIH_TUNGGAL and HAPUS_PASLON', () => {
  const current: ElectionStateSnapshot = {
    revision: 5,
    epochId: DEFAULT_EPOCH_ID,
    updatedAt: '2026-10-24T10:00:00.000Z',
    updatedBy: 'Panitia',
    lastAction: 'INIT_SYSTEM',
    appTimeOffsetMs: 0,
    school: INITIAL_SCHOOL,
    periods: INITIAL_PERIODS,
    candidates: INITIAL_CANDIDATES,
    voters: INITIAL_VOTERS,
    votes: INITIAL_VOTES,
    committee: INITIAL_COMMITTEE,
    auditLogs: INITIAL_AUDIT_LOGS,
    accounts: INITIAL_ACCOUNTS,
  };

  // Single voter reset removes 1 vote and sets voter[0].hasVoted = false
  const resetMerged = applyAuthoritativeStateUpdate({
    current,
    incoming: {
      revision: 6,
      voters: current.voters.map((v, idx) => (idx === 0 ? { ...v, hasVoted: false, votedAt: undefined } : v)),
      votes: current.votes.slice(0, current.votes.length - 1),
    },
    updatedBy: 'Panitia',
    lastAction: 'RESET_STATUS_PEMILIH_TUNGGAL',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(resetMerged.voters[0].hasVoted, false);
  assert.equal(resetMerged.votes.length, current.votes.length - 1);

  const serverTab = computePeriodTabulation(
    {
      periods: resetMerged.periods,
      voters: resetMerged.voters,
      votes: resetMerged.votes,
      candidates: resetMerged.candidates,
      committee: resetMerged.committee,
    },
    'period_2026_2027'
  );
  assert.equal(serverTab.totalVoted, serverTab.votedVotersCount);
  assert.equal(serverTab.totalVoted, serverTab.validVotesCount);

  // Deleting a candidate who has votes reconciles both votes and hasVoted slots on authoritative server merge
  const cand3Votes = resetMerged.votes.filter((v) => v.candidateId === 'cand_03').length;
  assert.ok(cand3Votes > 0);
  let reverted = 0;
  const votersAfterCandDel = resetMerged.voters.map((v) => {
    if (v.electionPeriodId === 'period_2026_2027' && v.hasVoted && reverted < cand3Votes) {
      reverted++;
      return { ...v, hasVoted: false, votedAt: undefined };
    }
    return v;
  });
  const candDelMerged = applyAuthoritativeStateUpdate({
    current: resetMerged,
    incoming: {
      revision: 7,
      candidates: resetMerged.candidates.filter((c) => c.id !== 'cand_03'),
      votes: resetMerged.votes.filter((v) => v.candidateId !== 'cand_03'),
      voters: votersAfterCandDel,
      tombstones: { candidates: ['cand_03'] },
    },
    updatedBy: 'Panitia',
    lastAction: 'HAPUS_PASLON',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  const afterCandDelTab = computePeriodTabulation(
    {
      periods: candDelMerged.periods,
      voters: candDelMerged.voters,
      votes: candDelMerged.votes,
      candidates: candDelMerged.candidates,
      committee: candDelMerged.committee,
    },
    'period_2026_2027'
  );
  assert.equal(afterCandDelTab.totalVoted, afterCandDelTab.votedVotersCount);
  assert.equal(afterCandDelTab.totalVoted, afterCandDelTab.validVotesCount);
  assert.equal(
    afterCandDelTab.candidatesResults.reduce((acc, r) => acc + r.voteCount, 0),
    afterCandDelTab.totalVoted
  );
});

test('Tabulation handles 0 voters abstainPercentage, ties, 0 votes, gradeLevel inference, and empty markTokensAsPrinted cleanly', () => {
  const store = new ElectionStore();
  const activePeriodId = store.getActivePeriod().id;

  // Empty period (0 voters) should report 0% participation and 0% abstain (never 100% abstain)
  store.deleteAllVoters(activePeriodId);
  const emptySummary = store.getSummary(activePeriodId);
  assert.equal(emptySummary.totalVoters, 0);
  assert.equal(emptySummary.participationPercentage, 0);
  assert.equal(emptySummary.abstainPercentage, 0);

  // Leader info with 0 votes must report hasVotes=false
  const zeroVotesLeader = getTabulationLeaderInfo(emptySummary.candidatesResults);
  assert.equal(zeroVotesLeader.hasVotes, false);
  assert.equal(zeroVotesLeader.isTie, false);
  assert.equal(zeroVotesLeader.topCandidate, null);

  // Single-voter add infers gradeLevel ('IX' / 'VIII') from className even if caller passes 'VII'
  const v1 = store.addVoter(
    { nisn: '0099887701', fullName: 'Siswa Sembilan', className: 'IX B', gradeLevel: 'VII', gender: 'L' },
    activePeriodId
  );
  const v2 = store.addVoter(
    { nisn: '0099887702', fullName: 'Siswa Delapan', className: 'VIII C', gradeLevel: 'VII', gender: 'P' },
    activePeriodId
  );
  assert.equal(v1.voter?.gradeLevel, 'IX');
  assert.equal(v2.voter?.gradeLevel, 'VIII');

  // Calling markTokensAsPrinted([]) must not bump revision
  const revBefore = store.getSyncMetadata().revision;
  store.markTokensAsPrinted([]);
  assert.equal(store.getSyncMetadata().revision, revBefore);

  // Tie detection: 1 vote each for candidate 1 and candidate 2
  const cands = store.getCandidates(activePeriodId);
  assert.ok(cands.length >= 2);
  store.submitAnonymousVote(v1.voter!.id, cands[0].id);
  store.submitAnonymousVote(v2.voter!.id, cands[1].id);
  const tieSummary = store.getSummary(activePeriodId);
  const tieInfo = getTabulationLeaderInfo(tieSummary.candidatesResults);
  assert.equal(tieInfo.hasVotes, true);
  assert.equal(tieInfo.isTie, true);
  assert.equal(tieInfo.leaders.length, 2);
  assert.equal(tieSummary.abstainPercentage, 0);
});

