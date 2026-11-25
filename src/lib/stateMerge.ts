/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure authoritative state merge helpers for E-Pilketos / E-Pilkosim Digital.
 * Guarantees non-destructive persistence for Admin & Panitia edits (school, accounts,
 * periods, DPT/PIN, candidates, votes, committee SK, opening video) and ensures
 * explicitly deleted items stay deleted across concurrent clients and restarts.
 */

import {
  AuditLog,
  DeletedEntityTombstones,
  ElectionPeriod,
  ElectionStateSnapshot,
  SchoolConfig,
  UserAccount,
  Voter,
} from '../types';
import { DEFAULT_EPOCH_ID, isUninitializedDefaultSnapshot } from './realtimeSync';

const MAX_TOMBSTONES_PER_BUCKET = 500;

export function generateResetEpochId(): string {
  return `epoch_reset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function mergeIdBucket(
  existing?: string[],
  incoming?: string[],
  addedIds: string[] = []
): string[] {
  const set = new Set<string>();
  if (Array.isArray(existing)) {
    for (const id of existing) {
      if (id) set.add(id);
    }
  }
  if (Array.isArray(incoming)) {
    for (const id of incoming) {
      if (id) set.add(id);
    }
  }
  for (const id of addedIds) {
    if (id) set.add(id);
  }
  const arr = Array.from(set);
  return arr.length > MAX_TOMBSTONES_PER_BUCKET
    ? arr.slice(arr.length - MAX_TOMBSTONES_PER_BUCKET)
    : arr;
}

export function mergeByIdPreserveExisting<T extends { id: string }>(
  existing: T[],
  incoming?: T[],
  deletedIds?: Set<string>
): T[] {
  if (!Array.isArray(incoming)) {
    return deletedIds && deletedIds.size > 0
      ? existing.filter((item) => item && item.id && !deletedIds.has(item.id))
      : existing;
  }
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && item.id && !(deletedIds && deletedIds.has(item.id))) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (item && item.id && !(deletedIds && deletedIds.has(item.id))) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Merges voter records without ever letting a stale client snapshot revert `hasVoted: true` back to `false`
 * during simultaneous multi-device voting (unless explicitly reset), while honoring deletion tombstones.
 */
export function mergeVotersPreserveVotes(
  existing: Voter[],
  incoming?: Voter[],
  deletedIds?: Set<string>
): Voter[] {
  if (!Array.isArray(incoming)) {
    return deletedIds && deletedIds.size > 0
      ? existing.filter((v) => v && v.id && !deletedIds.has(v.id))
      : existing;
  }
  const map = new Map<string, Voter>();
  for (const v of existing) {
    if (v && v.id && !(deletedIds && deletedIds.has(v.id))) {
      map.set(v.id, v);
    }
  }
  for (const v of incoming) {
    if (!v || !v.id || (deletedIds && deletedIds.has(v.id))) continue;
    const prev = map.get(v.id);
    if (prev && prev.hasVoted && !v.hasVoted) {
      map.set(v.id, prev);
    } else {
      map.set(v.id, v);
    }
  }
  return Array.from(map.values());
}

const PERIOD_MUTATING_ACTIONS = new Set([
  'BUAT_PERIODE_BARU',
  'UPDATE_PERIODE',
  'AKTIVASI_PERIODE_BARU',
  'RESTORE_CLIENT_STATE',
  'STATE_MUTATION',
  'HTTP_STATE_MUTATION',
  'SYNC_UPDATE',
]);

/**
 * Merges election periods non-destructively:
 * - Preserves all existing periods unless explicitly deleted via HAPUS_PERIODE or RESET_DATA_DEMO.
 * - Filters out periods present in deletion tombstones so stale tabs never resurrect deleted periods.
 * - Only allows period-mutating actions to switch which period is `active`.
 */
export function mergePeriodsNonDestructive(
  existing: ElectionPeriod[],
  incoming?: ElectionPeriod[],
  action: string = 'SYNC_UPDATE',
  deletedPeriodIds?: Set<string>
): ElectionPeriod[] {
  const filterTombstones = (list: ElectionPeriod[]) =>
    deletedPeriodIds && deletedPeriodIds.size > 0
      ? list.filter((p) => p && p.id && !deletedPeriodIds.has(p.id))
      : list;

  if (!Array.isArray(incoming) || incoming.length === 0) {
    const kept = filterTombstones(existing);
    if (kept.length > 0 && !kept.some((p) => p.status === 'active')) {
      kept[0] = { ...kept[0], status: 'active' };
    }
    return kept;
  }

  const canChangeActivePeriod = PERIOD_MUTATING_ACTIONS.has(action);
  const cleanIncoming = filterTombstones(incoming);
  const incomingHasActive = cleanIncoming.some((p) => p.status === 'active');
  const cleanExisting = filterTombstones(existing);
  const existingActiveId = cleanExisting.find((p) => p.status === 'active')?.id;
  const map = new Map<string, ElectionPeriod>();

  for (const p of cleanExisting) {
    if (p && p.id) {
      map.set(
        p.id,
        canChangeActivePeriod && incomingHasActive && p.status === 'active'
          ? { ...p, status: 'completed' }
          : p
      );
    }
  }

  for (const p of cleanIncoming) {
    if (!p || !p.id) continue;
    const prev = map.get(p.id);
    if (!prev) {
      const safeStatus =
        !canChangeActivePeriod && p.status === 'active' && existingActiveId
          ? 'draft'
          : p.status;
      map.set(p.id, { ...p, status: safeStatus });
    } else if (canChangeActivePeriod) {
      map.set(p.id, p);
    } else {
      map.set(p.id, prev);
    }
  }

  const merged = Array.from(map.values());
  if (!merged.some((p) => p.status === 'active') && merged.length > 0) {
    merged[0] = { ...merged[0], status: 'active' };
  }
  return merged;
}

export function mergeAuditLogsPreserveRecent(
  existing: AuditLog[],
  incoming?: AuditLog[]
): AuditLog[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing;
  const map = new Map<string, AuditLog>();
  for (const log of incoming) {
    if (log && log.id && !map.has(log.id)) {
      map.set(log.id, log);
    }
  }
  for (const log of existing) {
    if (log && log.id && !map.has(log.id)) {
      map.set(log.id, log);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
    .slice(0, 200);
}

export interface AuthoritativeUpdateParams {
  current: ElectionStateSnapshot;
  incoming: Partial<ElectionStateSnapshot>;
  updatedBy?: string;
  lastAction?: string;
  defaultAccounts: UserAccount[];
  nowMs?: number;
}

const SCHOOL_MUTATING_ACTIONS = new Set([
  'UPDATE_KONFIGURASI_SEKOLAH',
  'RESET_DATA_DEMO',
  'SYNC_UPDATE',
  'HTTP_STATE_MUTATION',
  'STATE_MUTATION',
]);

const ACCOUNT_MUTATING_ACTIONS = new Set([
  'UPDATE_PASSWORD',
  'RESET_ACCOUNTS_DEFAULT',
  'RESET_DATA_DEMO',
  'SYNC_UPDATE',
  'HTTP_STATE_MUTATION',
  'STATE_MUTATION',
]);

export function mergeSkConfigsByPeriod(
  existing?: Record<string, import('../types').SkDocumentConfig>,
  incoming?: Record<string, import('../types').SkDocumentConfig>,
  validPeriodIds?: Set<string>,
  preferIncomingOnTie: boolean = true
): Record<string, import('../types').SkDocumentConfig> | undefined {
  if (!existing && !incoming) return undefined;
  const merged: Record<string, import('../types').SkDocumentConfig> = {};
  const allPeriodIds = new Set<string>([
    ...Object.keys(existing || {}),
    ...Object.keys(incoming || {}),
  ]);

  for (const periodId of allPeriodIds) {
    if (validPeriodIds && !validPeriodIds.has(periodId)) continue;
    const prevCfg = existing?.[periodId];
    const nextCfg = incoming?.[periodId];
    if (!prevCfg && nextCfg) {
      merged[periodId] = nextCfg;
    } else if (prevCfg && !nextCfg) {
      merged[periodId] = prevCfg;
    } else if (prevCfg && nextCfg) {
      const prevTime = Date.parse(prevCfg.updatedAt || '') || 0;
      const nextTime = Date.parse(nextCfg.updatedAt || '') || 0;
      if (nextTime > prevTime || (preferIncomingOnTie && nextTime === prevTime)) {
        merged[periodId] = nextCfg;
      } else {
        merged[periodId] = prevCfg;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : existing ?? incoming;
}

export function applyAuthoritativeStateUpdate({
  current,
  incoming,
  updatedBy = 'Admin Sekolah',
  lastAction = 'SYNC_UPDATE',
  defaultAccounts,
  nowMs = Date.now(),
}: AuthoritativeUpdateParams): ElectionStateSnapshot {
  const action = lastAction || incoming.lastAction || 'SYNC_UPDATE';

  const nextOffset =
    typeof incoming.appTimeOffsetMs === 'number'
      ? incoming.appTimeOffsetMs
      : current.appTimeOffsetMs;

  const appNowIso = new Date(nowMs + nextOffset).toISOString();

  const nextRevision =
    Math.max(
      current.revision,
      typeof incoming.revision === 'number' ? incoming.revision : 0
    ) + 1;

  // Actions that only mutate metadata/config/auth must never clobber periods, voters, candidates, votes, or committee
  const isMetaOrConfigOnlyAction =
    action === 'USER_LOGIN' ||
    action === 'LOGOUT' ||
    action === 'UPDATE_PASSWORD' ||
    action === 'RESET_ACCOUNTS_DEFAULT' ||
    action === 'SET_APP_TIME' ||
    action === 'SINKRONISASI_WAKTU_APLIKASI' ||
    action === 'RESET_WAKTU_REALTIME' ||
    action === 'UPDATE_KONFIGURASI_SEKOLAH';

  // Compute updated tombstones for explicit deletions (cleared only on RESET_DATA_DEMO)
  let nextTombstones: DeletedEntityTombstones = {};
  if (action !== 'RESET_DATA_DEMO') {
    const incomingPeriodIds = Array.isArray(incoming.periods)
      ? new Set(incoming.periods.map((p) => p.id))
      : null;
    const incomingCandidateIds = Array.isArray(incoming.candidates)
      ? new Set(incoming.candidates.map((c) => c.id))
      : null;
    const incomingVoterIds = Array.isArray(incoming.voters)
      ? new Set(incoming.voters.map((v) => v.id))
      : null;
    const incomingCommitteeIds = Array.isArray(incoming.committee)
      ? new Set(incoming.committee.map((c) => c.id))
      : null;

    const deletedPeriodsNow =
      action === 'HAPUS_PERIODE' && incomingPeriodIds
        ? current.periods.filter((p) => !incomingPeriodIds.has(p.id)).map((p) => p.id)
        : [];
    const deletedPeriodNowSet = new Set(deletedPeriodsNow);
    const deletedCandidatesNow =
      action === 'HAPUS_PASLON' && incomingCandidateIds
        ? current.candidates.filter((c) => !incomingCandidateIds.has(c.id)).map((c) => c.id)
        : action === 'HAPUS_PERIODE'
        ? current.candidates.filter((c) => deletedPeriodNowSet.has(c.electionPeriodId)).map((c) => c.id)
        : [];
    const deletedVotersNow =
      (action === 'HAPUS_PEMILIH' || action === 'HAPUS_SEMUA_DPT') && incomingVoterIds
        ? current.voters.filter((v) => !incomingVoterIds.has(v.id)).map((v) => v.id)
        : action === 'HAPUS_PERIODE'
        ? current.voters.filter((v) => deletedPeriodNowSet.has(v.electionPeriodId)).map((v) => v.id)
        : [];
    const deletedCommitteeNow =
      action === 'HAPUS_PANITIA' && incomingCommitteeIds
        ? current.committee.filter((c) => !incomingCommitteeIds.has(c.id)).map((c) => c.id)
        : action === 'HAPUS_PERIODE'
        ? current.committee.filter((c) => deletedPeriodNowSet.has(c.electionPeriodId)).map((c) => c.id)
        : [];

    nextTombstones = {
      periods: mergeIdBucket(current.tombstones?.periods, incoming.tombstones?.periods, deletedPeriodsNow),
      candidates: mergeIdBucket(current.tombstones?.candidates, incoming.tombstones?.candidates, deletedCandidatesNow),
      voters: mergeIdBucket(current.tombstones?.voters, incoming.tombstones?.voters, deletedVotersNow),
      committee: mergeIdBucket(current.tombstones?.committee, incoming.tombstones?.committee, deletedCommitteeNow),
    };
  }

  const deletedPeriodSet = new Set(nextTombstones.periods || []);
  const deletedCandidateSet = new Set(nextTombstones.candidates || []);
  const deletedVoterSet = new Set(nextTombstones.voters || []);
  const deletedCommitteeSet = new Set(nextTombstones.committee || []);

  const nextPeriods =
    action === 'RESET_DATA_DEMO'
      ? Array.isArray(incoming.periods) && incoming.periods.length > 0
        ? incoming.periods
        : current.periods
      : action === 'HAPUS_PERIODE'
      ? mergePeriodsNonDestructive(current.periods, incoming.periods, 'AKTIVASI_PERIODE_BARU', deletedPeriodSet)
      : isMetaOrConfigOnlyAction || action === 'TRANSAKSI_SUARA_ANONIM'
      ? current.periods
      : mergePeriodsNonDestructive(current.periods, incoming.periods, action, deletedPeriodSet);

  const validPeriodIds = new Set(nextPeriods.map((p) => p.id));

  const nextCandidates =
    action === 'RESET_DATA_DEMO' || action === 'HAPUS_PASLON'
      ? (incoming.candidates ?? current.candidates).filter(
          (c) => validPeriodIds.has(c.electionPeriodId) && !deletedCandidateSet.has(c.id)
        )
      : isMetaOrConfigOnlyAction || action === 'TRANSAKSI_SUARA_ANONIM'
      ? current.candidates
      : mergeByIdPreserveExisting(current.candidates, incoming.candidates, deletedCandidateSet).filter((c) =>
          validPeriodIds.has(c.electionPeriodId)
        );

  const nextVoters =
    action === 'RESET_DATA_DEMO' ||
    action === 'HAPUS_PEMILIH' ||
    action === 'HAPUS_SEMUA_DPT' ||
    action === 'HAPUS_PASLON' ||
    action === 'RESET_STATUS_BILIK' ||
    action === 'RESET_STATUS_PEMILIH_TUNGGAL'
      ? (incoming.voters ?? current.voters).filter(
          (v) => validPeriodIds.has(v.electionPeriodId) && !deletedVoterSet.has(v.id)
        )
      : isMetaOrConfigOnlyAction
      ? current.voters
      : mergeVotersPreserveVotes(current.voters, incoming.voters, deletedVoterSet).filter((v) =>
          validPeriodIds.has(v.electionPeriodId)
        );

  const nextVotesRaw =
    action === 'RESET_DATA_DEMO' ||
    action === 'RESET_STATUS_BILIK' ||
    action === 'RESET_STATUS_PEMILIH_TUNGGAL' ||
    action === 'HAPUS_PASLON' ||
    action === 'HAPUS_PEMILIH' ||
    action === 'HAPUS_SEMUA_DPT'
      ? incoming.votes ?? current.votes
      : isMetaOrConfigOnlyAction
      ? current.votes
      : mergeByIdPreserveExisting(current.votes, incoming.votes);

  const validCandidateIds = new Set(nextCandidates.map((c) => c.id));
  const nextVotes = nextVotesRaw.filter(
    (v) => validPeriodIds.has(v.electionPeriodId) && validCandidateIds.has(v.candidateId)
  );

  const nextCommittee =
    action === 'RESET_DATA_DEMO' || action === 'HAPUS_PANITIA'
      ? (incoming.committee ?? current.committee).filter(
          (c) => validPeriodIds.has(c.electionPeriodId) && !deletedCommitteeSet.has(c.id)
        )
      : isMetaOrConfigOnlyAction || action === 'TRANSAKSI_SUARA_ANONIM'
      ? current.committee
      : mergeByIdPreserveExisting(current.committee, incoming.committee, deletedCommitteeSet).filter((c) =>
          validPeriodIds.has(c.electionPeriodId)
        );

  const nextEpochId =
    action === 'RESET_DATA_DEMO'
      ? generateResetEpochId()
      : current.epochId || incoming.epochId || DEFAULT_EPOCH_ID;

  // Preserve Admin's school config unless this action specifically mutates school config (or server is restoring onto uninitialized state)
  const canUpdateSchool =
    SCHOOL_MUTATING_ACTIONS.has(action) ||
    (action === 'RESTORE_CLIENT_STATE' && isUninitializedDefaultSnapshot(current));

  const mergedSkConfigs =
    action === 'RESET_DATA_DEMO'
      ? incoming.school?.skConfigsByPeriod
      : mergeSkConfigsByPeriod(
          current.school?.skConfigsByPeriod,
          incoming.school?.skConfigsByPeriod,
          validPeriodIds,
          canUpdateSchool
        );

  const nextSchool: SchoolConfig =
    action === 'RESET_DATA_DEMO' && incoming.school
      ? incoming.school
      : canUpdateSchool && incoming.school
      ? {
          ...current.school,
          ...incoming.school,
          ...(mergedSkConfigs !== undefined ? { skConfigsByPeriod: mergedSkConfigs } : {}),
        }
      : mergedSkConfigs !== undefined
      ? {
          ...current.school,
          skConfigsByPeriod: mergedSkConfigs,
        }
      : current.school;

  // Preserve Admin's updated accounts/passwords unless an account-mutating action is running
  const canReplaceAccounts =
    ACCOUNT_MUTATING_ACTIONS.has(action) ||
    (action === 'RESTORE_CLIENT_STATE' && isUninitializedDefaultSnapshot(current));

  let nextAccounts = current.accounts ?? defaultAccounts;
  if (canReplaceAccounts && Array.isArray(incoming.accounts) && incoming.accounts.length > 0) {
    nextAccounts = incoming.accounts;
  } else if (action === 'USER_LOGIN' && Array.isArray(incoming.accounts)) {
    // Only merge lastLoginAt timestamp without clobbering changed passwords
    nextAccounts = (current.accounts ?? defaultAccounts).map((acc) => {
      const matched = incoming.accounts?.find((inc) => inc.id === acc.id);
      return matched?.lastLoginAt ? { ...acc, lastLoginAt: matched.lastLoginAt } : acc;
    });
  }

  return {
    revision: nextRevision,
    epochId: nextEpochId,
    updatedAt: appNowIso,
    updatedBy: updatedBy || incoming.updatedBy || 'Admin Sekolah',
    lastAction: action,
    appTimeOffsetMs: nextOffset,
    school: nextSchool,
    periods: nextPeriods,
    candidates: nextCandidates,
    voters: nextVoters,
    votes: nextVotes,
    committee: nextCommittee,
    auditLogs:
      action === 'RESET_DATA_DEMO'
        ? incoming.auditLogs ?? current.auditLogs
        : mergeAuditLogsPreserveRecent(current.auditLogs, incoming.auditLogs),
    accounts: nextAccounts,
    tombstones: nextTombstones,
  };
}
