/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-menu synchronization unit tests covering:
 * QuickCountDashboard, BilikSuara, PanitiaDashboard, and AdminDashboard state cohesion.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectionStore } from './store.ts';
import {
  calculateServerClockOffset,
  computeAppTimeMs,
  evaluateVotingSchedule,
  shouldApplyRemoteSnapshot,
} from './realtimeSync.ts';

test('Cross-menu identity & logo sync propagates from Admin/Panitia to all views', () => {
  const store = new ElectionStore();
  let notifications = 0;
  const unsub = store.subscribe(() => {
    notifications += 1;
  });

  store.updateSchool({
    name: 'SMP HARAPAN BANGSA',
    type: 'OSIM',
    npsn: '20599999',
    logoUrl: 'data:image/png;base64,SCHOOL_LOGO',
    osisLogoUrl: 'data:image/png;base64,OSIM_LOGO',
    openingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
  });

  const school = store.getSchool();
  assert.equal(school.name, 'SMP HARAPAN BANGSA');
  assert.equal(school.type, 'OSIM');
  assert.equal(school.logoUrl, 'data:image/png;base64,SCHOOL_LOGO');
  assert.equal(school.osisLogoUrl, 'data:image/png;base64,OSIM_LOGO');
  assert.equal(school.openingVideoUrl, 'https://youtu.be/dQw4w9WgXcQ');
  assert.ok(notifications >= 1);

  unsub();
});

test('Multi-period creation, committee SK sync, DPT, and QuickCount/BilikSuara isolation', () => {
  const store = new ElectionStore();
  const initialActive = store.getActivePeriod();
  const initialStats = store.getPeriodStats(initialActive.id);

  // Create a new draft period via Admin
  const draftPeriod = store.addPeriod({
    schoolId: store.getSchool().id,
    periodName: 'Pemilihan OSIS 2028/2029',
    academicYear: '2028/2029',
    startDate: '2028-09-10',
    endDate: '2028-09-10',
    votingOpenTime: '07:30',
    votingCloseTime: '14:30',
    status: 'draft',
    description: 'Periode masa depan',
  });

  // Active period remains untouched
  assert.equal(store.getActivePeriod().id, initialActive.id);

  // Panitia prepares candidates & DPT specifically for draftPeriod
  const addedCand = store.addCandidate({
    electionPeriodId: draftPeriod.id,
    ballotNumber: 1,
    chairmanName: 'Raka Pratama',
    viceChairmanName: 'Nadia Putri',
    chairmanClass: 'VIII A',
    viceChairmanClass: 'VII B',
    photoUrl: '',
    motto: 'Maju Bersama',
    vision: 'Sekolah unggul dan berkarakter',
    mission: ['Misi 1'],
    programs: ['Program 1'],
  });

  const voterRes = store.addVoter(
    {
      nisn: '9988776655',
      fullName: 'Siti Aminah',
      className: 'VIII A',
      gradeLevel: 'VIII',
      gender: 'P',
    },
    draftPeriod.id
  );
  assert.equal(voterRes.success, true);
  assert.ok(voterRes.voter?.pinPlain);

  // Admin adds & edits & deletes SK Panitia on draftPeriod
  const addedComm = store.addCommitteeMember({
    electionPeriodId: draftPeriod.id,
    memberName: 'Bapak Ahmad',
    role: 'Ketua Panitia',
    className: 'Pembina',
    skNumber: '001/SK/2028',
    skDate: '2028-09-01',
    email: 'ahmad@sekolah.id',
  });
  store.updateCommitteeMember(addedComm.id, { role: 'Koordinator IT & Bilik' });
  assert.equal(store.getCommittee(draftPeriod.id)[0].role, 'Koordinator IT & Bilik');

  // Verify initial active period stats did NOT change
  const afterStats = store.getPeriodStats(initialActive.id);
  assert.deepEqual(afterStats, initialStats);

  // Activate draftPeriod -> BilikSuara, QuickCount, Admin, and Panitia now share draftPeriod as active
  store.setActivePeriod(draftPeriod.id);
  assert.equal(store.getActivePeriod().id, draftPeriod.id);

  // BilikSuara verifies voter login and casts ballot
  const loginRes = store.verifyVoterLogin('9988776655', voterRes.voter!.pinPlain!);
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.voter?.id, voterRes.voter!.id);

  const voteRes = store.submitAnonymousVote(voterRes.voter!.id, addedCand.id);
  assert.equal(voteRes.success, true);

  // QuickCount & Panitia monitoring getSummary() immediately reflects the cast vote
  const summary = store.getSummary(draftPeriod.id);
  assert.equal(summary.totalVoters, 1);
  assert.equal(summary.totalVoted, 1);
  assert.equal(summary.totalUnvoted, 0);
  assert.equal(summary.participationPercentage, 100);
  assert.equal(summary.candidatesResults[0].voteCount, 1);
  assert.equal(summary.classParticipation[0].className, 'VIII A');
  assert.equal(summary.classParticipation[0].voted, 1);

  // Deleting committee member logs audit trail & updates committee list
  store.deleteCommitteeMember(addedComm.id);
  assert.equal(store.getCommittee(draftPeriod.id).length, 0);
  assert.ok(store.getAuditLogs().some((l) => l.action === 'HAPUS_PANITIA'));
});

test('Realtime sync helpers compute unified clock, voting schedule, and remote precedence accurately', () => {
  const offset = calculateServerClockOffset(2000, 1100, 1000);
  assert.equal(offset, 950);

  const appTime = computeAppTimeMs(5000, offset, 60000);
  assert.equal(appTime, 65950);

  const openPeriod = {
    status: 'active' as const,
    votingOpenTime: '07:30',
    votingCloseTime: '15:00',
  };

  // Set local time to 10:00
  const tenAm = new Date(2026, 7, 17, 10, 0, 0).getTime();
  assert.equal(evaluateVotingSchedule(openPeriod, tenAm).state, 'OPEN');

  const sixAm = new Date(2026, 7, 17, 6, 0, 0).getTime();
  assert.equal(evaluateVotingSchedule(openPeriod, sixAm).state, 'BEFORE_OPEN');

  const fourPm = new Date(2026, 7, 17, 16, 0, 0).getTime();
  assert.equal(evaluateVotingSchedule(openPeriod, fourPm).state, 'AFTER_CLOSE');

  // Uninitialized remote snapshot must NOT overwrite edited local state
  assert.equal(
    shouldApplyRemoteSnapshot(
      { revision: 5, updatedAt: '2026-08-17T10:00:00.000Z', epochId: 'ep1', lastAction: 'UPDATE' },
      { revision: 1, updatedAt: '2026-08-17T09:00:00.000Z', epochId: 'ep2', lastAction: 'INIT_SYSTEM' }
    ),
    false
  );

  // Higher revision on same epoch applies cleanly
  assert.equal(
    shouldApplyRemoteSnapshot(
      { revision: 5, updatedAt: '2026-08-17T10:00:00.000Z', epochId: 'ep1', lastAction: 'UPDATE' },
      { revision: 6, updatedAt: '2026-08-17T10:01:00.000Z', epochId: 'ep1', lastAction: 'VOTE_CAST' }
    ),
    true
  );
});
