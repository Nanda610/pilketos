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

test('SK Panitia and BAHP text customizations persist permanently without reverting on updates', () => {
  const store = new ElectionStore();
  const activePeriod = store.getActivePeriod();

  store.updateSchool({
    kopBarLine1: 'YAYASAN PENDIDIKAN ISLAM HARAPAN',
    kopBarLine2: 'MAJELIS PENDIDIKAN DASAR DAN MENENGAH',
    showKopLine2: true,
    skConfigsByPeriod: {
      [activePeriod.id]: {
        skNumber: '421.3/999/SK-KS/OSIS/2026',
        skDate: '2026-10-01',
        skCity: 'Bandung',
        kopBarLine1: 'YAYASAN PENDIDIKAN ISLAM HARAPAN',
        kopBarLine2: 'MAJELIS PENDIDIKAN DASAR DAN MENENGAH',
        showKopLine2: true,
        schoolCustomName: 'SMP ISLAM HARAPAN',
        schoolAddressText: 'Jl. Merdeka No. 10',
        schoolPostalCode: '40111',
        schoolPhoneText: '(022) 123456',
        schoolEmailText: 'admin@harapan.sch.id',
        schoolWebsiteText: 'https://harapan.sch.id',
        schoolNpsnText: '20299999',
        principalName: 'Dr. Ahmad Fauzi, M.Pd',
        principalNip: '19750101 200001 1 001',
        principalRank: 'Pembina Tingkat I / IV-b',
        supervisorName: 'Siti Rahma, S.Pd',
        supervisorRole: 'Pembina OSIS',
        supervisorNip: '19850202 201001 2 002',
        eventName: 'Pemilihan Ketua OSIS 2026',
        eventTheme: 'Suara Kita Masa Depan Sekolah',
        academicYear: '2026/2027',
        eventDateText: 'Rabu, 28 Oktober 2026',
        eventTimeText: '07.30 - 13.00 WIB',
        eventLocation: 'Aula Utama',
        menimbangList: ['Poin menimbang kustom 1'],
        mengingatList: ['Poin mengingat kustom 1'],
        memperhatikanText: 'Hasil rapat kustom pengurus',
        diktumMenetapkan: 'Penetapan kustom panitia',
        diktumKesatu: 'Diktum kesatu kustom',
        diktumKedua: 'Diktum kedua kustom',
        diktumKetiga: 'Diktum ketiga kustom',
        diktumKeempat: 'Diktum keempat kustom',
        pages: [
          {
            id: 'page-1',
            pageNumber: 1,
            type: 'main_sk',
            title: 'SK UTAMA KUSTOM',
            subtitle: 'SUBJUDUL KUSTOM',
          },
        ],
        showQrCode: true,
        showStamp: true,
        showWatermark: true,
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
    },
  });

  // Subsequent non-school mutations (period update, committee update) must NOT reset skConfigsByPeriod or kopBarLine1
  const comm = store.addCommitteeMember({
    electionPeriodId: activePeriod.id,
    memberName: 'Budi Santoso',
    role: 'Ketua Panitia',
    className: 'VIII C',
    duties: 'Tugas kustom ketua panitia',
    skNumber: '421.3/999/SK-KS/OSIS/2026',
    skDate: '2026-10-01',
    email: 'budi@harapan.sch.id',
  });
  store.updateCommitteeMember(comm.id, {
    className: 'IX A',
    duties: 'Mengelola jalannya pleno dan berita acara',
  });

  const savedSchool = store.getSchool();
  assert.equal(savedSchool.kopBarLine1, 'YAYASAN PENDIDIKAN ISLAM HARAPAN');
  assert.equal(savedSchool.kopBarLine2, 'MAJELIS PENDIDIKAN DASAR DAN MENENGAH');
  assert.equal(savedSchool.showKopLine2, true);
  assert.equal(savedSchool.skConfigsByPeriod?.[activePeriod.id]?.principalRank, 'Pembina Tingkat I / IV-b');
  assert.equal(savedSchool.skConfigsByPeriod?.[activePeriod.id]?.eventTheme, 'Suara Kita Masa Depan Sekolah');
  assert.equal(savedSchool.skConfigsByPeriod?.[activePeriod.id]?.menimbangList[0], 'Poin menimbang kustom 1');

  const savedComm = store.getCommittee(activePeriod.id).find((m) => m.id === comm.id);
  assert.equal(savedComm?.className, 'IX A');
  assert.equal(savedComm?.duties, 'Mengelola jalannya pleno dan berita acara');
});

test('runBatch commits school, SK, period, and committee updates in one atomic revision and preserves edits under concurrent remote sync', () => {
  const store = new ElectionStore();
  const activePeriod = store.getActivePeriod();
  const startRev = store.getSyncMetadata().revision;

  let notifyCount = 0;
  const unsub = store.subscribe(() => {
    notifyCount += 1;
  });

  store.runBatch(
    () => {
      store.updateSchool({
        kopBarLine1: 'YAYASAN NUSANTARA SEJATI',
        kopBarLine2: 'BIDANG PENDIDIKAN MENENGAH',
        skConfigsByPeriod: {
          [activePeriod.id]: {
            skNumber: '421.3/777/SK/2026',
            skDate: '2026-10-05',
            skCity: 'Surabaya',
            kopBarLine1: 'YAYASAN NUSANTARA SEJATI',
            kopBarLine2: 'BIDANG PENDIDIKAN MENENGAH',
            showKopLine2: true,
            schoolCustomName: 'SMP NUSANTARA',
            schoolAddressText: 'Jl. Pahlawan No. 1',
            schoolPostalCode: '60111',
            schoolPhoneText: '031-5551234',
            schoolEmailText: 'smp@nusantara.sch.id',
            schoolWebsiteText: 'https://nusantara.sch.id',
            schoolNpsnText: '20577777',
            principalName: 'Dr. Budi Hartono',
            principalNip: '19700101 199501 1 001',
            principalRank: 'Pembina Utama / IV-d',
            supervisorName: 'Sari Dewi, M.Pd',
            supervisorRole: 'Wakasek Kesiswaan',
            supervisorNip: '19800202 200501 2 002',
            eventName: 'Pilketos Serentak 2026',
            eventTheme: 'Demokrasi Cerdas',
            academicYear: '2026/2027',
            eventDateText: 'Selasa, 20 Oktober 2026',
            eventTimeText: '07.30 - 14.00 WIB',
            eventLocation: 'Aula Nusantara',
            menimbangList: ['Pertimbangan utama batch'],
            mengingatList: ['Dasar hukum batch'],
            memperhatikanText: 'Hasil rapat pleno batch',
            diktumMenetapkan: 'Menetapkan Panitia Pilketos Serentak 2026',
            diktumKesatu: 'Kesatu batch',
            diktumKedua: 'Kedua batch',
            diktumKetiga: 'Ketiga batch',
            diktumKeempat: 'Keempat batch',
            pages: [],
            showQrCode: true,
            showStamp: true,
            showWatermark: false,
            updatedAt: '2026-10-05T09:00:00.000Z',
          },
        },
      });

      store.updatePeriod(activePeriod.id, {
        periodName: 'Pilketos Serentak 2026',
      });

      const created = store.addCommitteeMember({
        id: 'comm_stable_test_1',
        electionPeriodId: activePeriod.id,
        memberName: 'Hendra Wijaya',
        role: 'Ketua Panitia',
        className: 'IX B',
        duties: 'Tugas stabil panitia',
        skNumber: '421.3/777/SK/2026',
        skDate: '2026-10-05',
        email: 'hendra@nusantara.sch.id',
      });
      assert.equal(created.id, 'comm_stable_test_1');
    },
    'Admin Sekolah',
    'SYNC_UPDATE'
  );

  // Batch must produce exactly 1 notification & +1 revision with SYNC_UPDATE
  assert.equal(notifyCount, 1);
  assert.equal(store.getSyncMetadata().revision, startRev + 1);
  assert.equal(store.getSyncMetadata().lastAction, 'SYNC_UPDATE');

  // Simulate concurrent remote vote/update arriving while local changes have not yet been ACKed
  const concurrentServerSnap = store.getSnapshot();
  store.applyRemoteSnapshot({
    ...concurrentServerSnap,
    revision: startRev + 1,
    lastAction: 'TRANSAKSI_SUARA_ANONIM',
    school: {
      ...concurrentServerSnap.school,
      kopBarLine1: 'DEFAULT STALE SERVER KOP',
      skConfigsByPeriod: undefined,
    },
  });

  // Local edited Kop Surat and SK config MUST remain intact (never reverted!)
  const afterConcurrent = store.getSchool();
  assert.equal(afterConcurrent.kopBarLine1, 'YAYASAN NUSANTARA SEJATI');
  assert.equal(afterConcurrent.skConfigsByPeriod?.[activePeriod.id]?.diktumMenetapkan, 'Menetapkan Panitia Pilketos Serentak 2026');
  assert.equal(store.getCommittee(activePeriod.id).some((m) => m.id === 'comm_stable_test_1'), true);

  unsub();
});


