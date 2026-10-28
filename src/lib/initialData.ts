/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Initial Seed Data for E-Pilketos / E-Pilkosim Digital System (Jenjang SMP / MTs)
 */

import { SchoolConfig, ElectionPeriod, Candidate, Voter, AnonymousVote, CommitteeMember, AuditLog, UserAccount } from '../types';
import { hashPin } from './security';

export const INITIAL_SCHOOL: SchoolConfig = {
  id: 'sch_smp_yaspai',
  name: 'SMP ISLAM YASPAI',
  type: 'OSIS',
  npsn: '20519118',
  address: 'Jl. Cangkringmalang.',
  city: 'Kab. Pasuruan',
  province: 'Jawatimur',
  postalCode: '10330',
  phone: '(021) 31924510',
  website: 'https://smpyaspai.sch.id',
  principalName: 'Nanang Supriyanto, S.Pd.',
  principalNip: '',
  email: 'info@smpyaspai.sch.id',
  logoUrl: '',
  osisLogoUrl: '',
};

export const INITIAL_PERIODS: ElectionPeriod[] = [
  {
    id: 'period_2024_2025',
    schoolId: 'sch_smp_yaspai',
    periodName: 'Pemilihan Umum Ketua OSIS SMP 2024/2025',
    academicYear: '2024/2025',
    startDate: '2024-09-12',
    endDate: '2024-09-12',
    status: 'completed',
    votingOpenTime: '08:00',
    votingCloseTime: '14:00',
    createdAt: '2024-08-20T08:00:00Z',
    description: 'Arsip pemilihan periode lampau jenjang SMP 2024/2025 dengan partisipasi 95.1%.',
  },
  {
    id: 'period_2025_2026',
    schoolId: 'sch_smp_yaspai',
    periodName: 'Pemilihan Umum Ketua OSIS SMP 2025/2026',
    academicYear: '2025/2026',
    startDate: '2025-09-18',
    endDate: '2025-09-18',
    status: 'completed',
    votingOpenTime: '08:00',
    votingCloseTime: '14:00',
    createdAt: '2025-08-25T08:00:00Z',
    description: 'Arsip pemilihan periode lampau jenjang SMP 2025/2026 dengan partisipasi 97.4%.',
  },
  {
    id: 'period_2026_2027',
    schoolId: 'sch_smp_yaspai',
    periodName: 'Pemilihan Umum Ketua & Wakil Ketua OSIS SMP 2026/2027',
    academicYear: '2026/2027',
    startDate: '2026-10-24',
    endDate: '2026-10-24',
    status: 'active', // ONLY ONE ACTIVE PERIOD
    votingOpenTime: '07:30',
    votingCloseTime: '14:30',
    createdAt: '2026-09-10T08:00:00Z',
    description: 'Periode aktif pemungutan suara langsung serentak siswa SMP tahun ajaran 2026/2027.',
  },
];

export const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: 'cand_01',
    electionPeriodId: 'period_2026_2027',
    ballotNumber: 1,
    chairmanName: 'Muhammad Fadhil Pratama',
    viceChairmanName: 'Aisyah Putri Lestari',
    chairmanClass: 'VIII A',
    viceChairmanClass: 'VIII B',
    photoUrl: '',
    motto: 'Cerdas Berkarakter 5S, Santun, dan Aktif Berprestasi Bersama',
    vision: 'Mewujudkan OSIS SMP ISLAM YASPAI sebagai poros organisasi siswa yang inklusif, membina sopan santun 5S, memajukan kreativitas pelajar, dan berlandaskan Profil Pelajar Pancasila.',
    mission: [
      'Menghidupkan budaya 5S (Senyum, Salam, Sapa, Sopan, Santun) di seluruh lingkungan kelas 7, 8, dan 9.',
      'Mengoptimalkan aspirasi siswa melalui kotak suara & dialog berkala (Sahabat OSIS Mendengar).',
      'Mempererat keakraban antarkelas melalui Pekan Classmeeting Olahraga, E-Sports, dan Pentas Seni SMP.',
      'Menjaga kebersihan dan kepedulian lingkungan melalui Gerakan Jumat Bersih & Sekolah Adiwiyata.'
    ],
    programs: [
      'Classmeeting Seru SMP: Futsal, Basket & Catur Antarkelas',
      'Gerakan Budaya Disiplin Positif & 5S Ramah Siswa',
      'Pojok Baca & Majalah Dinding (Mading) Digital Siswa',
      'Klub Sains & Eksperimen Menyenangkan (Science Club SMP)'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 'cand_02',
    electionPeriodId: 'period_2026_2027',
    ballotNumber: 2,
    chairmanName: 'Bagas Satria Nugraha',
    viceChairmanName: 'Rafi Andrea Wicaksono',
    chairmanClass: 'VIII C',
    viceChairmanClass: 'VII A',
    motto: 'Berani Berkarya, Rukun Bersahabat, Menginspirasi Siswa SMP',
    photoUrl: '',
    vision: 'Membangun karakter siswa SMP yang tangguh, aktif dalam kepramukaan dan ekstrakurikuler, serta peduli lingkungan sekolah ramah anak dan bebas perundungan.',
    mission: [
      'Meningkatkan partisipasi dan prestasi ekstrakurikuler (Pramuka, PMR, Paskibra, Musik, Olahraga).',
      'Melaksanakan program bimbingan belajar teman sebaya (Peer Tutoring) untuk persiapan ujian semester.',
      'Mengadakan panggung apresiasi bakat dan minat seni remaja di jam istirahat teratur.',
      'Menjadikan OSIS teladan dalam kedisiplinan waktu, tata tertib, dan seragam sekolah rapi.'
    ],
    programs: [
      'Pekan Olahraga & Seni Remaja (Pensi SMP Teladan)',
      'Bimbingan Belajar Sahabat Sebaya (Sukses Asesmen SMP)',
      'Latihan Dasar Kepemimpinan Siswa (LDKS) Mandiri',
      'Gerakan Sekolah Sehat & Kantin Bersih Bebas Plastik'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 'cand_03',
    electionPeriodId: 'period_2026_2027',
    ballotNumber: 3,
    chairmanName: 'Nabila Zahra Ramadhani',
    viceChairmanName: 'Kevin Jonathan Chandra',
    chairmanClass: 'VIII B',
    viceChairmanClass: 'VII C',
    motto: 'Harmoni Keberagaman, Melek Teknologi, Berdaya Bersama',
    photoUrl: '',
    vision: 'Menjadikan OSIS SMP sebagai wadah persatuan yang memperjuangkan kesetaraan aspirasi kelas 7, 8, dan 9, menggiatkan literasi teknologi ramah pelajar, dan menjamin sekolah tanpa bullying.',
    mission: [
      'Membentuk Satgas Sahabat Ramah Anak untuk mencegah segala bentuk perundungan (Zero Bullying).',
      'Mengadakan workshop literasi digital positif, dasar desain grafis, dan robotika cilik.',
      'Menumbuhkan kepedulian sosial melalui aksi bakti santunan sahabat dan donor buku perpustakaan.',
      'Menyajikan transparansi kegiatan dan laporan keuangan OSIS secara berkala di mading sekolah.'
    ],
    programs: [
      'Duta Sahabat Anti-Bullying Ramah Remaja (Careline SMP)',
      'Workshop Coding & Desain Grafis Canva untuk Siswa SMP',
      'Aksi Peduli Sahabat: Gerakan Seribu Buku & Kasih Kemanusiaan',
      'Forum Terbuka Aspirasi Siswa Kelas 7, 8, dan 9'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
];

export const INITIAL_COMMITTEE: CommitteeMember[] = [
  {
    id: 'comm_01',
    electionPeriodId: 'period_2026_2027',
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
    memberName: 'Bambang Sudarmono, S.Pd.',
    role: 'Pengawas / Saksi',
    className: 'Pembina OSIS SMP',
    email: 'bambang.sudarmono@smpn1teladan.sch.id'
  },
  {
    id: 'comm_02',
    electionPeriodId: 'period_2026_2027',
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
    memberName: 'Dimas Arya Pratama',
    role: 'Ketua Panitia',
    className: 'IX A',
    email: 'dimas.arya@smpn1teladan.sch.id'
  },
  {
    id: 'comm_03',
    electionPeriodId: 'period_2026_2027',
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
    memberName: 'Siti Nurhaliza',
    role: 'Sekretaris',
    className: 'IX B',
    email: 'siti.nurhaliza@smpn1teladan.sch.id'
  },
  {
    id: 'comm_04',
    electionPeriodId: 'period_2026_2027',
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
    memberName: 'Alif Kurniawan',
    role: 'Koordinator IT & Bilik',
    className: 'IX C',
    email: 'alif.kurniawan@smpn1teladan.sch.id'
  }
];

// Seed voters tailored for SMP / MTs (Grades VII, VIII, IX)
const rawVoterSeed = [
  // Kelas VII (Kelas 7)
  { nisn: '0111234001', name: 'Ahmad Fauzi Rahman', class: 'VII A', grade: 'VII', gender: 'L' as const, pin: 'TK7N2X', voted: true, cand: 'cand_01' },
  { nisn: '0111234002', name: 'Annisa Fitriana Dewi', class: 'VII A', grade: 'VII', gender: 'P' as const, pin: 'P4K9M8', voted: true, cand: 'cand_01' },
  { nisn: '0111234003', name: 'Bima Arya Pratama', class: 'VII A', grade: 'VII', gender: 'L' as const, pin: 'Z3W8VJ', voted: true, cand: 'cand_02' },
  { nisn: '0111234004', name: 'Cantika Putri Lestari', class: 'VII A', grade: 'VII', gender: 'P' as const, pin: 'R6T2CY', voted: false },
  { nisn: '0111234005', name: 'Dafa Alamsyah', class: 'VII B', grade: 'VII', gender: 'L' as const, pin: 'H5B9Q4', voted: true, cand: 'cand_03' },
  { nisn: '0111234006', name: 'Dina Kusuma Wardani', class: 'VII B', grade: 'VII', gender: 'P' as const, pin: 'N8D3KF', voted: true, cand: 'cand_01' },
  { nisn: '0111234007', name: 'Farel Raditya', class: 'VII B', grade: 'VII', gender: 'L' as const, pin: 'M2G7VP', voted: false },
  { nisn: '0111234008', name: 'Gita Permatasari', class: 'VII C', grade: 'VII', gender: 'P' as const, pin: 'Y9X4JH', voted: true, cand: 'cand_03' },
  { nisn: '0111234009', name: 'Hafiz Surya Danendra', class: 'VII C', grade: 'VII', gender: 'L' as const, pin: 'C7P3WK', voted: true, cand: 'cand_02' },
  { nisn: '0111234010', name: 'Indah Cahyani', class: 'VII C', grade: 'VII', gender: 'P' as const, pin: 'K6M9RT', voted: false },
  
  // Kelas VIII (Kelas 8)
  { nisn: '0101234011', name: 'Jovan Nathaniel', class: 'VIII A', grade: 'VIII', gender: 'L' as const, pin: 'F8V2XB', voted: true, cand: 'cand_01' },
  { nisn: '0101234012', name: 'Kayla Az-Zahra', class: 'VIII A', grade: 'VIII', gender: 'P' as const, pin: 'Q3D7ZP', voted: true, cand: 'cand_01' },
  { nisn: '0101234013', name: 'Luthfi Hakim', class: 'VIII B', grade: 'VIII', gender: 'L' as const, pin: 'W4H8NM', voted: true, cand: 'cand_02' },
  { nisn: '0101234014', name: 'Maya Salsabila', class: 'VIII B', grade: 'VIII', gender: 'P' as const, pin: 'J9B5TY', voted: true, cand: 'cand_02' },
  { nisn: '0101234015', name: 'Naufal Ikhsan', class: 'VIII C', grade: 'VIII', gender: 'L' as const, pin: 'S2K6VC', voted: true, cand: 'cand_03' },
  { nisn: '0101234016', name: 'Olivia Febrianti', class: 'VIII C', grade: 'VIII', gender: 'P' as const, pin: 'T7P4WD', voted: false },
  { nisn: '0101234017', name: 'Putra Maulana', class: 'VIII C', grade: 'VIII', gender: 'L' as const, pin: 'B8X3ZQ', voted: true, cand: 'cand_01' },
  { nisn: '0101234018', name: 'Qonita Rahadatul', class: 'VIII C', grade: 'VIII', gender: 'P' as const, pin: 'G5N9KJ', voted: true, cand: 'cand_03' },
  
  // Kelas IX (Kelas 9)
  { nisn: '0091234019', name: 'Rangga Aditia', class: 'IX A', grade: 'IX', gender: 'L' as const, pin: 'E4H7MB', voted: true, cand: 'cand_02' },
  { nisn: '0091234020', name: 'Sabrina Kirana', class: 'IX A', grade: 'IX', gender: 'P' as const, pin: 'K3V8PY', voted: true, cand: 'cand_01' },
  { nisn: '0091234021', name: 'Tegar Wicaksono', class: 'IX B', grade: 'IX', gender: 'L' as const, pin: 'D9T2XR', voted: true, cand: 'cand_02' },
  { nisn: '0091234022', name: 'Ulfah Mutmainnah', class: 'IX B', grade: 'IX', gender: 'P' as const, pin: 'P6B4WN', voted: false },
  { nisn: '0091234023', name: 'Vito Alexander', class: 'IX C', grade: 'IX', gender: 'L' as const, pin: 'Z7M5QC', voted: true, cand: 'cand_03' },
  { nisn: '0091234024', name: 'Wulan Anggraini', class: 'IX C', grade: 'IX', gender: 'P' as const, pin: 'R8K2VF', voted: true, cand: 'cand_01' },
  { nisn: '0091234025', name: 'Yoga Prasetyo', class: 'IX C', grade: 'IX', gender: 'L' as const, pin: 'H3N7TJ', voted: true, cand: 'cand_02' },
  { nisn: '0091234026', name: 'Zahra Amelia', class: 'IX C', grade: 'IX', gender: 'P' as const, pin: 'C9W4YB', voted: false },
];

export const INITIAL_VOTERS: Voter[] = rawVoterSeed.map((item, index) => ({
  id: `voter_${index + 1}`,
  electionPeriodId: 'period_2026_2027',
  nisn: item.nisn,
  fullName: item.name,
  className: item.class,
  gradeLevel: item.grade,
  gender: item.gender,
  pinPlain: item.pin,
  pinHash: hashPin(item.pin),
  hasVoted: item.voted,
  votedAt: item.voted ? `2026-10-24T0${8 + (index % 4)}:${(index * 7) % 60}:00Z` : undefined,
  tokenPrinted: true,
}));

// Build anonymous votes strictly without voter IDs (LUBER-JURDIL principle)
export const INITIAL_VOTES: AnonymousVote[] = rawVoterSeed
  .filter((item) => item.voted && item.cand)
  .map((item, idx) => ({
    id: `vote_${idx + 1001}`,
    electionPeriodId: 'period_2026_2027',
    candidateId: item.cand!,
    createdAt: `2026-10-24T0${8 + (idx % 4)}:${(idx * 7) % 60}:00Z`,
  }));

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_01',
    userId: 'admin_ks',
    userRole: 'Admin Sekolah',
    action: 'INISIALISASI_PERIODE',
    details: 'Membuka dan mengaktifkan periode pemilihan OSIS SMP 2026/2027.',
    ipAddress: '192.168.10.1',
    timestamp: '2026-10-24T07:00:00Z',
    severity: 'INFO',
  },
  {
    id: 'log_02',
    userId: 'panitia_dimas',
    userRole: 'Panitia',
    action: 'CETAK_TOKEN_MASSAL',
    details: 'Mencetak 26 kartu token pemilih kelas VII, VIII, IX.',
    ipAddress: '192.168.10.15',
    timestamp: '2026-10-24T07:20:00Z',
    severity: 'INFO',
  },
  {
    id: 'log_03',
    userId: 'sistem',
    userRole: 'Sistem',
    action: 'PEMBUKAAN_BILIK_SUARA',
    details: 'Bilik suara SMP dibuka sesuai jadwal pukul 07:30 WIB.',
    ipAddress: '127.0.0.1',
    timestamp: '2026-10-24T07:30:00Z',
    severity: 'INFO',
  },
  {
    id: 'log_04',
    userId: 'siswa_anon',
    userRole: 'Siswa',
    action: 'TRANSAKSI_SUARA_SAH',
    details: 'Suara sah siswa SMP tersimpan secara anonim. Status pemilih diperbarui (has_voted = true).',
    ipAddress: '192.168.10.101',
    timestamp: '2026-10-24T08:14:00Z',
    severity: 'INFO',
  },
];

export const INITIAL_ACCOUNTS: UserAccount[] = [
  {
    id: 'acc_admin_01',
    username: 'admin',
    name: 'Administrator Sekolah',
    role: 'admin',
    passwordPlain: 'admin123',
    updatedAt: '2026-10-24T07:00:00Z',
  },
  {
    id: 'acc_panitia_01',
    username: 'panitia',
    name: 'Panitia Pemilihan OSIS',
    role: 'panitia',
    passwordPlain: 'panitia123',
    updatedAt: '2026-10-24T07:00:00Z',
  },
];

