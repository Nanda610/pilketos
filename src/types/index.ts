/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Domain Types for E-Pilketos / E-Pilkosim Digital System
 */

export type OrganizationType = 'OSIS' | 'OSIM';

export type PeriodStatus = 'draft' | 'active' | 'completed';

export interface SchoolConfig {
  id: string;
  name: string;
  type: OrganizationType;
  npsn: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  website: string;
  principalName: string;
  principalNip: string;
  logoUrl?: string;
  osisLogoUrl?: string;
  openingVideoUrl?: string;
  openingVideoTitle?: string;
  email?: string;
  kopLogoConfig?: {
    schoolLogoWidth: number;
    schoolLogoHeight: number;
    schoolLogoOffsetX: number;
    schoolLogoOffsetY: number;
    osisLogoWidth: number;
    osisLogoHeight: number;
    osisLogoOffsetX: number;
    osisLogoOffsetY: number;
    savedAt?: string;
  };
  stampConfig?: {
    headerText: string;
    institutionText: string;
    footerText: string;
    sizePx: number;
    rotationDeg: number;
    offsetX: number;
    offsetY: number;
    colorTheme: 'purple' | 'blue' | 'emerald' | 'rose' | 'slate';
    signatoryTitle: string;
    savedAt?: string;
  };
}

export interface ElectionPeriod {
  id: string;
  schoolId: string;
  periodName: string; // e.g. "Pemilihan OSIS 2026/2027"
  academicYear: string; // "2026/2027"
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  votingOpenTime: string;
  votingCloseTime: string;
  createdAt: string;
  description?: string;
}

export interface CommitteeMember {
  id: string;
  electionPeriodId: string;
  skNumber: string;
  skDate: string;
  memberName: string;
  role: 'Ketua Panitia' | 'Sekretaris' | 'Bendahara' | 'Koordinator IT & Bilik' | 'Seksi Logistik' | 'Pengawas / Saksi';
  className?: string;
  email: string;
}

export interface Candidate {
  id: string;
  electionPeriodId: string;
  ballotNumber: number; // 1, 2, 3...
  chairmanName: string;
  viceChairmanName: string;
  chairmanClass: string;
  viceChairmanClass: string;
  photoUrl: string;
  chairmanPhotoUrl?: string;
  viceChairmanPhotoUrl?: string;
  motto: string;
  vision: string;
  mission: string[];
  programs: string[];
  videoUrl?: string;
}

export interface Voter {
  id: string;
  electionPeriodId: string;
  nisn: string; // 10 digit unique
  fullName: string;
  className: string; // e.g. "VII A", "VIII B", "IX C"
  gradeLevel: string; // "VII", "VIII", "IX"
  gender: 'L' | 'P';
  pinHash: string; // SHA-256 with salt
  pinPlain?: string; // Visible only to Panitia for printable token issuance before vote
  hasVoted: boolean;
  votedAt?: string;
  tokenPrinted: boolean;
}

export interface AnonymousVote {
  id: string;
  electionPeriodId: string;
  candidateId: string;
  createdAt: string;
  // NOTE: Voter ID is purposefully NOT stored here to enforce strict LUBER-JURDIL privacy!
}

export interface AuditLog {
  id: string;
  userId: string;
  userRole: 'Siswa' | 'Panitia' | 'Admin Sekolah' | 'Sistem';
  action: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ElectionSummary {
  period: ElectionPeriod;
  totalVoters: number;
  totalVoted: number;
  totalUnvoted: number;
  participationPercentage: number;
  candidatesResults: {
    candidate: Candidate;
    voteCount: number;
    percentage: number;
  }[];
  classParticipation: {
    className: string;
    total: number;
    voted: number;
    percentage: number;
  }[];
}
