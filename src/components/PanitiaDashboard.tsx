/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Portal Panitia Pemilihan:
 * Candidate Pair Management, DPT Management, Bulk PIN Generator,
 * Printable Token Cards, and Real-time Booth Monitoring.
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Users, UserPlus, KeyRound, Printer, Upload, Download, Search,
  Filter, CheckCircle2, Clock, Trash2, Edit, RefreshCw, X, Plus,
  ShieldCheck, AlertTriangle, Video, Play, FileVideo, Camera, Image as ImageIcon,
  Film, FileText
} from 'lucide-react';
import { SchoolConfig, ElectionPeriod, Candidate, Voter } from '../types';
import { electionStore } from '../lib/store';
import { CandidateAvatar, SchoolCrestLogo } from './CandidateAvatar';
import { PrintTokenCards } from './PrintTokenCards';
import { OpeningSequence } from './OpeningSequence';
import { PrintSkPanitia } from './PrintSkPanitia';
import { GarudaIcon } from './GarudaIcon';

interface PanitiaDashboardProps {
  school: SchoolConfig;
  period: ElectionPeriod;
}

export const PanitiaDashboard: React.FC<PanitiaDashboardProps> = ({ school, period }) => {
  const [activeTab, setActiveTab] = useState<'dpt' | 'paslon' | 'monitoring' | 'logo' | 'video'>('dpt');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VOTED' | 'UNVOTED'>('ALL');

  // Modals state
  const [showAddVoterModal, setShowAddVoterModal] = useState(false);
  const [showImportCsvModal, setShowImportCsvModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSkModal, setShowSkModal] = useState(false);
  const [previewOpeningVideo, setPreviewOpeningVideo] = useState(false);
  const [customVideoUrlInput, setCustomVideoUrlInput] = useState(school.openingVideoUrl || '');
  const [csvRawText, setCsvRawText] = useState('');
  const [alertNotice, setAlertNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subscribe to real-time store changes from Admin or other devices
  const [, setStoreVersion] = useState(0);
  useEffect(() => {
    const unsub = electionStore.subscribe(() => {
      setStoreVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  // Form states for Single Voter Add
  const [newVoter, setNewVoter] = useState({
    nisn: '',
    fullName: '',
    className: 'VII A',
    gradeLevel: 'VII',
    gender: 'L' as 'L' | 'P',
  });

  // Form states for Candidate
  const [candForm, setCandForm] = useState<Omit<Candidate, 'id'>>({
    electionPeriodId: period.id,
    ballotNumber: 1,
    chairmanName: '',
    viceChairmanName: '',
    chairmanClass: 'VIII A',
    viceChairmanClass: 'VII A',
    photoUrl: '',
    chairmanPhotoUrl: '',
    viceChairmanPhotoUrl: '',
    motto: '',
    vision: '',
    mission: ['', '', ''],
    programs: ['', '', ''],
    videoUrl: '',
  });

  const voters = electionStore.getVoters(period.id);
  const candidates = electionStore.getCandidates(period.id);
  const summary = electionStore.getSummary(period.id);
  const committee = electionStore.getCommittee(period.id);

  // Class list extracted dynamically
  const uniqueClasses = Array.from(new Set(voters.map((v) => v.className))).sort();

  // Filtered DPT
  const filteredVoters = voters.filter((v) => {
    const matchSearch =
      v.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.nisn.includes(searchQuery);

    const matchClass =
      classFilter === 'ALL' ||
      (classFilter === 'VII' && v.gradeLevel === 'VII') ||
      (classFilter === 'VIII' && v.gradeLevel === 'VIII') ||
      (classFilter === 'IX' && v.gradeLevel === 'IX') ||
      v.className === classFilter;

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'VOTED' && v.hasVoted) ||
      (statusFilter === 'UNVOTED' && !v.hasVoted);

    return matchSearch && matchClass && matchStatus;
  });

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertNotice({ type, message });
    setTimeout(() => setAlertNotice(null), 4000);
  };

  const handleAddVoter = (e: React.FormEvent) => {
    e.preventDefault();
    const res = electionStore.addVoter(newVoter);
    if (!res.success) {
      showAlert(res.message, 'error');
      return;
    }
    showAlert(`Pemilih ${newVoter.fullName} berhasil ditambahkan ke DPT. PIN: ${res.voter?.pinPlain}`);
    setShowAddVoterModal(false);
    setNewVoter({
      nisn: '',
      fullName: '',
      className: 'VII A',
      gradeLevel: 'VII',
      gender: 'L',
    });
  };

  const handleResetPin = (voterId: string) => {
    const res = electionStore.resetVoterPin(voterId);
    if (!res.success) {
      showAlert(res.message, 'error');
    } else {
      showAlert(`PIN baru berhasil dibuat: ${res.newPin}`);
    }
  };

  const handleResetSingleStatus = (voterId: string) => {
    if (confirm('Apakah Anda yakin ingin mereset status bilik siswa ini menjadi "Belum Memilih"? Token PIN baru akan dibuat.')) {
      const res = electionStore.resetSingleVoterStatusToUnvoted(voterId);
      if (!res.success) {
        showAlert(res.message, 'error');
      } else {
        showAlert(res.message);
      }
    }
  };

  const handleDeleteVoter = (voterId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus siswa ini dari DPT?')) {
      const res = electionStore.deleteVoter(voterId);
      if (!res.success) {
        showAlert(res.message, 'error');
      } else {
        showAlert('Pemilih berhasil dihapus dari DPT.');
      }
    }
  };

  const handleDeleteAllVoters = () => {
    if (voters.length === 0) {
      showAlert('Data DPT sudah kosong.', 'error');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin MENGHAPUS SEMUA (${voters.length}) data siswa dari DPT? Data pemilih akan terhapus sepenuhnya.`)) {
      const res = electionStore.deleteAllVoters(period.id);
      showAlert(`Berhasil menghapus seluruh ${res.count} data siswa dari DPT.`);
    }
  };

  const handleResetAllStatusToUnvoted = () => {
    if (confirm('Apakah Anda yakin ingin mereset status bilik seluruh siswa kembali ke pengaturan awal ("Belum Memilih")? Token PIN baru juga akan dibuat untuk seluruh siswa.')) {
      const res = electionStore.resetVotersStatusToUnvoted(period.id);
      showAlert(`Status bilik seluruh siswa berhasil direset ke pengaturan awal ("Belum Memilih"). PIN token baru telah dibuat.`);
    }
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showAlert('Ukuran video terlalu besar. Maksimal 50MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCandForm((prev) => ({ ...prev, videoUrl: reader.result as string }));
        showAlert('File video orasi & kampanye berhasil diunggah.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChairmanPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showAlert('Ukuran foto Calon Ketua terlalu besar. Maksimal 10MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCandForm((prev) => ({ ...prev, chairmanPhotoUrl: reader.result as string }));
        showAlert('Foto Calon Ketua berhasil diunggah.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleViceChairmanPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showAlert('Ukuran foto Calon Wakil Ketua terlalu besar. Maksimal 10MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCandForm((prev) => ({ ...prev, viceChairmanPhotoUrl: reader.result as string }));
        showAlert('Foto Calon Wakil Ketua berhasil diunggah.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOsisLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showAlert('Ukuran file logo terlalu besar. Maksimal 10MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const logoData = reader.result as string;
        electionStore.updateSchool({ logoUrl: logoData });
        showAlert('Logo OSIS / Sekolah berhasil diunggah & diperbarui!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetOsisLogo = () => {
    if (confirm('Apakah Anda yakin ingin mereset logo ke lambang OSIS vektor bawaan?')) {
      electionStore.updateSchool({ logoUrl: '' });
      showAlert('Logo OSIS berhasil direset ke lambang default.');
    }
  };

  const handleBulkGeneratePins = () => {
    const count = electionStore.generateMissingPins();
    showAlert(`${count} PIN token baru berhasil dibuat.`);
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        const rows: { nisn: string; fullName: string; className: string; gender: string }[] = [];

        rawData.forEach((row: any, idx: number) => {
          if (!row || row.length === 0) return;
          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();
          // Skip header row if it contains NISN or Nama
          if (idx === 0 && (col0.toUpperCase().includes('NISN') || col1.toUpperCase().includes('NAMA'))) {
            return;
          }
          if (col0 && col1) {
            rows.push({
              nisn: col0,
              fullName: col1,
              className: String(row[2] || 'VII A').trim(),
              gender: String(row[3] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L',
            });
          }
        });

        if (rows.length === 0) {
          showAlert('Tidak ada data siswa yang valid ditemukan dalam file Excel.', 'error');
          return;
        }

        const res = electionStore.bulkImportVoters(rows);
        showAlert(`Berhasil mengimpor ${res.added} siswa dari file Excel! ${res.skipped} data dilewati.`);
        setShowImportCsvModal(false);
      } catch (err) {
        showAlert('Gagal membaca file Excel. Pastikan format file .xlsx / .xls sesuai.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportCsv = () => {
    if (!csvRawText.trim()) {
      showAlert('Silakan masukkan isi baris data atau unggah file Excel.', 'error');
      return;
    }

    const lines = csvRawText.trim().split('\n');
    const rows = lines.map((line) => {
      const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      return {
        nisn: cols[0] || '',
        fullName: cols[1] || '',
        className: cols[2] || '',
        gender: cols[3] || 'L',
      };
    }).filter((r) => r.nisn && r.fullName && !r.nisn.toUpperCase().includes('NISN'));

    const res = electionStore.bulkImportVoters(rows);
    showAlert(`Berhasil mengimpor ${res.added} siswa. ${res.skipped} data dilewati.`);
    setShowImportCsvModal(false);
    setCsvRawText('');
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      { 'NISN': '0111234101', 'Nama Lengkap': 'Budi Santoso', 'Kelas': 'VII A', 'Jenis Kelamin': 'L' },
      { 'NISN': '0111234102', 'Nama Lengkap': 'Dewi Lestari', 'Kelas': 'VII A', 'Jenis Kelamin': 'P' },
      { 'NISN': '0101234201', 'Nama Lengkap': 'Eko Prasetyo', 'Kelas': 'VIII B', 'Jenis Kelamin': 'L' },
      { 'NISN': '0091234301', 'Nama Lengkap': 'Fitri Handayani', 'Kelas': 'IX C', 'Jenis Kelamin': 'P' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DPT Siswa');
    XLSX.writeFile(workbook, 'template_dpt_pilketos_smp.xlsx');
  };

  const handleSaveCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCandidate) {
      electionStore.updateCandidate(editingCandidate.id, candForm);
      showAlert(`Data Paslon No. ${candForm.ballotNumber} berhasil diperbarui.`);
    } else {
      electionStore.addCandidate(candForm);
      showAlert(`Paslon No. ${candForm.ballotNumber} berhasil ditambahkan.`);
    }
    setShowCandidateModal(false);
    setEditingCandidate(null);
  };

  const openEditCandidate = (cand: Candidate) => {
    setEditingCandidate(cand);
    setCandForm({
      electionPeriodId: cand.electionPeriodId,
      ballotNumber: cand.ballotNumber,
      chairmanName: cand.chairmanName,
      viceChairmanName: cand.viceChairmanName,
      chairmanClass: cand.chairmanClass,
      viceChairmanClass: cand.viceChairmanClass,
      photoUrl: cand.photoUrl,
      chairmanPhotoUrl: cand.chairmanPhotoUrl || '',
      viceChairmanPhotoUrl: cand.viceChairmanPhotoUrl || '',
      motto: cand.motto,
      vision: cand.vision,
      mission: cand.mission,
      programs: cand.programs,
      videoUrl: cand.videoUrl,
    });
    setShowCandidateModal(true);
  };

  const handleSaveOpeningVideo = (url: string) => {
    electionStore.updateSchool({
      openingVideoUrl: url.trim(),
    });
    setCustomVideoUrlInput(url.trim());
    showAlert('Pengaturan Video Opening berhasil disimpan!', 'success');
  };

  const handleOpeningVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      showAlert('Ukuran file video terlalu besar (maksimal 50MB).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      electionStore.updateSchool({
        openingVideoUrl: dataUrl,
        openingVideoTitle: file.name,
      });
      setCustomVideoUrlInput(dataUrl);
      showAlert(`Video opening "${file.name}" berhasil diunggah!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleResetOpeningVideo = () => {
    electionStore.updateSchool({
      openingVideoUrl: '',
      openingVideoTitle: '',
    });
    setCustomVideoUrlInput('');
    showAlert('Video opening dikembalikan ke animasi default Motion Graphic Siaran TV!', 'success');
  };

  return (
    <div className="no-print-dashboard space-y-6 pb-16">
      {/* Top Banner - Glassmorphism */}
      <div className="rounded-3xl glass-panel p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-500/10 border border-sky-400/30 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>Kepanitiaan Pemilihan Ber-SK</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSkModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100/90 hover:bg-purple-200/90 border border-purple-300 transition-all cursor-pointer shadow-xs transform hover:scale-102 active:scale-98"
              title="Buka & Edit Surat Bukti Fisik SK Panitia Resmi (1-99 Halaman)"
            >
              <FileText className="w-3 h-3" />
              <span>Surat Bukti Fisik & Edit SK (1-99 Hal)</span>
            </button>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-2">
            Portal Panitia Pemilihan (E-Pilketos)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Pengelolaan Paslon, DPT Siswa, Generator PIN Token, dan Monitoring Bilik Suara
          </p>
        </div>

        {/* Tab Navigation - Glass Tab Bar */}
        <div className="flex items-center gap-1.5 glass-tab-bar p-1.5 rounded-2xl self-start md:self-auto flex-wrap relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('dpt')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'dpt'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Daftar DPT & PIN
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paslon')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'paslon'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Pasangan Calon
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monitoring')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'monitoring'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Monitoring Bilik
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logo')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'logo'
                ? 'glass-button bg-white text-slate-950 shadow-sm font-bold border-white'
                : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
            }`}
          >
            Upload Logo OSIS
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
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between shadow-md glass-panel animate-in fade-in ${
            alertNotice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-900 border-emerald-300/60'
              : 'bg-rose-500/10 text-rose-900 border-rose-300/60'
          }`}
        >
          <span>{alertNotice.message}</span>
          <button onClick={() => setAlertNotice(null)} className="cursor-pointer text-slate-500 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: DPT & TOKEN PIN */}
      {activeTab === 'dpt' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar - Frosted Glass Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl glass-card glass-card-hover border border-white/70 shadow-xs relative overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total DPT</span>
              <p className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">{voters.length}</p>
            </div>
            <div className="p-4 rounded-2xl glass-card glass-card-hover border border-white/70 shadow-xs relative overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Sudah Memilih</span>
              <p className="text-2xl font-black text-emerald-600 font-mono-numbers mt-1">
                {voters.filter((v) => v.hasVoted).length}
              </p>
            </div>
            <div className="p-4 rounded-2xl glass-card glass-card-hover border border-white/70 shadow-xs relative overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Belum Memilih</span>
              <p className="text-2xl font-black text-amber-600 font-mono-numbers mt-1">
                {voters.filter((v) => !v.hasVoted).length}
              </p>
            </div>
            <div className="p-4 rounded-2xl glass-card glass-card-hover border border-white/70 shadow-xs relative overflow-hidden">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Token Tercetak</span>
              <p className="text-2xl font-black text-sky-600 font-mono-numbers mt-1">
                {voters.filter((v) => v.tokenPrinted).length}
              </p>
            </div>
          </div>

          {/* Action Toolbar - Glassmorphic Panel */}
          <div className="rounded-3xl glass-panel p-5 md:p-6 shadow-md space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search & Filters */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau NISN..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                {/* Grade / Class Filter */}
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl glass-input font-medium text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Tingkat</option>
                  <option value="VII">Kelas VII (7)</option>
                  <option value="VIII">Kelas VIII (8)</option>
                  <option value="IX">Kelas IX (9)</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs rounded-xl glass-input font-medium text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="UNVOTED">Belum Memilih</option>
                  <option value="VOTED">Sudah Memilih</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAddVoterModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Siswa</span>
                </button>
                <button
                  onClick={() => setShowImportCsvModal(true)}
                  className="px-3.5 py-2 rounded-xl glass-button text-slate-700 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload Data Excel</span>
                </button>
                <button
                  onClick={handleBulkGeneratePins}
                  className="px-3.5 py-2 rounded-xl border border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/90 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Generate PIN acak untuk siswa yang belum memiliki PIN"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Generate PIN</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer transform hover:scale-101"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Kartu Suara</span>
                </button>
              </div>
            </div>

            {/* DPT Table - Translucent Frosted Glass Table */}
            <div className="overflow-x-auto border border-white/80 rounded-2xl bg-white/40 backdrop-blur-md shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 backdrop-blur-md text-slate-700 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">NISN (10 Digit)</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3 text-center">JK</th>
                    <th className="p-3">Token PIN Rahasia</th>
                    <th className="p-3">Status Bilik</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 text-slate-700">
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Tidak ada data pemilih yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters.map((v, index) => (
                      <tr key={v.id} className="hover:bg-white/80 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-400">{index + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{v.nisn}</td>
                        <td className="p-3 font-semibold text-slate-900">{v.fullName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-200/60 backdrop-blur-xs text-slate-800 font-semibold border border-white/60">
                            {v.className}
                          </span>
                        </td>
                        <td className="p-3 text-center font-medium">{v.gender}</td>
                        <td className="p-3">
                          {v.hasVoted ? (
                            <span className="text-slate-400 font-mono italic">HANGUS (Terpakai)</span>
                          ) : (
                            <span className="font-mono font-bold text-slate-900 bg-amber-100/70 border border-amber-300/80 px-2 py-0.5 rounded-lg shadow-2xs">
                              {v.pinPlain || '******'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {v.hasVoted ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100/70 border border-emerald-300/70 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sudah Memilih</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100/70 border border-amber-300/70 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Belum Memilih</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          {v.hasVoted ? (
                            <button
                              onClick={() => handleResetSingleStatus(v.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] text-purple-700 hover:bg-purple-100/70 border border-purple-200 font-semibold cursor-pointer transition-colors"
                              title="Reset status siswa ini menjadi Belum Memilih & buat PIN baru"
                            >
                              Reset Status
                            </button>
                          ) : (
                            <button
                              onClick={() => handleResetPin(v.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] text-amber-800 hover:bg-amber-100/70 border border-amber-200 font-semibold cursor-pointer transition-colors"
                              title="Reset PIN baru jika kartu hilang atau rusak"
                            >
                              Reset PIN
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVoter(v.id)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-100/60 transition-colors cursor-pointer"
                            title="Hapus pemilih dari DPT"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Menampilkan {filteredVoters.length} dari {voters.length} siswa DPT.</span>
              <span>Kerahasiaan PIN token wajib dijaga oleh Panitia Meja Registrasi.</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE MANAGEMENT (PASLON) */}
      {activeTab === 'paslon' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Pasangan Calon Terdaftar (Periode {period.academicYear})
              </h2>
              <p className="text-xs text-slate-500">
                Kelola nomor urut, biodata, visi, misi, dan program kerja unggulan
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCandidate(null);
                setCandForm({
                  electionPeriodId: period.id,
                  ballotNumber: candidates.length + 1,
                  chairmanName: '',
                  viceChairmanName: '',
                  chairmanClass: 'VIII A',
                  viceChairmanClass: 'VII A',
                  photoUrl: '',
                  chairmanPhotoUrl: '',
                  viceChairmanPhotoUrl: '',
                  motto: '',
                  vision: '',
                  mission: ['', '', ''],
                  programs: ['', '', ''],
                  videoUrl: '',
                });
                setShowCandidateModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Daftarkan Paslon Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="rounded-3xl glass-card glass-card-hover p-6 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-900 text-white font-black text-sm shadow-sm">
                      {cand.ballotNumber < 10 ? `0${cand.ballotNumber}` : cand.ballotNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCandidate(cand)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/80 rounded-xl transition-all cursor-pointer"
                        title="Edit data paslon"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus Paslon No. ${cand.ballotNumber}?`)) {
                            electionStore.deleteCandidate(cand.id);
                            showAlert(`Paslon No. ${cand.ballotNumber} berhasil dihapus.`);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-100/70 rounded-xl transition-all cursor-pointer"
                        title="Hapus paslon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center py-1">
                    <CandidateAvatar
                      ballotNumber={cand.ballotNumber}
                      chairmanName={cand.chairmanName}
                      viceChairmanName={cand.viceChairmanName}
                      chairmanPhotoUrl={cand.chairmanPhotoUrl}
                      viceChairmanPhotoUrl={cand.viceChairmanPhotoUrl}
                      photoUrl={cand.photoUrl}
                      size="md"
                    />
                  </div>

                  <div className="text-center space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900">{cand.chairmanName}</h3>
                    <p className="text-xs text-slate-500">Ketua · {cand.chairmanClass}</p>
                    <h4 className="text-xs font-semibold text-slate-800 pt-1">{cand.viceChairmanName}</h4>
                    <p className="text-[11px] text-slate-400">Wakil · {cand.viceChairmanClass}</p>
                  </div>

                  <p className="text-xs italic text-slate-700 bg-white/60 p-2.5 rounded-xl border border-white/80 text-center line-clamp-2 shadow-2xs">
                    "{cand.motto}"
                  </p>

                  {/* Video Orasi & Kampanye Paslon */}
                  {cand.videoUrl ? (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-sky-600" />
                        <span>Video Orasi & Kampanye Paslon:</span>
                      </span>
                      <video
                        src={cand.videoUrl}
                        controls
                        className="w-full h-36 rounded-2xl border border-white/80 bg-black object-cover shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl border border-dashed border-slate-300/80 bg-white/40 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Belum ada video orasi & kampanye</p>
                      <button
                        onClick={() => openEditCandidate(cand)}
                        className="mt-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Video Orasi</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200/60 text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>{cand.mission.length} Misi</span>
                  <span>·</span>
                  <span>{cand.programs.length} Program Kerja</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MONITORING BILIK SUARA */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl glass-card glass-card-hover p-6 shadow-md space-y-3 relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tingkat Partisipasi Total</span>
              <p className="text-4xl font-black text-slate-900 font-mono-numbers">
                {summary.participationPercentage}%
              </p>
              <p className="text-xs text-slate-600">
                {summary.totalVoted} dari {summary.totalVoters} DPT telah menyalurkan suara
              </p>
              <div className="w-full bg-slate-200/70 rounded-full h-2.5 overflow-hidden mt-2">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500 shadow-xs"
                  style={{ width: `${summary.participationPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="rounded-3xl glass-card glass-card-hover p-6 shadow-md space-y-3 relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Bilik Suara</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50"></span>
                <span className="text-base font-black text-slate-900 tracking-tight">BILIK DIGITAL AKTIF</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sesi pemilihan berjalan lancar tanpa kendala teknis atau laporan anomali.
              </p>
            </div>

            <div className="rounded-3xl glass-card glass-card-hover p-6 shadow-md space-y-3 relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kepatuhan LUBER-JURDIL</span>
              <div className="flex items-center gap-1.5 text-sky-700 text-sm font-black mt-1">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <span>100% TERISOLASI & AMAN</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tabel suara terpisah secara fisik dari identitas pemilih. Pilihan dijamin rahasia.
              </p>
            </div>
          </div>

          {/* Real-time Class Progress Grid */}
          <div className="rounded-3xl glass-panel p-6 shadow-md space-y-4">
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Progres Pemungutan Suara per Rombongan Belajar (Kelas)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.classParticipation.map((cp) => (
                <div key={cp.className} className="p-4 rounded-2xl glass-card border border-white/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">{cp.className}</span>
                    <span className="text-xs font-black text-slate-900 font-mono-numbers">
                      {cp.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        cp.percentage >= 80 ? 'bg-emerald-500' : cp.percentage >= 50 ? 'bg-sky-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${cp.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Hadir: {cp.voted} siswa</span>
                    <span>Total: {cp.total} DPT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UPLOAD LOGO OSIS */}
      {activeTab === 'logo' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 md:p-8 shadow-md space-y-6">
            <div className="border-b border-slate-200/60 pb-5">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-sky-600" />
                <span>Pengaturan & Upload Logo OSIS / Sekolah</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Unggah logo resmi OSIS / OSIM atau lambang sekolah Anda. Logo ini akan otomatis ditampilkan pada Kop Surat Kartu Suara, Berita Acara (BAHP), Papan Hitung Cepat, dan Bilik Suara Digital.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Current Logo Card & Quick Action */}
              <div className="p-6 rounded-2xl glass-card border border-white/80 space-y-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Pratinjau Logo OSIS Saat Ini
                  </span>
                  <div className="flex items-center gap-4 bg-white/70 p-4 rounded-2xl border border-white/80 shadow-2xs backdrop-blur-xs">
                    <SchoolCrestLogo size={72} type={school.type} logoUrl={school.logoUrl} />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">{school.name}</h4>
                      <p className="text-xs text-slate-600">
                        Status Logo:{' '}
                        {school.logoUrl ? (
                          <span className="text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-lg border border-emerald-300/80 inline-block">
                            ✓ Custom Logo Terpasang
                          </span>
                        ) : (
                          <span className="text-sky-800 font-bold bg-sky-100/70 px-2 py-0.5 rounded-lg border border-sky-300/80 inline-block">
                            Vektor Logo Default
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        NPSN: {school.npsn} · Jenis: {school.type}
                      </p>
                    </div>
                  </div>
                </div>

                {school.logoUrl && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetOsisLogo}
                      className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer w-full justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus & Reset ke Logo Default</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Upload Box */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-sky-300/80 bg-sky-50/40 backdrop-blur-xs flex flex-col justify-center items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Unggah File Logo Baru
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                    Format gambar yang didukung: PNG, JPG, WEBP, SVG (Maksimal 10MB). Disarankan menggunakan gambar dengan latar transparan.
                  </p>
                </div>

                <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-sky-500/20 cursor-pointer transition-all flex items-center gap-2 transform hover:scale-102">
                  <Camera className="w-4 h-4" />
                  <span>Pilih File Logo OSIS</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOsisLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PENGATURAN & PREVIEW VIDEO OPENING */}
      {activeTab === 'video' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                  <Film className="w-4 h-4" />
                  <span>Fitur Video Pembukaan Aplikasi</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Pengaturan & Uji Putar Video Opening
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Video ini ditampilkan secara cinematic saat pengguna membuka aplikasi sebelum masuk ke dashboard/bilik suara.
                </p>
              </div>

              {/* Instant Test Play Button */}
              <button
                type="button"
                onClick={() => setPreviewOpeningVideo(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-102 active:scale-98 shrink-0"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Uji Putar Video Sekarang</span>
              </button>
            </div>

            {/* Video Mode Selection & Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Motion Graphic Broadcast (Built-in) */}
              <div className={`p-5 rounded-2xl border transition-all ${
                !school.openingVideoUrl 
                  ? 'border-sky-400 bg-sky-50/60 ring-2 ring-sky-400/30 glass-card' 
                  : 'border-white/80 bg-white/50 glass-card'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-100/80 text-sky-800">
                    Opsi 1 (Bawaan Sistem)
                  </span>
                  {!school.openingVideoUrl && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-sky-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>Sedang Aktif</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <GarudaIcon className="w-4 h-4 text-amber-500" />
                    <span>Animasi Digital Siaran TV (Motion Graphic)</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Animasi sinematik interaktif dengan hitung mundur peluncuran (3, 2, 1), reveal logo & nama sekolah ({school.name}), parade paslon terdaftar, serta sintesis efek suara bioskop otomatis via Web Audio API.
                  </p>
                  <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside pt-1 font-medium">
                    <li>Tidak memerlukan file eksternal (anti-lemot & hemat kuota)</li>
                    <li>Otomatis menyesuaikan dengan logo & nama sekolah</li>
                    <li>Dilengkapi tombol Lewati Video dan kontrol audio</li>
                  </ul>
                </div>

                {school.openingVideoUrl && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={handleResetOpeningVideo}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 underline cursor-pointer"
                    >
                      Aktifkan Kembali Animasi Bawaan Ini
                    </button>
                  </div>
                )}
              </div>

              {/* Option 2: Custom School Video Upload / URL */}
              <div className={`p-5 rounded-2xl border transition-all ${
                school.openingVideoUrl 
                  ? 'border-rose-400 bg-rose-50/60 ring-2 ring-rose-400/30 glass-card' 
                  : 'border-white/80 bg-white/50 glass-card'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100/80 text-rose-800">
                    Opsi 2 (Kustom Sekolah)
                  </span>
                  {school.openingVideoUrl && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sedang Aktif</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-rose-500" />
                    <span>Video Khusus Dokumen Sekolah (MP4 / YouTube)</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Gunakan rekaman video kreasi panitia/sekolah, klip YouTube orasi bersama, atau video sambutan kepala sekolah untuk opening aplikasi.
                  </p>
                </div>

                {/* Form Input URL & File Upload */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tautan URL Video (YouTube / Link Langsung MP4)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customVideoUrlInput}
                        onChange={(e) => setCustomVideoUrlInput(e.target.value)}
                        placeholder="Contoh: https://www.youtube.com/watch?v=... atau link MP4"
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOpeningVideo(customVideoUrlInput)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-semibold">Atau</span>
                    <label className="px-3 py-1.5 rounded-xl bg-rose-100/80 hover:bg-rose-200/80 text-rose-800 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 border border-rose-200">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File MP4 (Maks 50MB)</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleOpeningVideoFileUpload}
                        className="hidden"
                      />
                    </label>

                    {school.openingVideoUrl && (
                      <button
                        type="button"
                        onClick={handleResetOpeningVideo}
                        className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer ml-auto font-medium"
                      >
                        Hapus Video Khusus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW OPENING SEQUENCE */}
      {previewOpeningVideo && (
        <OpeningSequence
          school={school}
          period={period}
          candidates={candidates}
          onComplete={() => setPreviewOpeningVideo(false)}
        />
      )}

      {/* MODAL: ADD SINGLE VOTER */}
      {showAddVoterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Tambah Pemilih Baru (DPT)</h3>
              <button onClick={() => setShowAddVoterModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVoter} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NISN (10 Digit Angka)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={newVoter.nisn}
                  onChange={(e) => setNewVoter({ ...newVoter, nisn: e.target.value.replace(/\D/g, '') })}
                  placeholder="Contoh: 0081234567"
                  className="w-full px-3 py-2 text-xs rounded-xl glass-input font-mono text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  value={newVoter.fullName}
                  onChange={(e) => setNewVoter({ ...newVoter, fullName: e.target.value })}
                  placeholder="Contoh: Muhammad Rizki"
                  className="w-full px-3 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas
                  </label>
                  <input
                    type="text"
                    value={newVoter.className}
                    onChange={(e) => setNewVoter({ ...newVoter, className: e.target.value })}
                    placeholder="Contoh: VII A"
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-slate-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={newVoter.gender}
                    onChange={(e) => setNewVoter({ ...newVoter, gender: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-slate-800 focus:outline-none"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowAddVoterModal(false)}
                  className="px-3.5 py-1.5 rounded-xl glass-button text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm cursor-pointer transition-colors"
                >
                  Simpan & Buat PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT EXCEL / CSV */}
      {showImportCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-xl glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Import Data Siswa DPT via Excel (.xlsx / .xls)</span>
                </h3>
                <p className="text-xs text-slate-500">Unggah file Spreadsheet Excel atau salin baris data DPT</p>
              </div>
              <button onClick={() => setShowImportCsvModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200/80">
                <span className="text-emerald-900 font-medium">Format Kolom: <strong>NISN, Nama Lengkap, Kelas, JK (L/P)</strong></span>
                <button
                  type="button"
                  onClick={downloadSampleExcel}
                  className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-white/90 px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs self-start sm:self-auto transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
              </div>

              <div className="space-y-1.5 glass-card p-3.5 rounded-2xl border border-white/80">
                <label className="block text-xs font-bold text-slate-800">
                  Unggah File Excel (.xlsx, .xls) atau CSV:
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleExcelFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Atau Salin & Tempelkan Baris Data (NISN, Nama, Kelas, JK) di Sini:
                </label>
                <textarea
                  rows={5}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder="0081234101, Budi Santoso, VII A, L&#10;0081234102, Dewi Lestari, VII A, P"
                  className="w-full p-3 text-xs rounded-2xl glass-input font-mono text-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowImportCsvModal(false)}
                  className="px-3.5 py-1.5 rounded-xl glass-button text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  Mulai Import Data Teks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANDIDATE FORM (ADD / EDIT) */}
      {showCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-2xl glass-panel rounded-3xl shadow-2xl border-white/80 p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCandidate ? `Edit Paslon No. ${editingCandidate.ballotNumber}` : 'Daftarkan Pasangan Calon Baru'}
              </h3>
              <button onClick={() => setShowCandidateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Urut</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={candForm.ballotNumber}
                    onChange={(e) => setCandForm({ ...candForm, ballotNumber: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Motto Kampanye</label>
                  <input
                    type="text"
                    value={candForm.motto}
                    onChange={(e) => setCandForm({ ...candForm, motto: e.target.value })}
                    placeholder="Contoh: Bersama Mengabdi, Nyata Berprestasi"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Calon Ketua</label>
                  <input
                    type="text"
                    value={candForm.chairmanName}
                    onChange={(e) => setCandForm({ ...candForm, chairmanName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas Calon Ketua</label>
                  <input
                    type="text"
                    value={candForm.chairmanClass}
                    onChange={(e) => setCandForm({ ...candForm, chairmanClass: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Calon Wakil</label>
                  <input
                    type="text"
                    value={candForm.viceChairmanName}
                    onChange={(e) => setCandForm({ ...candForm, viceChairmanName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas Calon Wakil</label>
                  <input
                    type="text"
                    value={candForm.viceChairmanClass}
                    onChange={(e) => setCandForm({ ...candForm, viceChairmanClass: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    required
                  />
                </div>
              </div>

              {/* Upload Foto Pasangan Calon (2 Orang) */}
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span>Upload Foto Pasangan Calon (2 Orang)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">JPG, PNG, WEBP (Maks 10MB)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Foto Calon Ketua */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200/80 space-y-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Foto Calon Ketua {candForm.chairmanName ? `(${candForm.chairmanName.split(' ')[0]})` : ''}</span>
                    </span>
                    {candForm.chairmanPhotoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={candForm.chairmanPhotoUrl}
                          alt="Foto Calon Ketua"
                          className="w-14 h-14 rounded-lg object-cover border border-indigo-300 shadow-2xs"
                        />
                        <div className="space-y-1">
                          <span className="text-[11px] text-emerald-700 font-bold block">✓ Foto Terpasang</span>
                          <button
                            type="button"
                            onClick={() => setCandForm((prev) => ({ ...prev, chairmanPhotoUrl: '' }))}
                            className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
                          >
                            Hapus Foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/30 hover:bg-indigo-100/50 text-indigo-700 text-xs font-medium cursor-pointer transition-colors text-center">
                        <Upload className="w-4 h-4 mb-1 text-indigo-500" />
                        <span>Pilih Foto Calon Ketua</span>
                        <input
                          type="file"
                          accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.tiff,.avif,.heic,.heif"
                          onChange={handleChairmanPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Foto Calon Wakil Ketua */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200/80 space-y-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Foto Calon Wakil {candForm.viceChairmanName ? `(${candForm.viceChairmanName.split(' ')[0]})` : ''}</span>
                    </span>
                    {candForm.viceChairmanPhotoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={candForm.viceChairmanPhotoUrl}
                          alt="Foto Calon Wakil Ketua"
                          className="w-14 h-14 rounded-lg object-cover border border-indigo-300 shadow-2xs"
                        />
                        <div className="space-y-1">
                          <span className="text-[11px] text-emerald-700 font-bold block">✓ Foto Terpasang</span>
                          <button
                            type="button"
                            onClick={() => setCandForm((prev) => ({ ...prev, viceChairmanPhotoUrl: '' }))}
                            className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
                          >
                            Hapus Foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/30 hover:bg-indigo-100/50 text-indigo-700 text-xs font-medium cursor-pointer transition-colors text-center">
                        <Upload className="w-4 h-4 mb-1 text-indigo-500" />
                        <span>Pilih Foto Calon Wakil</span>
                        <input
                          type="file"
                          accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.tiff,.avif,.heic,.heif"
                          onChange={handleViceChairmanPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visi Utama</label>
                <textarea
                  rows={2}
                  value={candForm.vision}
                  onChange={(e) => setCandForm({ ...candForm, vision: e.target.value })}
                  placeholder="Rumuskan visi kepemimpinan..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Misi (Pisahkan per baris)</label>
                <textarea
                  rows={3}
                  value={candForm.mission.join('\n')}
                  onChange={(e) => setCandForm({ ...candForm, mission: e.target.value.split('\n').filter((m) => m.trim()) })}
                  placeholder="1. Meningkatkan kegiatan ekstrakurikuler&#10;2. Menjalin dialog terbuka siswa"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Program Unggulan (Pisahkan per baris)</label>
                <textarea
                  rows={2}
                  value={candForm.programs.join('\n')}
                  onChange={(e) => setCandForm({ ...candForm, programs: e.target.value.split('\n').filter((p) => p.trim()) })}
                  placeholder="Teladan Careline&#10;Digital Bootcamp 2026"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  required
                />
              </div>

              {/* Video Orasi & Kampanye Paslon */}
              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-sky-600" />
                    <span>Video Orasi & Kampanye Paslon</span>
                  </label>
                  <span className="text-[11px] text-slate-500">MP4, WebM atau Link Tautan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: File Upload */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">Unggah File Video (Lokal)</span>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-sky-300 bg-white hover:bg-sky-50 text-sky-700 text-xs font-semibold cursor-pointer transition-colors">
                      <FileVideo className="w-4 h-4" />
                      <span>Pilih File Video</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Option B: URL Link */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">Atau Tautan URL Video</span>
                    <input
                      type="text"
                      value={candForm.videoUrl || ''}
                      onChange={(e) => setCandForm({ ...candForm, videoUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                {/* Video Preview */}
                {candForm.videoUrl && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Pratinjau Video Kampanye Terpasang:</span>
                    </span>
                    <video
                      src={candForm.videoUrl}
                      controls
                      className="w-full max-h-48 rounded-lg border border-slate-300 bg-black"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCandidateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  Simpan Data Paslon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT VOTER CARDS */}
      {showPrintModal && (
        <PrintTokenCards
          school={school}
          period={period}
          voters={filteredVoters}
          onClose={() => {
            setShowPrintModal(false);
            // Mark these as printed
            electionStore.markTokensAsPrinted(filteredVoters.map((v) => v.id));
          }}
        />
      )}

      {/* MODAL: SURAT BUKTI FISIK SK PANITIA PEMILIHAN (1-99 HALAMAN) */}
      {showSkModal && (
        <PrintSkPanitia
          school={school}
          period={period}
          committee={committee}
          onClose={() => setShowSkModal(false)}
        />
      )}
    </div>
  );
};
