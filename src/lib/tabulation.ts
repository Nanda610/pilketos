/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified pure tabulation engine shared across:
 * - Papan Hitung Cepat (QuickCountDashboard)
 * - Bilik Suara Digital (BilikSuara)
 * - Portal Panitia (DPT & PIN, Paslon, Monitoring Bilik)
 * - Admin Sekolah (Periode Pemilihan stats & BAHP)
 * - Authoritative Backend REST Summary (/api/public-summary)
 */

import {
  AnonymousVote,
  Candidate,
  CommitteeMember,
  ElectionPeriod,
  ElectionSummary,
  Voter,
} from '../types';

export interface TabulationSourceData {
  periods: ElectionPeriod[];
  voters: Voter[];
  votes: AnonymousVote[];
  candidates: Candidate[];
  committee?: CommitteeMember[];
}

export interface UnifiedPeriodTabulation extends ElectionSummary {
  committeeCount: number;
  validVotesCount: number;
  votedVotersCount: number;
  abstainPercentage: number;
}

export interface UnifiedPeriodStats {
  votersCount: number;
  votedVotersCount: number;
  unvotedCount: number;
  candidatesCount: number;
  votesCount: number;
  participationPercentage: number;
  committeeCount: number;
}

export interface TabulationLeaderInfo {
  hasVotes: boolean;
  isTie: boolean;
  maxVotes: number;
  leaders: ElectionSummary['candidatesResults'];
  topCandidate: ElectionSummary['candidatesResults'][number] | null;
}

export function getTabulationLeaderInfo(
  candidatesResults: ElectionSummary['candidatesResults']
): TabulationLeaderInfo {
  if (!candidatesResults || candidatesResults.length === 0) {
    return {
      hasVotes: false,
      isTie: false,
      maxVotes: 0,
      leaders: [],
      topCandidate: null,
    };
  }

  const sorted = [...candidatesResults].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return a.candidate.ballotNumber - b.candidate.ballotNumber;
  });

  const maxVotes = sorted[0].voteCount;
  if (maxVotes <= 0) {
    return {
      hasVotes: false,
      isTie: false,
      maxVotes: 0,
      leaders: [],
      topCandidate: null,
    };
  }

  const leaders = sorted.filter((r) => r.voteCount === maxVotes);
  return {
    hasVotes: true,
    isTie: leaders.length > 1,
    maxVotes,
    leaders,
    topCandidate: sorted[0],
  };
}

export function resolveTargetPeriod(
  periods: ElectionPeriod[],
  periodId?: string
): ElectionPeriod {
  if (periodId) {
    const matched = periods.find((p) => p.id === periodId);
    if (matched) return matched;
  }
  return periods.find((p) => p.status === 'active') || periods[0];
}

export function computePeriodTabulation(
  data: TabulationSourceData,
  periodId?: string
): UnifiedPeriodTabulation {
  const targetPeriod = resolveTargetPeriod(data.periods, periodId);
  const targetPeriodId = targetPeriod?.id;

  const votersInPeriod = targetPeriodId
    ? data.voters.filter((v) => v.electionPeriodId === targetPeriodId)
    : [];

  const candidatesInPeriod = targetPeriodId
    ? data.candidates
        .filter((c) => c.electionPeriodId === targetPeriodId)
        .sort((a, b) => a.ballotNumber - b.ballotNumber)
    : [];

  const validCandidateIds = new Set(candidatesInPeriod.map((c) => c.id));

  // Count only votes tied to valid candidates within the target period so sums and percentages remain coherent
  const validVotesInPeriod = targetPeriodId
    ? data.votes.filter(
        (v) => v.electionPeriodId === targetPeriodId && validCandidateIds.has(v.candidateId)
      )
    : [];

  const committeeCount =
    targetPeriodId && Array.isArray(data.committee)
      ? data.committee.filter((m) => m.electionPeriodId === targetPeriodId).length
      : 0;

  const totalVoters = votersInPeriod.length;
  const votedVotersCount = votersInPeriod.filter((v) => v.hasVoted).length;
  const validVotesCount = validVotesInPeriod.length;
  const totalVoted = Math.max(votedVotersCount, validVotesCount);
  const totalUnvoted = Math.max(0, totalVoters - totalVoted);
  const participationPercentage =
    totalVoters > 0 ? Number(((totalVoted / totalVoters) * 100).toFixed(2)) : 0;
  const abstainPercentage =
    totalVoters > 0 ? Number(Math.max(0, 100 - participationPercentage).toFixed(2)) : 0;

  const voteMap = new Map<string, number>();
  for (const vote of validVotesInPeriod) {
    voteMap.set(vote.candidateId, (voteMap.get(vote.candidateId) || 0) + 1);
  }

  const candidateDenominator = validVotesCount > 0 ? validVotesCount : totalVoted;
  const candidatesResults = candidatesInPeriod.map((candidate) => {
    const voteCount = voteMap.get(candidate.id) || 0;
    const percentage =
      candidateDenominator > 0
        ? Number(((voteCount / candidateDenominator) * 100).toFixed(2))
        : 0;
    return {
      candidate,
      voteCount,
      percentage,
    };
  });

  const classMap = new Map<string, { total: number; voted: number }>();
  for (const voter of votersInPeriod) {
    const current = classMap.get(voter.className) || { total: 0, voted: 0 };
    current.total += 1;
    if (voter.hasVoted) current.voted += 1;
    classMap.set(voter.className, current);
  }

  const classParticipation = Array.from(classMap.entries())
    .map(([className, stats]) => ({
      className,
      total: stats.total,
      voted: stats.voted,
      percentage:
        stats.total > 0 ? Number(((stats.voted / stats.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return {
    period: targetPeriod,
    totalVoters,
    totalVoted,
    totalUnvoted,
    participationPercentage,
    abstainPercentage,
    candidatesResults,
    classParticipation,
    committeeCount,
    validVotesCount,
    votedVotersCount,
  };
}

export function computePeriodStats(
  data: TabulationSourceData,
  periodId: string
): UnifiedPeriodStats {
  const summary = computePeriodTabulation(data, periodId);
  return {
    votersCount: summary.totalVoters,
    votedVotersCount: summary.votedVotersCount,
    unvotedCount: summary.totalUnvoted,
    candidatesCount: summary.candidatesResults.length,
    votesCount: summary.totalVoted,
    participationPercentage: summary.participationPercentage,
    committeeCount: summary.committeeCount,
  };
}
