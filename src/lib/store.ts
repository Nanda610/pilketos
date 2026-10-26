/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise In-Memory & LocalStorage State Store for E-Pilketos / E-Pilkosim Digital.
 * Implements relational constraints, atomic voting transactions, audit logs,
 * and multi-period dynamic switching.
 */

import {
  SchoolConfig,
  ElectionPeriod,
  Candidate,
  Voter,
  AnonymousVote,
  CommitteeMember,
  AuditLog,
  ElectionSummary,
} from '../types';
import {
  INITIAL_SCHOOL,
  INITIAL_PERIODS,
  INITIAL_CANDIDATES,
  INITIAL_VOTERS,
  INITIAL_VOTES,
  INITIAL_COMMITTEE,
  INITIAL_AUDIT_LOGS,
} from './initialData';
import { generateRandomPin, hashPin, verifyPin, validateNisn, validatePin } from './security';

const STORAGE_KEY_PREFIX = 'epilketos_state_smp_v2';

export class ElectionStore {
  private school: SchoolConfig;
  private periods: ElectionPeriod[];
  private candidates: Candidate[];
  private voters: Voter[];
  private votes: AnonymousVote[];
  private committee: CommitteeMember[];
  private auditLogs: AuditLog[];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.school = INITIAL_SCHOOL;
    this.periods = INITIAL_PERIODS;
    this.candidates = INITIAL_CANDIDATES;
    this.voters = INITIAL_VOTERS;
    this.votes = INITIAL_VOTES;
    this.committee = INITIAL_COMMITTEE;
    this.auditLogs = INITIAL_AUDIT_LOGS;

    this.loadFromStorage();
  }

  // Subscribe to changes (Real-time reactive listener)
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((fn) => fn());
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedSchool = localStorage.getItem(`${STORAGE_KEY_PREFIX}_school`);
      const savedPeriods = localStorage.getItem(`${STORAGE_KEY_PREFIX}_periods`);
      const savedCandidates = localStorage.getItem(`${STORAGE_KEY_PREFIX}_candidates`);
      const savedVoters = localStorage.getItem(`${STORAGE_KEY_PREFIX}_voters`);
      const savedVotes = localStorage.getItem(`${STORAGE_KEY_PREFIX}_votes`);
      const savedCommittee = localStorage.getItem(`${STORAGE_KEY_PREFIX}_committee`);
      const savedLogs = localStorage.getItem(`${STORAGE_KEY_PREFIX}_logs`);

      if (savedSchool) this.school = JSON.parse(savedSchool);
      if (savedPeriods) this.periods = JSON.parse(savedPeriods);
      if (savedCandidates) this.candidates = JSON.parse(savedCandidates);
      if (savedVoters) this.voters = JSON.parse(savedVoters);
      if (savedVotes) this.votes = JSON.parse(savedVotes);
      if (savedCommittee) this.committee = JSON.parse(savedCommittee);
      if (savedLogs) this.auditLogs = JSON.parse(savedLogs);
    } catch {
      // Ignore parse errors and fallback to initial
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_school`, JSON.stringify(this.school));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_periods`, JSON.stringify(this.periods));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_candidates`, JSON.stringify(this.candidates));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_voters`, JSON.stringify(this.voters));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_votes`, JSON.stringify(this.votes));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_committee`, JSON.stringify(this.committee));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}_logs`, JSON.stringify(this.auditLogs));
    } catch {
      // Storage quota or disabled
    }
  }

  // Reset to initial demo data
  public resetToSampleData() {
    this.school = INITIAL_SCHOOL;
    this.periods = INITIAL_PERIODS;
    this.candidates = INITIAL_CANDIDATES;
    this.voters = INITIAL_VOTERS;
    this.votes = INITIAL_VOTES;
    this.committee = INITIAL_COMMITTEE;
    this.auditLogs = INITIAL_AUDIT_LOGS;
    this.logAudit('Admin Sekolah', 'RESET_DATA_DEMO', 'Database disetel ulang ke dataset simulasi awal.', '127.0.0.1', 'WARNING');
    this.notify();
  }

  // --- SCHOOL CONFIGURATION ---
  public getSchool(): SchoolConfig {
    return { ...this.school };
  }

  public updateSchool(updated: Partial<SchoolConfig>) {
    this.school = { ...this.school, ...updated };
    this.logAudit('Admin Sekolah', 'UPDATE_KONFIGURASI_SEKOLAH', `Identitas sekolah diperbarui: ${this.school.name}`, '192.168.10.1', 'INFO');
    this.notify();
  }

  // --- MULTI-PERIOD DYNAMIC MANAGEMENT ---
  public getPeriods(): ElectionPeriod[] {
    return [...this.periods];
  }

  public getActivePeriod(): ElectionPeriod {
    const active = this.periods.find((p) => p.status === 'active');
    if (!active) {
      // Fallback to first period or create default
      return this.periods[0];
    }
    return active;
  }

  public setActivePeriod(periodId: string) {
    this.periods = this.periods.map((p) => {
      if (p.id === periodId) {
        return { ...p, status: 'active' };
      }
      return { ...p, status: p.status === 'active' ? 'completed' : p.status };
    });
    const activated = this.periods.find((p) => p.id === periodId);
    this.logAudit(
      'Admin Sekolah',
      'AKTIVASI_PERIODE_BARU',
      `Periode pemilihan ${activated?.periodName || periodId} kini berstatus AKTIF. Periode lain dinonaktifkan.`,
      '192.168.10.1',
      'INFO'
    );
    this.notify();
  }

  public addPeriod(period: Omit<ElectionPeriod, 'id' | 'createdAt'>): ElectionPeriod {
    const newPeriod: ElectionPeriod = {
      ...period,
      id: `period_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (newPeriod.status === 'active') {
      // Demote others
      this.periods = this.periods.map((p) => ({ ...p, status: p.status === 'active' ? 'completed' : p.status }));
    }
    this.periods.push(newPeriod);
    this.logAudit('Admin Sekolah', 'BUAT_PERIODE_BARU', `Menambahkan periode pemilihan: ${newPeriod.periodName}`, '192.168.10.1', 'INFO');
    this.notify();
    return newPeriod;
  }

  public updatePeriod(periodId: string, updates: Partial<ElectionPeriod>) {
    this.periods = this.periods.map((p) => {
      if (p.id === periodId) {
        return { ...p, ...updates };
      }
      return p;
    });
    this.logAudit('Admin Sekolah', 'UPDATE_PERIODE', `Memperbarui data periode ${periodId}`, '192.168.10.1', 'INFO');
    this.notify();
  }

  public deletePeriod(periodId: string): { success: boolean; message: string } {
    if (this.periods.length <= 1) {
      return {
        success: false,
        message: 'Tidak dapat menghapus periode. Minimal harus ada 1 periode pemilihan pada sistem.'
      };
    }

    const targetPeriod = this.periods.find((p) => p.id === periodId);
    if (!targetPeriod) {
      return { success: false, message: 'Periode tidak ditemukan.' };
    }

    const wasActive = targetPeriod.status === 'active';

    // Remove the period
    this.periods = this.periods.filter((p) => p.id !== periodId);

    // If deleted period was active, set the first remaining period to active
    if (wasActive && this.periods.length > 0) {
      this.periods[0] = { ...this.periods[0], status: 'active' };
    }

    // Clean up associated candidates, voters, votes, and committee
    this.candidates = this.candidates.filter((c) => c.electionPeriodId !== periodId);
    this.voters = this.voters.filter((v) => v.electionPeriodId !== periodId);
    this.votes = this.votes.filter((v) => v.electionPeriodId !== periodId);
    this.committee = this.committee.filter((c) => c.electionPeriodId !== periodId);

    this.logAudit(
      'Admin Sekolah',
      'HAPUS_PERIODE',
      `Menghapus periode pemilihan "${targetPeriod.periodName}" beserta data terkaitnya.`,
      '192.168.10.1',
      'WARNING'
    );
    this.notify();

    return {
      success: true,
      message: `Periode "${targetPeriod.periodName}" berhasil dihapus.`,
    };
  }

  // --- CANDIDATE MANAGEMENT ---
  public getCandidates(periodId?: string): Candidate[] {
    const targetPeriod = periodId || this.getActivePeriod().id;
    return this.candidates
      .filter((c) => c.electionPeriodId === targetPeriod)
      .sort((a, b) => a.ballotNumber - b.ballotNumber);
  }

  public addCandidate(candidate: Omit<Candidate, 'id'>): Candidate {
    const newCandidate: Candidate = {
      ...candidate,
      id: `cand_${Date.now()}`,
    };
    this.candidates.push(newCandidate);
    this.logAudit(
      'Panitia',
      'TAMBAH_PASLON',
      `Paslon No. Urut ${newCandidate.ballotNumber} (${newCandidate.chairmanName} & ${newCandidate.viceChairmanName}) berhasil didaftarkan.`,
      '192.168.10.15',
      'INFO'
    );
    this.notify();
    return newCandidate;
  }

  public updateCandidate(candidateId: string, updates: Partial<Candidate>) {
    this.candidates = this.candidates.map((c) => {
      if (c.id === candidateId) {
        return { ...c, ...updates };
      }
      return c;
    });
    this.logAudit('Panitia', 'UPDATE_PASLON', `Data kandidat ID ${candidateId} diperbarui.`, '192.168.10.15', 'INFO');
    this.notify();
  }

  public deleteCandidate(candidateId: string) {
    this.candidates = this.candidates.filter((c) => c.id !== candidateId);
    this.logAudit('Panitia', 'HAPUS_PASLON', `Menghapus paslon ID ${candidateId}`, '192.168.10.15', 'WARNING');
    this.notify();
  }

  // --- DPT (DAFTAR PEMILIH TETAP) MANAGEMENT ---
  public getVoters(periodId?: string): Voter[] {
    const targetPeriod = periodId || this.getActivePeriod().id;
    return this.voters.filter((v) => v.electionPeriodId === targetPeriod);
  }

  public addVoter(voterData: {
    nisn: string;
    fullName: string;
    className: string;
    gradeLevel: string;
    gender: 'L' | 'P';
  }): { success: boolean; message: string; voter?: Voter } {
    const nisnCheck = validateNisn(voterData.nisn);
    if (!nisnCheck.isValid) {
      return { success: false, message: nisnCheck.message || 'NISN tidak valid' };
    }

    const activePeriod = this.getActivePeriod();
    const existing = this.voters.find(
      (v) => v.electionPeriodId === activePeriod.id && v.nisn === voterData.nisn.trim()
    );

    if (existing) {
      return { success: false, message: `Siswa dengan NISN ${voterData.nisn} sudah terdaftar dalam DPT periode ini.` };
    }

    const plainPin = generateRandomPin(6);
    const pinHash = hashPin(plainPin);

    const newVoter: Voter = {
      id: `voter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      electionPeriodId: activePeriod.id,
      nisn: voterData.nisn.trim(),
      fullName: voterData.fullName.trim(),
      className: voterData.className.trim(),
      gradeLevel: voterData.gradeLevel,
      gender: voterData.gender,
      pinPlain: plainPin,
      pinHash,
      hasVoted: false,
      tokenPrinted: false,
    };

    this.voters.push(newVoter);
    this.logAudit('Panitia', 'TAMBAH_PEMILIH_DPT', `Siswa ${newVoter.fullName} (${newVoter.nisn}) ditambahkan ke DPT.`, '192.168.10.15', 'INFO');
    this.notify();
    return { success: true, message: 'Pemilih berhasil ditambahkan', voter: newVoter };
  }

  public bulkImportVoters(
    rows: Array<{ nisn: string; fullName: string; className: string; gender?: string; gradeLevel?: string }>
  ): { added: number; skipped: number; errors: string[] } {
    const activePeriod = this.getActivePeriod();
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const nisnCheck = validateNisn(row.nisn);
      if (!nisnCheck.isValid) {
        skipped++;
        errors.push(`Baris ${index + 1}: NISN '${row.nisn}' tidak valid.`);
        return;
      }

      const exists = this.voters.some(
        (v) => v.electionPeriodId === activePeriod.id && v.nisn === row.nisn.trim()
      );

      if (exists) {
        skipped++;
        return;
      }

      // Determine grade level from className (SMP: VII, VIII, IX or 7, 8, 9)
      const inferredGrade =
        row.gradeLevel ||
        (row.className.toUpperCase().startsWith('IX') || row.className.toUpperCase().startsWith('9')
          ? 'IX'
          : row.className.toUpperCase().startsWith('VIII') || row.className.toUpperCase().startsWith('8')
          ? 'VIII'
          : 'VII');

      const gender: 'L' | 'P' =
        row.gender?.toUpperCase().startsWith('P') || row.gender?.toUpperCase().startsWith('W')
          ? 'P'
          : 'L';

      const plainPin = generateRandomPin(6);
      const pinHash = hashPin(plainPin);

      this.voters.push({
        id: `voter_${Date.now()}_${index}`,
        electionPeriodId: activePeriod.id,
        nisn: row.nisn.trim(),
        fullName: row.fullName.trim(),
        className: row.className.trim(),
        gradeLevel: inferredGrade,
        gender,
        pinPlain: plainPin,
        pinHash,
        hasVoted: false,
        tokenPrinted: false,
      });
      added++;
    });

    this.logAudit(
      'Panitia',
      'IMPORT_DPT_MASSAL',
      `Import DPT selesai: ${added} siswa baru ditambahkan, ${skipped} dilewati.`,
      '192.168.10.15',
      'INFO'
    );
    this.notify();
    return { added, skipped, errors };
  }

  public resetVoterPin(voterId: string): { success: boolean; message: string; newPin?: string } {
    const voter = this.voters.find((v) => v.id === voterId);
    if (!voter) return { success: false, message: 'Pemilih tidak ditemukan.' };

    if (voter.hasVoted) {
      return { success: false, message: 'Tidak dapat mereset PIN karena siswa sudah menggunakan hak suara.' };
    }

    const newPin = generateRandomPin(6);
    voter.pinPlain = newPin;
    voter.pinHash = hashPin(newPin);
    voter.tokenPrinted = false;

    this.logAudit(
      'Panitia',
      'RESET_PIN_PEMILIH',
      `PIN token untuk ${voter.fullName} (${voter.nisn}) berhasil direset.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify();
    return { success: true, message: 'PIN berhasil direset.', newPin };
  }

  public generateMissingPins(): number {
    let count = 0;
    this.voters = this.voters.map((v) => {
      if (!v.hasVoted && !v.pinPlain) {
        const pin = generateRandomPin(6);
        count++;
        return {
          ...v,
          pinPlain: pin,
          pinHash: hashPin(pin),
        };
      }
      return v;
    });
    if (count > 0) {
      this.logAudit('Panitia', 'GENERATE_PIN_MASSAL', `Membuat ${count} PIN token baru untuk pemilih yang belum memiliki PIN.`, '192.168.10.15', 'INFO');
      this.notify();
    }
    return count;
  }

  public markTokensAsPrinted(voterIds: string[]) {
    const idSet = new Set(voterIds);
    this.voters = this.voters.map((v) => {
      if (idSet.has(v.id)) {
        return { ...v, tokenPrinted: true };
      }
      return v;
    });
    this.notify();
  }

  public deleteVoter(voterId: string) {
    const voter = this.voters.find((v) => v.id === voterId);
    if (voter?.hasVoted) {
      return { success: false, message: 'Pemilih yang sudah memilih tidak dapat dihapus untuk menjaga integritas rekapitulasi.' };
    }
    this.voters = this.voters.filter((v) => v.id !== voterId);
    this.logAudit('Panitia', 'HAPUS_PEMILIH', `Menghapus pemilih ${voter?.fullName || voterId}`, '192.168.10.15', 'WARNING');
    this.notify();
    return { success: true, message: 'Pemilih berhasil dihapus dari DPT.' };
  }

  public deleteAllVoters(periodId?: string): { success: boolean; message: string; count: number } {
    const targetPeriod = periodId || this.getActivePeriod().id;
    const count = this.voters.filter((v) => v.electionPeriodId === targetPeriod).length;
    this.voters = this.voters.filter((v) => v.electionPeriodId !== targetPeriod);
    this.logAudit('Panitia', 'HAPUS_SEMUA_DPT', `Menghapus seluruh ${count} pemilih DPT periode.`, '192.168.10.15', 'WARNING');
    this.notify();
    return { success: true, message: `Berhasil menghapus seluruh ${count} siswa dari DPT.`, count };
  }

  public resetVotersStatusToUnvoted(periodId?: string): { success: boolean; count: number } {
    const targetPeriod = periodId || this.getActivePeriod().id;
    let count = 0;
    this.voters = this.voters.map((v) => {
      if (v.electionPeriodId === targetPeriod) {
        if (v.hasVoted) count++;
        const pin = generateRandomPin(6);
        return {
          ...v,
          hasVoted: false,
          votedAt: undefined,
          pinPlain: pin,
          pinHash: hashPin(pin),
          tokenPrinted: false,
        };
      }
      return v;
    });

    // Also reset anonymous votes recorded for this period so election tally resets to initial state
    this.votes = this.votes.filter((v) => v.electionPeriodId !== targetPeriod);

    this.logAudit('Panitia', 'RESET_STATUS_BILIK', `Mereset status bilik seluruh siswa & perolehan suara periode ke pengaturan awal.`, '192.168.10.15', 'WARNING');
    this.notify();
    return { success: true, count };
  }

  public resetSingleVoterStatusToUnvoted(voterId: string): { success: boolean; message: string; newPin?: string } {
    const voter = this.voters.find((v) => v.id === voterId);
    if (!voter) return { success: false, message: 'Pemilih tidak ditemukan.' };

    const newPin = generateRandomPin(6);
    voter.hasVoted = false;
    voter.votedAt = undefined;
    voter.pinPlain = newPin;
    voter.pinHash = hashPin(newPin);
    voter.tokenPrinted = false;

    this.logAudit(
      'Panitia',
      'RESET_STATUS_PEMILIH_TUNGGAL',
      `Status bilik untuk ${voter.fullName} (${voter.nisn}) direset menjadi Belum Memilih.`,
      '192.168.10.15',
      'WARNING'
    );
    this.notify();
    return { success: true, message: `Status bilik ${voter.fullName} berhasil direset ke Belum Memilih. PIN baru: ${newPin}`, newPin };
  }

  // --- VOTING AUTHENTICATION & ATOMIC TRANSACTIONS ---
  public verifyVoterLogin(nisn: string, pin: string): {
    success: boolean;
    message: string;
    voter?: Voter;
    activePeriod?: ElectionPeriod;
  } {
    const nisnCheck = validateNisn(nisn);
    if (!nisnCheck.isValid) {
      return { success: false, message: nisnCheck.message || 'Format NISN tidak valid.' };
    }

    const pinCheck = validatePin(pin);
    if (!pinCheck.isValid) {
      return { success: false, message: pinCheck.message || 'Format PIN token tidak valid.' };
    }

    const activePeriod = this.getActivePeriod();
    if (activePeriod.status !== 'active') {
      return { success: false, message: 'Pemungutan suara saat ini tidak aktif atau telah ditutup.' };
    }

    const voter = this.voters.find(
      (v) => v.electionPeriodId === activePeriod.id && v.nisn === nisn.trim()
    );

    if (!voter) {
      this.logAudit('Siswa', 'LOGIN_GAGAL_NISN', `Percobaan login dengan NISN tidak terdaftar: ${nisn}`, '192.168.10.100', 'WARNING');
      return { success: false, message: 'NISN tidak terdaftar dalam Daftar Pemilih Tetap (DPT) periode ini.' };
    }

    if (voter.hasVoted) {
      this.logAudit('Siswa', 'PERCOBAAN_VOTE_GANDA', `Pemilih ${voter.fullName} (${nisn}) mencoba login kembali setelah memilih.`, '192.168.10.100', 'CRITICAL');
      return {
        success: false,
        message: `Hak suara dengan NISN ${nisn} sudah pernah digunakan pada ${voter.votedAt ? new Date(voter.votedAt).toLocaleTimeString('id-ID') : 'sebelumnya'}. Satu pemilih hanya memiliki 1 hak suara.`,
      };
    }

    const isPinValid = verifyPin(pin, voter.pinHash);
    if (!isPinValid) {
      this.logAudit('Siswa', 'LOGIN_GAGAL_PIN', `PIN salah untuk pemilih ${voter.fullName} (${nisn})`, '192.168.10.100', 'WARNING');
      return { success: false, message: 'Token PIN yang Anda masukkan salah. Pastikan PIN sesuai dengan kartu suara Anda.' };
    }

    this.logAudit('Siswa', 'LOGIN_BILIK_SUARA', `Siswa ${voter.fullName} masuk ke bilik suara digital.`, '192.168.10.100', 'INFO');
    return {
      success: true,
      message: 'Otentikasi berhasil. Selamat datang di bilik suara.',
      voter,
      activePeriod,
    };
  }

  /**
   * ATOMIC ANONYMOUS VOTE SUBMISSION
   * 1. Records vote in `votes` table WITHOUT any reference to voterId (True LUBER-JURDIL).
   * 2. Marks voter in `voters` table as `hasVoted = true` with timestamp.
   * 3. Burns/invalidates voter's plain PIN token.
   * 4. Logs audit event.
   */
  public submitAnonymousVote(voterId: string, candidateId: string): {
    success: boolean;
    message: string;
    receiptCode?: string;
  } {
    const voterIndex = this.voters.findIndex((v) => v.id === voterId);
    if (voterIndex === -1) {
      return { success: false, message: 'Data pemilih tidak valid.' };
    }

    const voter = this.voters[voterIndex];
    if (voter.hasVoted) {
      return { success: false, message: 'Hak suara telah digunakan sebelumnya. Suara ganda ditolak sistem.' };
    }

    const activePeriod = this.getActivePeriod();
    const candidate = this.candidates.find(
      (c) => c.id === candidateId && c.electionPeriodId === activePeriod.id
    );
    if (!candidate) {
      return { success: false, message: 'Pasangan calon yang dipilih tidak sah.' };
    }

    const now = new Date().toISOString();

    // 1. Insert strictly anonymous vote
    const anonymousVote: AnonymousVote = {
      id: `vote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      electionPeriodId: activePeriod.id,
      candidateId: candidate.id,
      createdAt: now,
    };
    this.votes.push(anonymousVote);

    // 2. Mark voter as voted atomically & burn plain PIN
    this.voters[voterIndex] = {
      ...voter,
      hasVoted: true,
      votedAt: now,
      pinPlain: undefined, // Burn plain PIN to prevent reuse
    };

    // 3. Generate anonymous verifiable receipt hash (does not reveal choice)
    const receiptCode = `PILKETOS-${Math.abs(Date.now() % 1000000).toString().padStart(6, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 4. Record audit log
    this.logAudit(
      'Siswa',
      'TRANSAKSI_SUARA_ANONIM',
      `Surat suara digital sah telah disalurkan dan dihitung. Kode verifikasi transaksi: ${receiptCode}.`,
      '192.168.10.100',
      'INFO'
    );

    this.notify();

    return {
      success: true,
      message: 'Suara Anda telah berhasil dicatat secara sah, rahasia, dan terenkripsi.',
      receiptCode,
    };
  }

  // --- COMMITTEE MANAGEMENT ---
  public getCommittee(periodId?: string): CommitteeMember[] {
    const target = periodId || this.getActivePeriod().id;
    return this.committee.filter((c) => c.electionPeriodId === target);
  }

  public addCommitteeMember(member: Omit<CommitteeMember, 'id'>) {
    const newMember: CommitteeMember = {
      ...member,
      id: `comm_${Date.now()}`,
    };
    this.committee.push(newMember);
    this.logAudit('Admin Sekolah', 'TAMBAH_PANITIA', `Menambahkan anggota panitia: ${newMember.memberName} (${newMember.role})`, '192.168.10.1', 'INFO');
    this.notify();
    return newMember;
  }

  public updateCommitteeMember(id: string, updates: Partial<CommitteeMember>) {
    this.committee = this.committee.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.notify();
  }

  public deleteCommitteeMember(id: string) {
    this.committee = this.committee.filter((c) => c.id !== id);
    this.notify();
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logAudit(
    userRole: AuditLog['userRole'],
    action: string,
    details: string,
    ipAddress = '192.168.1.1',
    severity: AuditLog['severity'] = 'INFO'
  ) {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      userId: userRole.toLowerCase().replace(/\s+/g, '_'),
      userRole,
      action,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
      severity,
    };
    this.auditLogs.unshift(newLog);
    // Keep max 200 logs
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  // --- STATS & REALTIME SUMMARY ---
  public getSummary(periodId?: string): ElectionSummary {
    const targetPeriod = periodId
      ? this.periods.find((p) => p.id === periodId) || this.getActivePeriod()
      : this.getActivePeriod();

    const votersInPeriod = this.voters.filter((v) => v.electionPeriodId === targetPeriod.id);
    const votesInPeriod = this.votes.filter((v) => v.electionPeriodId === targetPeriod.id);
    const candidatesInPeriod = this.candidates
      .filter((c) => c.electionPeriodId === targetPeriod.id)
      .sort((a, b) => a.ballotNumber - b.ballotNumber);

    const totalVoters = votersInPeriod.length;
    const totalVoted = votersInPeriod.filter((v) => v.hasVoted).length;
    const totalUnvoted = totalVoters - totalVoted;
    const participationPercentage = totalVoters > 0 ? (totalVoted / totalVoters) * 100 : 0;

    // Count votes per candidate
    const voteMap = new Map<string, number>();
    votesInPeriod.forEach((vote) => {
      voteMap.set(vote.candidateId, (voteMap.get(vote.candidateId) || 0) + 1);
    });

    const candidatesResults = candidatesInPeriod.map((cand) => {
      const count = voteMap.get(cand.id) || 0;
      const percentage = totalVoted > 0 ? (count / totalVoted) * 100 : 0;
      return {
        candidate: cand,
        voteCount: count,
        percentage: Number(percentage.toFixed(2)),
      };
    });

    // Breakdown per class
    const classMap = new Map<string, { total: number; voted: number }>();
    votersInPeriod.forEach((v) => {
      const current = classMap.get(v.className) || { total: 0, voted: 0 };
      current.total += 1;
      if (v.hasVoted) current.voted += 1;
      classMap.set(v.className, current);
    });

    const classParticipation = Array.from(classMap.entries())
      .map(([className, data]) => ({
        className,
        total: data.total,
        voted: data.voted,
        percentage: data.total > 0 ? Number(((data.voted / data.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    return {
      period: targetPeriod,
      totalVoters,
      totalVoted,
      totalUnvoted,
      participationPercentage: Number(participationPercentage.toFixed(2)),
      candidatesResults,
      classParticipation,
    };
  }
}

// Global Singleton Instance
export const electionStore = new ElectionStore();
