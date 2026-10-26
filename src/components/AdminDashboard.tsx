/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Panel Admin Sekolah / Madrasah (Kepala Sekolah & Operator)
 * Institution Setup, Multi-Period Reusable Switcher, Committee SK,
 * Official BAHP Certification, and Security Audit Trails.
 */

import React, { useState } from 'react';
import { 
  Building2, Calendar, FileCheck, ShieldAlert, Award, Plus, 
  CheckCircle2, Clock, Archive, Printer, RotateCcw, Save, X,
  AlertTriangle, KeyRound, Trash2, Film, Upload, Play, FileVideo, Sparkles, Video, FileText
} from 'lucide-react';
import { SchoolConfig, ElectionPeriod, CommitteeMember, AuditLog, ElectionSummary } from '../types';
import { electionStore } from '../lib/store';
import { PrintBeritaAcara } from './PrintBeritaAcara';
import { PrintSkPanitia } from './PrintSkPanitia';
import { OpeningSequence } from './OpeningSequence';
import { SchoolCrestLogo, OsisLogoBadge } from './CandidateAvatar';

interface AdminDashboardProps {
  school: SchoolConfig;
  periods: ElectionPeriod[];
  committee: CommitteeMember[];
  auditLogs: AuditLog[];
  summary: ElectionSummary;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  school,
  periods,
  committee,
  auditLogs,
  summary,
}) => {
  const [activeTab, setActiveTab] = useState<'periods' | 'school' | 'committee' | 'audit' | 'video'>('periods');
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showAddCommitteeModal, setShowAddCommitteeModal] = useState(false);
  const [showBahpModal, setShowBahpModal] = useState(false);
  const [selectedBahpPeriodId, setSelectedBahpPeriodId] = useState<string | null>(null);
  const [showSkModal, setShowSkModal] = useState(false);
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState<ElectionPeriod | null>(null);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const handleOpenBahpModal = (periodId?: string) => {
    const targetPeriodId = periodId || summary.period.id;
    setSelectedBahpPeriodId(targetPeriodId);
    setShowBahpModal(true);
  };

  // Opening video state
  const [showOpeningPreview, setShowOpeningPreview] = useState(false);
  const [openingVideoInputUrl, setOpeningVideoInputUrl] = useState(school.openingVideoUrl || '');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // School form state
  const [schoolForm, setSchoolForm] = useState<SchoolConfig>(school);

  // New period state
  const [newPeriod, setNewPeriod] = useState({
    periodName: 'Pemilihan Umum Ketua OSIS SMP 2027/2028',
    academicYear: '2027/2028',
    startDate: '2027-09-15',
    endDate: '2027-09-15',
    votingOpenTime: '07:30',
    votingCloseTime: '15:00',
    status: 'draft' as 'draft' | 'active' | 'completed',
    description: 'Periode pemilihan baru jenjang SMP',
  });

  // Committee member form state
  const [newMember, setNewMember] = useState({
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
    memberName: '',
    role: 'Pengawas / Saksi' as CommitteeMember['role'],
    className: 'IX A',
    email: '',
  });

  const showAlert = (msg: string) => {
    setAlertNotice(msg);
    setTimeout(() => setAlertNotice(null), 4000);
  };

  const handleUploadOsisLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showAlert('Ukuran file logo terlalu besar (maksimal 10MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSchoolForm((prev) => ({ ...prev, osisLogoUrl: dataUrl }));
      electionStore.updateSchool({ osisLogoUrl: dataUrl });
      showAlert(`Logo ${schoolForm.type} berhasil diunggah dan disimpan!`);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSchoolLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showAlert('Ukuran file logo terlalu besar (maksimal 10MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSchoolForm((prev) => ({ ...prev, logoUrl: dataUrl }));
      electionStore.updateSchool({ logoUrl: dataUrl });
      showAlert('Logo lambang sekolah berhasil diunggah!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    electionStore.updateSchool(schoolForm);
    showAlert('Konfigurasi satuan pendidikan berhasil diperbarui.');
  };

  const handleActivatePeriod = (periodId: string) => {
    if (confirm('Aktifkan periode ini? Periode lain yang sedang aktif akan otomatis ditandai sebagai selesai/arsip.')) {
      electionStore.setActivePeriod(periodId);
      showAlert('Periode pemilihan telah diaktifkan.');
    }
  };

  const handleDeletePeriod = (periodId: string) => {
    const res = electionStore.deletePeriod(periodId);
    setConfirmDeletePeriod(null);
    showAlert(res.message);
  };

  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    electionStore.addPeriod({
      schoolId: school.id,
      ...newPeriod,
    });
    setShowNewPeriodModal(false);
    showAlert(`Periode ${newPeriod.periodName} berhasil dibuat.`);
  };

  const handleAddCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    electionStore.addCommitteeMember({
      electionPeriodId: summary.period.id,
      ...newMember,
    });
    setShowAddCommitteeModal(false);
    showAlert(`Anggota panitia ${newMember.memberName} berhasil ditambahkan.`);
  };

  const handleResetSample = () => {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin menyetel ulang database ke data simulasi awal? Semua perubahan uji coba akan dikembalikan.')) {
      electionStore.resetToSampleData();
      showAlert('Database berhasil disetel ulang ke dataset simulasi awal.');
    }
  };

  const handleSaveOpeningVideoUrl = (url: string) => {
    electionStore.updateSchool({
      openingVideoUrl: url.trim(),
    });
    setOpeningVideoInputUrl(url.trim());
    showAlert('Tautan video opening berhasil disimpan!');
  };

  const handleUploadOpeningVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      showAlert('Ukuran file video terlalu besar (maksimal 50MB).');
      return;
    }

    setIsUploadingVideo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      electionStore.updateSchool({
        openingVideoUrl: dataUrl,
        openingVideoTitle: file.name,
      });
      setOpeningVideoInputUrl(dataUrl);
      setIsUploadingVideo(false);
      showAlert(`Video opening "${file.name}" berhasil diunggah dan disimpan!`);
    };
    reader.onerror = () => {
      setIsUploadingVideo(false);
      showAlert('Gagal membaca file video. Silakan coba kembali.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetOpeningVideo = () => {
    electionStore.updateSchool({
      openingVideoUrl: '',
      openingVideoTitle: '',
    });
    setOpeningVideoInputUrl('');
    showAlert('Video opening dikembalikan ke animasi default Motion Graphic Siaran TV.');
  };

  return (
    <div className="no-print-dashboard space-y-6 pb-16">
      {/* Top Banner - Glassmorphic Header */}
      <div className="rounded-3xl glass-panel p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-500/10 border border-purple-400/30 backdrop-blur-xs">
            <Building2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Hak Akses Tertinggi: Kepala Sekolah & Administrator</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-2">
            Panel Administrator Satuan Pendidikan
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Manajemen Multi-Periode, Pengesahan SK Kepanitiaan, Konfigurasi Sekolah & Berita Acara Resmi
          </p>
        </div>

        {/* Tab Buttons - Glass Tab Bar */}
        <div className="flex flex-wrap items-center gap-1.5 glass-tab-bar p-1.5 rounded-2xl self-start md:self-auto relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('periods')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'periods'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Periode Pemilihan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('school')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'school'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Identitas Sekolah
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('committee')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'committee'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            SK Panitia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Audit Log Sistem
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'video'
                ? 'glass-button bg-white text-rose-600 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-rose-500" />
            <span>Video Opening</span>
          </button>
        </div>
      </div>

      {/* Alert Notice Toast */}
      {alertNotice && (
        <div className="p-4 rounded-2xl glass-panel border border-purple-300/80 bg-purple-50/80 text-purple-950 text-xs font-semibold flex items-center justify-between shadow-md animate-in fade-in">
          <span>{alertNotice}</span>
          <button onClick={() => setAlertNotice(null)} className="cursor-pointer text-slate-500 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: MULTI-PERIOD MANAGEMENT */}
      {activeTab === 'periods' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Manajemen Periode Pemilihan (Multi-Period Reusable Engine)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sistem dirancang dapat digunakan kembali setiap tahun ajaran baru tanpa perlu membuat database terpisah.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenBahpModal()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer transform hover:scale-101"
              >
                <Printer className="w-4 h-4" />
                <span>Unduh Berita Acara (BAHP)</span>
              </button>
              <button
                onClick={() => setShowNewPeriodModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Periode Baru</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {periods.map((p) => {
              const isActive = p.status === 'active';
              return (
                <div
                  key={p.id}
                  className={`rounded-3xl glass-card glass-card-hover p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative overflow-hidden ${
                    isActive ? 'border-sky-400 bg-sky-50/50 ring-2 ring-sky-400/30' : 'border-white/80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-lg border border-white/80">
                        TA {p.academicYear}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          SEDANG AKTIF (OPEN)
                        </span>
                      ) : p.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100/80 text-slate-600 border border-slate-200">
                          <Archive className="w-3 h-3" />
                          SELESAI (TERARSIP)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50/90 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          DRAFT (PERSIAPAN)
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">{p.periodName}</h3>
                    <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                      {p.description || `Jadwal pemungutan suara: ${p.startDate} (${p.votingOpenTime} - ${p.votingCloseTime} WIB)`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenBahpModal(p.id)}
                      className="px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="Lihat Pratinjau & Cetak Berita Acara BAHP untuk periode ini"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Unduh BAHP</span>
                    </button>
                    {!isActive && (
                      <button
                        onClick={() => handleActivatePeriod(p.id)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Set Sebagai Periode Aktif
                      </button>
                    )}
                    {isActive && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3.5 py-2 rounded-xl border border-emerald-300/80 shadow-2xs">
                        Bilik Suara Terhubung
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePeriod(p)}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50/80 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Hapus set periode pemilihan ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SCHOOL IDENTITY SETUP */}
      {activeTab === 'school' && (
        <div className="max-w-2xl glass-panel rounded-3xl p-6 md:p-8 shadow-lg space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Konfigurasi Satuan Pendidikan (Sekolah / Madrasah)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Identitas ini tercetak otomatis pada kop surat, surat suara digital, dan Berita Acara Hasil Pemilihan (BAHP).
            </p>
          </div>

          <form onSubmit={handleSaveSchool} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Organisasi Siswa
                </label>
                <select
                  value={schoolForm.type}
                  onChange={(e) => setSchoolForm({ ...schoolForm, type: e.target.value as any })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="OSIS">OSIS (Organisasi Siswa Intra Sekolah)</option>
                  <option value="OSIM">OSIM (Organisasi Santri Intra Madrasah)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Pokok Sekolah Nasional (NPSN)
                </label>
                <input
                  type="text"
                  value={schoolForm.npsn}
                  onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Resmi Satuan Pendidikan
              </label>
              <input
                type="text"
                value={schoolForm.name}
                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Sekolah Lengkap
              </label>
              <textarea
                rows={2}
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kota / Kabupaten</label>
                <input
                  type="text"
                  value={schoolForm.city}
                  onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Provinsi</label>
                <input
                  type="text"
                  value={schoolForm.province}
                  onChange={(e) => setSchoolForm({ ...schoolForm, province: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Pos Wilayah</label>
                <input
                  type="text"
                  value={schoolForm.postalCode || ''}
                  onChange={(e) => setSchoolForm({ ...schoolForm, postalCode: e.target.value })}
                  placeholder="10330 / 40123"
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Resmi Sekolah</label>
                <input
                  type="email"
                  value={schoolForm.email || ''}
                  onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                  placeholder="info@sekolah.sch.id"
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                <input
                  type="text"
                  value={schoolForm.phone}
                  onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laman Resmi (Website)</label>
                <input
                  type="text"
                  value={schoolForm.website}
                  onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={schoolForm.principalName}
                  onChange={(e) => setSchoolForm({ ...schoolForm, principalName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={schoolForm.principalNip}
                  onChange={(e) => setSchoolForm({ ...schoolForm, principalNip: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Logo Satuan Pendidikan & Logo OSIS/OSIM */}
            <div className="pt-2 border-t border-slate-200/60 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Logo Resmi Satuan Pendidikan & Organisasi Siswa
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* School Logo Card */}
                <div className="p-3.5 rounded-2xl bg-white/70 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Logo Lambang Sekolah</span>
                    <span className="text-[10px] text-slate-500">Kop Kiri</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {schoolForm.logoUrl ? (
                        <img src={schoolForm.logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain" />
                      ) : (
                        <SchoolCrestLogo size={40} type={schoolForm.type} />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih File Logo</span>
                        <input type="file" accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.tiff,.avif,.heic,.heif" onChange={handleUploadSchoolLogo} className="hidden" />
                      </label>
                      <p className="text-[10px] text-slate-400">Semua format gambar didukung (PNG, JPG, SVG, WEBP, HEIC, dll)</p>
                    </div>
                  </div>
                </div>

                {/* OSIS Logo Card */}
                <div className="p-3.5 rounded-2xl bg-white/70 border border-purple-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900">Logo Resmi {schoolForm.type}</span>
                    <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">Kop Kanan</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-purple-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {schoolForm.osisLogoUrl ? (
                        <img src={schoolForm.osisLogoUrl} alt={`Logo ${schoolForm.type}`} className="w-full h-full object-contain" />
                      ) : (
                        <OsisLogoBadge size={44} type={schoolForm.type} />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Logo {schoolForm.type}</span>
                          <input type="file" accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.tiff,.avif,.heic,.heif" onChange={handleUploadOsisLogo} className="hidden" />
                        </label>
                        {schoolForm.osisLogoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setSchoolForm({ ...schoolForm, osisLogoUrl: '' });
                              electionStore.updateSchool({ osisLogoUrl: '' });
                              showAlert(`Logo kustom ${schoolForm.type} telah dihapus.`);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus logo kustom"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">Semua format gambar didukung (Maks. 10MB)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Identitas</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: COMMITTEE MANAGEMENT BASED ON DECREE (SK) */}
      {activeTab === 'committee' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Kepanitiaan Pemilihan Berdasarkan Surat Keputusan (SK)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengesahan penanggung jawab bilik suara, saksi, dan pengawas pemilihan
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSkModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-500/25 flex items-center gap-2 transition-all cursor-pointer transform hover:scale-101 active:scale-98"
                title="Buka, Edit Isi & Cetak Surat Bukti Fisik SK Panitia Resmi (1-99 Halaman)"
              >
                <FileText className="w-4 h-4" />
                <span>Surat Bukti Fisik & Edit SK (1-99 Hal)</span>
              </button>
              <button
                onClick={() => setShowAddCommitteeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Anggota Panitia</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {committee.map((c) => (
              <div key={c.id} className="rounded-3xl glass-card glass-card-hover p-5 shadow-sm space-y-3 relative overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/80 border border-purple-200 px-3 py-1 rounded-full">
                  {c.role}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{c.memberName}</h3>
                  <p className="text-xs text-slate-500">{c.className || 'Dewan Pembina'}</p>
                </div>
                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-200/60 font-mono">
                  <span>SK No: {c.skNumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAILS & EMERGENCY TOOLS */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Jejak Audit Keamanan Sistem (Tamper-Proof Audit Trails)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Log forensik otomatis untuk melacak setiap transaksi otentikasi, voting, dan mutasi data
              </p>
            </div>
            <button
              onClick={handleResetSample}
              className="px-3.5 py-2.5 rounded-xl border border-rose-300/80 bg-rose-50/80 hover:bg-rose-100 text-rose-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Kembalikan database ke data simulasi awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Data Simulasi Demo</span>
            </button>
          </div>

          <div className="rounded-3xl glass-panel p-5 md:p-6 shadow-md space-y-4">
            <div className="overflow-x-auto border border-white/80 rounded-2xl bg-white/40 backdrop-blur-md shadow-inner">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100/80 backdrop-blur-md text-slate-700 font-bold border-b border-slate-200/80 font-sans">
                  <tr>
                    <th className="p-3">Waktu (UTC/WIB)</th>
                    <th className="p-3">Tingkat Peran</th>
                    <th className="p-3">Tindakan / Action</th>
                    <th className="p-3">Rincian Peristiwa</th>
                    <th className="p-3">Alamat IP</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/80 transition-colors">
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="p-3 font-sans font-semibold text-slate-900">{log.userRole}</td>
                      <td className="p-3 font-bold text-sky-700">{log.action}</td>
                      <td className="p-3 font-sans text-slate-600 max-w-md truncate">{log.details}</td>
                      <td className="p-3 text-slate-400">{log.ipAddress}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                            log.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : log.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VIDEO OPENING MANAGEMENT & UPLOAD MENU */}
      {activeTab === 'video' && (() => {
        const activePeriod = periods.find((p) => p.status === 'active') || periods[0];
        const candidates = electionStore.getCandidates(activePeriod?.id || '');
        const ytEmbed = school.openingVideoUrl ? (() => {
          const m = school.openingVideoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
          return (m && m[2].length === 11) ? `https://www.youtube.com/embed/${m[2]}` : null;
        })() : null;

        return (
          <div className="space-y-6">
            {/* Main Video Settings Card - Glassmorphism */}
            <div className="rounded-3xl glass-panel p-6 md:p-8 shadow-md space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                    <Film className="w-4 h-4" />
                    <span>Media Pembukaan Sinematik</span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                    Pengaturan & Menu Upload Video Opening
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Kelola video pembuka yang diputar secara sinematik sebelum pengguna memasuki aplikasi {school.type} {school.name}.
                  </p>
                </div>

                {/* Instant Play Test Button */}
                <button
                  type="button"
                  onClick={() => setShowOpeningPreview(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-102 active:scale-98 shrink-0"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Uji Putar Video Sekarang</span>
                </button>
              </div>

              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-card border border-white/80 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${school.openingVideoUrl ? 'bg-rose-500 animate-pulse shadow-sm shadow-rose-500/50' : 'bg-sky-500 animate-pulse shadow-sm shadow-sky-500/50'}`} />
                  <div>
                    <span className="font-bold text-slate-900">
                      Status Video Saat Ini:{' '}
                    </span>
                    <span className={`font-semibold ${school.openingVideoUrl ? 'text-rose-600' : 'text-sky-600'}`}>
                      {school.openingVideoUrl 
                        ? (school.openingVideoTitle ? `Video Khusus (${school.openingVideoTitle})` : 'Video Dokumen Khusus Sekolah') 
                        : 'Animasi Siaran Motion Graphic TV (Bawaan Sistem)'}
                    </span>
                  </div>
                </div>

                {school.openingVideoUrl && (
                  <button
                    type="button"
                    onClick={handleResetOpeningVideo}
                    className="text-xs text-slate-500 hover:text-rose-600 underline font-semibold cursor-pointer"
                  >
                    Kembalikan ke Animasi Bawaan
                  </button>
                )}
              </div>

              {/* Upload Menus: 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MENU 1: Upload File Video MP4/WebM */}
                <div className="p-6 rounded-3xl border-2 border-dashed border-rose-300/80 bg-rose-50/30 backdrop-blur-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Menu 1: Unggah File Video Langsung
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Unggah file video promosi/pembukaan sekolah dari komputer Anda dalam format MP4 atau WebM (Maksimal 50MB).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 transform hover:scale-101">
                      <Video className="w-4 h-4" />
                      <span>{isUploadingVideo ? 'Memproses Video...' : 'Pilih & Upload File Video MP4'}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleUploadOpeningVideoFile}
                        disabled={isUploadingVideo}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-center text-slate-400">
                      Disarankan resolusi 16:9 (1280x720 atau 1920x1080)
                    </p>
                  </div>
                </div>

                {/* MENU 2: Input URL YouTube / Direct Video Link */}
                <div className="p-6 rounded-3xl glass-card border border-white/80 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                      <FileVideo className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Menu 2: Tautan URL Video (YouTube / Online)
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Masukkan tautan video YouTube atau URL streaming video MP4 yang sudah di-hosting online.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={openingVideoInputUrl}
                        onChange={(e) => setOpeningVideoInputUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... atau link MP4"
                        className="flex-1 px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOpeningVideoUrl(openingVideoInputUrl)}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Simpan
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Mendukung format link YouTube standar, youtu.be, atau URL video langsung
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="pt-4 border-t border-slate-200/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-sky-600" />
                  <span>Pratinjau Video Aktif</span>
                </h4>

                <div className="relative rounded-3xl overflow-hidden border border-white/20 bg-slate-950 aspect-video max-w-2xl mx-auto shadow-2xl flex items-center justify-center">
                  {ytEmbed ? (
                    <iframe
                      src={ytEmbed}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Preview Video Opening"
                    />
                  ) : school.openingVideoUrl ? (
                    <video
                      src={school.openingVideoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    /* Built-in Motion Graphic Preview Placeholder */
                    <div className="text-center p-8 space-y-4">
                      <div className="w-16 h-16 rounded-3xl bg-slate-900 border-2 border-sky-400/80 mx-auto flex items-center justify-center text-sky-400 shadow-xl animate-pulse">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-sky-400">
                          Animasi Digital Siaran TV Aktif
                        </p>
                        <h3 className="text-base font-bold text-white">
                          Hitung Mundur · Emblem {school.type} {school.name} · Parade Paslon
                        </h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Dilengkapi efek suara bioskop Web Audio API yang diputar otomatis sebelum masuk ke aplikasi.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOpeningPreview(true)}
                        className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold shadow cursor-pointer transition-all"
                      >
                        Putar Pratinjau Lengkap
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: PREVIEW OPENING SEQUENCE */}
      {showOpeningPreview && (() => {
        const activePeriod = periods.find((p) => p.status === 'active') || periods[0];
        const candidates = electionStore.getCandidates(activePeriod?.id || '');
        return (
          <OpeningSequence
            school={school}
            period={activePeriod}
            candidates={candidates}
            onComplete={() => setShowOpeningPreview(false)}
          />
        );
      })()}

      {/* MODAL: CREATE NEW PERIOD */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-lg glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Buat Periode Pemilihan Baru</h3>
              <button onClick={() => setShowNewPeriodModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Periode</label>
                <input
                  type="text"
                  value={newPeriod.periodName}
                  onChange={(e) => setNewPeriod({ ...newPeriod, periodName: e.target.value })}
                  placeholder="Contoh: Pemilihan Umum Ketua OSIS 2027/2028"
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    value={newPeriod.academicYear}
                    onChange={(e) => setNewPeriod({ ...newPeriod, academicYear: e.target.value })}
                    placeholder="2027/2028"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Awal</label>
                  <select
                    value={newPeriod.status}
                    onChange={(e) => setNewPeriod({ ...newPeriod, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-800 focus:outline-none"
                  >
                    <option value="draft">Draft (Persiapan)</option>
                    <option value="active">Langsung Aktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Waktu Buka Bilik</label>
                  <input
                    type="time"
                    value={newPeriod.votingOpenTime}
                    onChange={(e) => setNewPeriod({ ...newPeriod, votingOpenTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Waktu Tutup Bilik</label>
                  <input
                    type="time"
                    value={newPeriod.votingCloseTime}
                    onChange={(e) => setNewPeriod({ ...newPeriod, votingCloseTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowNewPeriodModal(false)}
                  className="px-3.5 py-1.5 rounded-xl glass-button text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm cursor-pointer transition-colors"
                >
                  Simpan Periode Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD COMMITTEE MEMBER */}
      {showAddCommitteeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Tambah Panitia Ber-SK</h3>
              <button onClick={() => setShowAddCommitteeModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCommittee} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Anggota</label>
                <input
                  type="text"
                  value={newMember.memberName}
                  onChange={(e) => setNewMember({ ...newMember, memberName: e.target.value })}
                  placeholder="Contoh: Rian Pratama"
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Peran / Jabatan</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value as any })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-800 focus:outline-none"
                >
                  <option value="Ketua Panitia">Ketua Panitia</option>
                  <option value="Sekretaris">Sekretaris</option>
                  <option value="Bendahara">Bendahara</option>
                  <option value="Koordinator IT & Bilik">Koordinator IT & Bilik</option>
                  <option value="Seksi Logistik">Seksi Logistik</option>
                  <option value="Pengawas / Saksi">Pengawas / Saksi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor SK Kepala Sekolah</label>
                <input
                  type="text"
                  value={newMember.skNumber}
                  onChange={(e) => setNewMember({ ...newMember, skNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowAddCommitteeModal(false)}
                  className="px-3.5 py-1.5 rounded-xl glass-button text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm cursor-pointer transition-colors"
                >
                  Simpan SK Panitia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OFFICIAL BAHP */}
      {showBahpModal && (
        <PrintBeritaAcara
          school={school}
          summary={selectedBahpPeriodId ? electionStore.getSummary(selectedBahpPeriodId) : summary}
          committee={committee}
          onClose={() => setShowBahpModal(false)}
        />
      )}

      {/* MODAL: SURAT BUKTI FISIK SK PANITIA PEMILIHAN (1-99 HALAMAN) */}
      {showSkModal && (
        <PrintSkPanitia
          school={school}
          period={summary.period}
          committee={committee}
          onClose={() => setShowSkModal(false)}
        />
      )}

      {/* MODAL: CONFIRM DELETE PERIOD */}
      {confirmDeletePeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100/80 border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Konfirmasi Hapus Periode</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus periode <strong className="text-slate-900">{confirmDeletePeriod.periodName}</strong> (Tahun Ajaran {confirmDeletePeriod.academicYear})?
            </p>
            
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs leading-relaxed">
              <strong>Peringatan:</strong> Seluruh data kandidat (paslon), DPT siswa, dan perolehan suara yang terikat dengan periode ini juga akan dihapus secara permanen.
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setConfirmDeletePeriod(null)}
                className="px-4 py-2 rounded-xl glass-button text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeletePeriod(confirmDeletePeriod.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Periode Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
