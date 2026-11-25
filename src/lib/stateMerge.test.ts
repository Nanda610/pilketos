/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for non-destructive multi-period persistence and server merge logic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
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
import { DEFAULT_EPOCH_ID, isResetEpochId, shouldApplyRemoteSnapshot } from './realtimeSync.ts';
import { applyAuthoritativeStateUpdate, mergePeriodsNonDestructive } from './stateMerge.ts';
import { ElectionPeriod, ElectionStateSnapshot } from '../types/index.ts';

function makeBaseSnapshot(overrides: Partial<ElectionStateSnapshot> = {}): ElectionStateSnapshot {
  return {
    revision: 10,
    epochId: DEFAULT_EPOCH_ID,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin Sekolah',
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
    ...overrides,
  };
}

test('Creating a new period preserves all existing periods and data, and non-period edits do not lose it', () => {
  const base = makeBaseSnapshot();
  const newPeriod: ElectionPeriod = {
    id: 'period_2027_2028',
    schoolId: INITIAL_SCHOOL.id,
    periodName: 'Pemilihan OSIS 2027/2028',
    academicYear: '2027/2028',
    startDate: '2027-09-15',
    endDate: '2027-09-15',
    status: 'draft',
    votingOpenTime: '07:30',
    votingCloseTime: '15:00',
    createdAt: '2026-10-25T11:00:00.000Z',
    description: 'Periode baru 2027/2028',
  };

  const afterCreate = applyAuthoritativeStateUpdate({
    current: base,
    incoming: {
      revision: 11,
      periods: [...base.periods, newPeriod],
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'BUAT_PERIODE_BARU',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(afterCreate.periods.length, INITIAL_PERIODS.length + 1);
  assert.ok(afterCreate.periods.some((p) => p.id === 'period_2027_2028'));
  assert.equal(afterCreate.voters.length, INITIAL_VOTERS.length);
  assert.equal(afterCreate.candidates.length, INITIAL_CANDIDATES.length);

  // Even if a stale client without period_2027_2028 sends a candidate addition, period_2027_2028 is preserved!
  const afterStaleCandidateAdd = applyAuthoritativeStateUpdate({
    current: afterCreate,
    incoming: {
      revision: 11,
      periods: base.periods, // stale list missing newPeriod
      candidates: [
        ...base.candidates,
        {
          id: 'cand_new_99',
          electionPeriodId: 'period_2027_2028',
          ballotNumber: 1,
          chairmanName: 'Ketua Baru',
          viceChairmanName: 'Wakil Baru',
          chairmanClass: 'VIII A',
          viceChairmanClass: 'VII B',
          photoUrl: '',
          motto: 'Motto',
          vision: 'Visi',
          mission: ['Misi 1'],
          programs: ['Program 1'],
        },
      ],
    },
    updatedBy: 'Panitia',
    lastAction: 'TAMBAH_PASLON',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(afterStaleCandidateAdd.periods.length, INITIAL_PERIODS.length + 1);
  assert.ok(afterStaleCandidateAdd.periods.some((p) => p.id === 'period_2027_2028'));
  assert.ok(afterStaleCandidateAdd.candidates.some((c) => c.id === 'cand_new_99'));
});

test('Non-period action from stale client never reverts active period switched by Admin', () => {
  const newActive: ElectionPeriod = {
    id: 'period_2027_2028',
    schoolId: INITIAL_SCHOOL.id,
    periodName: 'Pemilihan OSIS 2027/2028',
    academicYear: '2027/2028',
    startDate: '2027-09-15',
    endDate: '2027-09-15',
    status: 'active',
    votingOpenTime: '07:30',
    votingCloseTime: '15:00',
    createdAt: '2026-10-25T11:00:00.000Z',
  };
  const currentPeriods: ElectionPeriod[] = [
    ...INITIAL_PERIODS.map((p) => ({ ...p, status: 'completed' as const })),
    newActive,
  ];

  // Stale client still thinks period_2026_2027 is active when adding a voter
  const merged = mergePeriodsNonDestructive(currentPeriods, INITIAL_PERIODS, 'TAMBAH_PEMILIH_DPT');
  const activePeriods = merged.filter((p) => p.status === 'active');
  assert.equal(activePeriods.length, 1);
  assert.equal(activePeriods[0].id, 'period_2027_2028');
});

test('Server cold restart with lower revision or different non-reset epoch never overwrites saved client periods', () => {
  const localEdited = {
    revision: 22,
    updatedAt: '2026-10-25T12:00:00.000Z',
    epochId: DEFAULT_EPOCH_ID,
    lastAction: 'BUAT_PERIODE_BARU',
  };

  // Server restarted with legacy .data file (rev 13, random non-reset epochId, lastAction UPDATE_NAMA_SEKOLAH)
  const restartedServer = {
    revision: 13,
    updatedAt: '2026-10-25T12:05:00.000Z',
    epochId: 'epoch_legacy_boot_999',
    lastAction: 'UPDATE_NAMA_SEKOLAH',
  };

  assert.equal(shouldApplyRemoteSnapshot(localEdited, restartedServer, false), false);

  // Explicit RESET_DATA_DEMO generates an epoch_reset_* ID and DOES overwrite
  const base = makeBaseSnapshot();
  const afterReset = applyAuthoritativeStateUpdate({
    current: base,
    incoming: makeBaseSnapshot({ revision: 23 }),
    updatedBy: 'Admin Sekolah',
    lastAction: 'RESET_DATA_DEMO',
    defaultAccounts: INITIAL_ACCOUNTS,
  });
  assert.equal(isResetEpochId(afterReset.epochId), true);
  assert.equal(
    shouldApplyRemoteSnapshot(localEdited, {
      revision: afterReset.revision,
      updatedAt: afterReset.updatedAt,
      epochId: afterReset.epochId,
      lastAction: afterReset.lastAction,
    }),
    true
  );
});

test('RESTORE_CLIENT_STATE recovers created periods while preserving server votes', () => {
  const serverAfterRestart = makeBaseSnapshot({
    revision: 2,
    voters: INITIAL_VOTERS.map((v, idx) =>
      idx === 3 ? { ...v, hasVoted: true, votedAt: '2026-10-25T09:00:00Z' } : v
    ),
  });

  const restoredPeriod: ElectionPeriod = {
    id: 'period_2028_2029',
    schoolId: INITIAL_SCHOOL.id,
    periodName: 'Pemilihan OSIS 2028/2029',
    academicYear: '2028/2029',
    startDate: '2028-09-15',
    endDate: '2028-09-15',
    status: 'draft',
    votingOpenTime: '07:30',
    votingCloseTime: '15:00',
    createdAt: '2026-10-25T11:00:00.000Z',
  };

  const merged = applyAuthoritativeStateUpdate({
    current: serverAfterRestart,
    incoming: makeBaseSnapshot({
      revision: 20,
      periods: [...INITIAL_PERIODS, restoredPeriod],
      voters: INITIAL_VOTERS, // stale client copy where voter[3] hasn't voted yet
    }),
    updatedBy: 'Admin Sekolah',
    lastAction: 'RESTORE_CLIENT_STATE',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.ok(merged.periods.some((p) => p.id === 'period_2028_2029'));
  assert.equal(merged.voters[3].hasVoted, true);
});

test('Admin school identity, openingVideoEnabled, and changed passwords are NEVER reverted by Panitia or login actions', () => {
  const base = makeBaseSnapshot();

  // Admin updates school identity + disables/enables opening video
  const afterSchoolEdit = applyAuthoritativeStateUpdate({
    current: base,
    incoming: {
      revision: 11,
      school: {
        ...base.school,
        name: 'SMP NEGERI 1 NUSANTARA',
        openingVideoEnabled: false,
        email: '',
      },
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'UPDATE_KONFIGURASI_SEKOLAH',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(afterSchoolEdit.school.name, 'SMP NEGERI 1 NUSANTARA');
  assert.equal(afterSchoolEdit.school.openingVideoEnabled, false);
  assert.equal(afterSchoolEdit.school.email, '');

  // Admin changes password
  const afterPasswordEdit = applyAuthoritativeStateUpdate({
    current: afterSchoolEdit,
    incoming: {
      revision: 12,
      accounts: (afterSchoolEdit.accounts ?? []).map((acc) =>
        acc.role === 'admin' ? { ...acc, passwordPlain: 'custom_new_pass_999' } : acc
      ),
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'UPDATE_PASSWORD',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // Stale Panitia tab with INITIAL_SCHOOL & INITIAL_ACCOUNTS adds a voter
  const afterStalePanitiaAction = applyAuthoritativeStateUpdate({
    current: afterPasswordEdit,
    incoming: {
      revision: 12,
      school: INITIAL_SCHOOL,
      accounts: INITIAL_ACCOUNTS,
      voters: [
        ...afterPasswordEdit.voters,
        {
          id: 'voter_extra_1',
          electionPeriodId: 'period_2026_2027',
          nisn: '9998887771',
          fullName: 'Siswa Baru Stale Tab',
          className: 'VII A',
          gradeLevel: 'VII',
          gender: 'L',
          pinHash: 'stub_hash',
          tokenPrinted: false,
          hasVoted: false,
        },
      ],
    },
    updatedBy: 'Panitia',
    lastAction: 'TAMBAH_PEMILIH_DPT',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // Admin edits MUST remain intact!
  assert.equal(afterStalePanitiaAction.school.name, 'SMP NEGERI 1 NUSANTARA');
  assert.equal(afterStalePanitiaAction.school.openingVideoEnabled, false);
  assert.equal(afterStalePanitiaAction.school.email, '');
  assert.equal(
    afterStalePanitiaAction.accounts?.find((a) => a.role === 'admin')?.passwordPlain,
    'custom_new_pass_999'
  );
  assert.ok(afterStalePanitiaAction.voters.some((v) => v.id === 'voter_extra_1'));
});

test('Deleted period, candidate, voter, and committee member stay deleted via tombstones even after stale RESTORE_CLIENT_STATE', () => {
  const base = makeBaseSnapshot();
  const deletedPeriodId = base.periods[1].id;
  const deletedCandId = base.candidates[0].id;
  const deletedVoterId = base.voters[0].id;
  const deletedCommitteeId = base.committee[0].id;

  // 1. Delete candidate
  const afterCandDel = applyAuthoritativeStateUpdate({
    current: base,
    incoming: {
      revision: 11,
      candidates: base.candidates.filter((c) => c.id !== deletedCandId),
      votes: base.votes.filter((v) => v.candidateId !== deletedCandId),
      tombstones: { candidates: [deletedCandId] },
    },
    updatedBy: 'Panitia',
    lastAction: 'HAPUS_PASLON',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // 2. Delete voter
  const afterVoterDel = applyAuthoritativeStateUpdate({
    current: afterCandDel,
    incoming: {
      revision: 12,
      voters: afterCandDel.voters.filter((v) => v.id !== deletedVoterId),
      tombstones: { voters: [deletedVoterId] },
    },
    updatedBy: 'Panitia',
    lastAction: 'HAPUS_PEMILIH',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // 3. Delete committee member
  const afterCommDel = applyAuthoritativeStateUpdate({
    current: afterVoterDel,
    incoming: {
      revision: 13,
      committee: afterVoterDel.committee.filter((m) => m.id !== deletedCommitteeId),
      tombstones: { committee: [deletedCommitteeId] },
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'HAPUS_PANITIA',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // 4. Delete past period
  const afterPeriodDel = applyAuthoritativeStateUpdate({
    current: afterCommDel,
    incoming: {
      revision: 14,
      periods: afterCommDel.periods.filter((p) => p.id !== deletedPeriodId),
      tombstones: { periods: [deletedPeriodId] },
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'HAPUS_PERIODE',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  // Stale client reconnects carrying all old deleted records
  const afterStaleReconnect = applyAuthoritativeStateUpdate({
    current: afterPeriodDel,
    incoming: makeBaseSnapshot({ revision: 99 }),
    updatedBy: 'Stale Client',
    lastAction: 'RESTORE_CLIENT_STATE',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(afterStaleReconnect.periods.some((p) => p.id === deletedPeriodId), false);
  assert.equal(afterStaleReconnect.candidates.some((c) => c.id === deletedCandId), false);
  assert.equal(afterStaleReconnect.voters.some((v) => v.id === deletedVoterId), false);
  assert.equal(afterStaleReconnect.committee.some((m) => m.id === deletedCommitteeId), false);
});

test('HAPUS_PERIODE only tombstones entities inside the deleted period and preserves concurrent items on other periods', () => {
  const base = makeBaseSnapshot();
  const concurrentVoterOnActive = {
    id: 'voter_concurrent_active',
    electionPeriodId: base.periods[0].id,
    nisn: '9911223344',
    fullName: 'Siswa Aktif Konkuren',
    className: 'VII A',
    gradeLevel: 'VII',
    gender: 'L' as const,
    pinHash: 'hash_stub',
    tokenPrinted: false,
    hasVoted: false,
  };
  const currentWithConcurrent = {
    ...base,
    voters: [...base.voters, concurrentVoterOnActive],
  };

  // Client without concurrentVoterOnActive deletes periods[1]
  const deletedPeriodId = base.periods[1].id;
  const merged = applyAuthoritativeStateUpdate({
    current: currentWithConcurrent,
    incoming: {
      revision: 12,
      periods: base.periods.filter((p) => p.id !== deletedPeriodId),
      voters: base.voters.filter((v) => v.electionPeriodId !== deletedPeriodId),
      candidates: base.candidates.filter((c) => c.electionPeriodId !== deletedPeriodId),
      committee: base.committee.filter((m) => m.electionPeriodId !== deletedPeriodId),
      tombstones: { periods: [deletedPeriodId] },
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'HAPUS_PERIODE',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(merged.periods.some((p) => p.id === deletedPeriodId), false);
  assert.equal(merged.voters.some((v) => v.id === 'voter_concurrent_active'), true);
  assert.equal(merged.tombstones?.voters?.includes('voter_concurrent_active') || false, false);
});

test('skConfigsByPeriod deep-merges per period by newest updatedAt and ignores older stale overwrites', () => {
  const base = makeBaseSnapshot();
  const periodA = base.periods[0].id;
  const periodB = base.periods[1].id;

  const cfgA_old = {
    skNumber: '001/OLD',
    skDate: '2026-09-01',
    skCity: 'Jakarta',
    kopBarLine1: 'PEMDA LAMA',
    kopBarLine2: 'DINAS LAMA',
    showKopLine2: true,
    schoolCustomName: 'SMP TEST',
    schoolAddressText: 'Jl. Test',
    schoolPostalCode: '10000',
    schoolPhoneText: '021',
    schoolEmailText: 'a@test.sch.id',
    schoolWebsiteText: 'https://test.sch.id',
    schoolNpsnText: '12345',
    principalName: 'Kepsek A',
    principalNip: '111',
    principalRank: 'IV/a',
    supervisorName: 'Pembina A',
    supervisorRole: 'Pembina',
    supervisorNip: '222',
    eventName: 'Acara Lama',
    eventTheme: 'Tema Lama',
    academicYear: '2026/2027',
    eventDateText: 'Senin',
    eventTimeText: '08.00',
    eventLocation: 'Aula',
    menimbangList: ['Menimbang lama'],
    mengingatList: ['Mengingat lama'],
    memperhatikanText: 'Memperhatikan lama',
    diktumMenetapkan: 'Menetapkan lama',
    diktumKesatu: 'Kesatu lama',
    diktumKedua: 'Kedua lama',
    diktumKetiga: 'Ketiga lama',
    diktumKeempat: 'Keempat lama',
    pages: [],
    showQrCode: true,
    showStamp: true,
    showWatermark: false,
    updatedAt: '2026-10-01T08:00:00.000Z',
  };

  const cfgA_new = {
    ...cfgA_old,
    eventTheme: 'Tema Baru Permanen',
    diktumMenetapkan: 'Menetapkan Terbaru',
    updatedAt: '2026-10-02T10:00:00.000Z',
  };

  const cfgB = {
    ...cfgA_old,
    skNumber: '002/PERIODE-B',
    kopBarLine1: 'YAYASAN PERIODE B',
    updatedAt: '2026-10-02T09:00:00.000Z',
  };

  // Client 1 saves Period A (new) onto state that already had Period B
  const withBoth = applyAuthoritativeStateUpdate({
    current: {
      ...base,
      school: {
        ...base.school,
        skConfigsByPeriod: {
          [periodB]: cfgB,
        },
      },
    },
    incoming: {
      revision: 11,
      school: {
        ...base.school,
        kopBarLine1: 'PEMDA BARU',
        skConfigsByPeriod: {
          [periodA]: cfgA_new,
        },
      },
    },
    updatedBy: 'Admin Sekolah',
    lastAction: 'SYNC_UPDATE',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(withBoth.school.skConfigsByPeriod?.[periodA]?.eventTheme, 'Tema Baru Permanen');
  assert.equal(withBoth.school.skConfigsByPeriod?.[periodB]?.skNumber, '002/PERIODE-B');

  // Stale client sends RESTORE_CLIENT_STATE / UPDATE_PANITIA with cfgA_old -> newer cfgA_new must survive!
  const afterStale = applyAuthoritativeStateUpdate({
    current: withBoth,
    incoming: {
      revision: 10,
      school: {
        ...base.school,
        skConfigsByPeriod: {
          [periodA]: cfgA_old,
        },
      },
    },
    updatedBy: 'Panitia',
    lastAction: 'UPDATE_PANITIA',
    defaultAccounts: INITIAL_ACCOUNTS,
  });

  assert.equal(afterStale.school.skConfigsByPeriod?.[periodA]?.eventTheme, 'Tema Baru Permanen');
  assert.equal(afterStale.school.skConfigsByPeriod?.[periodA]?.diktumMenetapkan, 'Menetapkan Terbaru');
  assert.equal(afterStale.school.skConfigsByPeriod?.[periodB]?.skNumber, '002/PERIODE-B');
});


