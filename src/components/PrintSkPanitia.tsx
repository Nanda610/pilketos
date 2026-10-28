/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Official Surat Keputusan (SK) Kepala Sekolah
 * Bukti Fisik Pengesahan Panitia Pemilihan OSIS / PILKETOS
 * Fitur:
 * - Menu Edit SK Interaktif (Isi Surat, Acara, Nama Panitia, Kepala Sekolah, dll)
 * - Sinkronisasi ke Database Sistem
 * - Halaman Fleksibel & Dinamis (1 - 99 Halaman)
 * - Pratinjau & Cetak Format A4 Kedinasan Resmi
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, X, FileText, Plus, Trash2, ChevronLeft, ChevronRight,
  ShieldCheck, Award, QrCode, CheckCircle2, Sliders, Eye, RotateCcw,
  BookOpen, Layers, Edit3, Save, Calendar, MapPin, Building,
  UserCheck, AlertCircle, ArrowUp, ArrowDown, Check, UserPlus,
  Mail, Hash, Phone, Globe, Upload, Image as ImageIcon, Move, Maximize2,
  Minimize2, ZoomIn, ZoomOut
} from 'lucide-react';
import { SchoolConfig, ElectionPeriod, CommitteeMember, OrganizationType } from '../types';
import { electionStore } from '../lib/store';
import { SchoolCrestLogo, OsisLogoBadge } from './CandidateAvatar';
import {
  clampZoomScale,
  getPageBreakStyle,
  KopLogoSizeConfig,
  OfficialStampConfig,
  loadSavedKopLogoConfig,
  saveKopLogoConfig,
  saveCustomKopLogoPreset,
  loadCustomKopLogoPreset,
  areLogoConfigsEqual,
  loadSavedStampConfig,
  saveStampConfig,
  createDefaultStampConfig,
} from '../utils/printIsolation';

interface PrintSkPanitiaProps {
  school: SchoolConfig;
  period: ElectionPeriod;
  committee: CommitteeMember[];
  onClose: () => void;
}

export interface SkPageConfig {
  id: string;
  pageNumber: number;
  type: 'main_sk' | 'appendix_members' | 'appendix_duties' | 'appendix_rules' | 'appendix_integrity' | 'custom';
  title: string;
  subtitle: string;
  customContent?: string;
}

export interface EditableCommitteeMember {
  id: string;
  role: string;
  memberName: string;
  className: string;
  duties: string;
}

export const PrintSkPanitia: React.FC<PrintSkPanitiaProps> = ({
  school,
  period,
  committee: initialCommittee,
  onClose,
}) => {
  // --- VIEW MODE & NAVIGATION ---
  const [viewMode, setViewMode] = useState<'preview' | 'editor'>('preview');
  const [editorTab, setEditorTab] = useState<'letter' | 'committee' | 'event' | 'signee' | 'pages'>('committee');
  const [activePreviewPage, setActivePreviewPage] = useState<number>(1);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [onlyDocumentMode, setOnlyDocumentMode] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(100);

  // Isolate SK preview & print from all background DOM objects (#root, canvas, navbar)
  useEffect(() => {
    document.body.classList.add('print-preview-open');
    return () => {
      document.body.classList.remove('print-preview-open');
    };
  }, []);

  // Extract initial SK metadata
  const defaultSkNum = initialCommittee[0]?.skNumber || `421.3/035/SK-KS/${school.type}/${new Date().getFullYear()}`;
  const defaultSkDate = initialCommittee[0]?.skDate || new Date().toISOString().split('T')[0];

  // --- STATE: 1. IDENTITAS DOKUMEN & PENGESAHAN ---
  const [skNumber, setSkNumber] = useState(defaultSkNum);
  const [skDate, setSkDate] = useState(defaultSkDate);
  const [skCity, setSkCity] = useState(school.city || 'Kota Administrasi');

  // --- STATE: 2. KEPALA SEKOLAH & PEJABAT PENGESAH ---
  const [principalName, setPrincipalName] = useState(school.principalName || 'Dra. Hj. Nurul Hidayah, M.Pd');
  const [principalNip, setPrincipalNip] = useState(school.principalNip || '19780512 200212 1 003');
  const [principalRank, setPrincipalRank] = useState('Pembina Utama Muda / IV-c');
  const [supervisorName, setSupervisorName] = useState('Drs. Bambang Sudarsono, M.Pd');
  const [supervisorRole, setSupervisorRole] = useState(`Wakasek Kesiswaan & Pembina ${school.type}`);
  const [supervisorNip, setSupervisorNip] = useState('19820315 200604 1 008');

  // --- STATE: 3. ACARA & PELAKSANAAN PEMILIHAN ---
  const [eventName, setEventName] = useState(period.periodName || `Pemilihan Umum Ketua dan Wakil Ketua ${school.type} (PILKETOS)`);
  const [eventTheme, setEventTheme] = useState('Mewujudkan Kepemimpinan Berkarakter, Berintegritas, Kreatif, dan Menjunjung Tinggi Demokrasi Sekolah');
  const [academicYear, setAcademicYear] = useState(period.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`);
  const [eventDateText, setEventDateText] = useState('Senin, 27 Oktober 2026');
  const [eventTimeText, setEventTimeText] = useState('Pukul 08.00 s/d 14.00 WIB');
  const [eventLocation, setEventLocation] = useState(`Bilik Suara Digital Aula Utama & Lab Komputer ${school.name}`);

  // --- STATE: 4. KOP SURAT RESMI & KONTAK SATUAN PENDIDIKAN ---
  const initialKopLine1 = school.province
    ? (school.province.toUpperCase().startsWith('PEMERINTAH') ||
       school.province.toUpperCase().startsWith('YAYASAN') ||
       school.province.toUpperCase().startsWith('KEMENTERIAN')
        ? school.province.toUpperCase()
        : `PEMERINTAH DAERAH PROVINSI ${school.province.toUpperCase()}`)
    : 'PEMERINTAH DAERAH PROVINSI DKI JAKARTA';

  const [kopBarLine1, setKopBarLine1] = useState(initialKopLine1);
  const [kopBarLine2, setKopBarLine2] = useState('DINAS PENDIDIKAN DAN KEBUDAYAAN');
  const [showKopLine2, setShowKopLine2] = useState(true);
  const [showManualKopModal, setShowManualKopModal] = useState(false);

  const [agencyProvince, setAgencyProvince] = useState(initialKopLine1);
  const [agencyDept, setAgencyDept] = useState('DINAS PENDIDIKAN DAN KEBUDAYAAN');
  const [schoolCustomName, setSchoolCustomName] = useState(school.name);
  const [schoolAddressText, setSchoolAddressText] = useState(school.address);
  const [schoolPostalCode, setSchoolPostalCode] = useState(school.postalCode || '10330');
  const [schoolPhoneText, setSchoolPhoneText] = useState(school.phone);
  const [schoolEmailText, setSchoolEmailText] = useState(school.email || 'info@sekolah.sch.id');
  const [schoolWebsiteText, setSchoolWebsiteText] = useState(school.website);
  const [schoolNpsnText, setSchoolNpsnText] = useState(school.npsn);

  // --- STATE: LOGO KOP SURAT (SEKOLAH & OSIS) ---
  const [osisLogoUrl, setOsisLogoUrl] = useState<string>(school.osisLogoUrl || '');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>(school.logoUrl || '');
  const [showUploadOsisModal, setShowUploadOsisModal] = useState<boolean>(false);
  const [isUploadingOsis, setIsUploadingOsis] = useState<boolean>(false);
  const [osisUrlInput, setOsisUrlInput] = useState<string>(school.osisLogoUrl || '');

  const handleUploadOsisFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file logo terlalu besar (maksimal 10MB).');
      return;
    }

    setIsUploadingOsis(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setOsisLogoUrl(dataUrl);
      setOsisUrlInput(dataUrl);
      setIsUploadingOsis(false);
      electionStore.updateSchool({ osisLogoUrl: dataUrl });
      showToast(`Logo ${school.type} berhasil diunggah dan disimpan ke sistem!`);
    };
    reader.onerror = () => {
      setIsUploadingOsis(false);
      alert('Gagal membaca file gambar logo.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyOsisUrl = (url: string) => {
    const trimmed = url.trim();
    setOsisLogoUrl(trimmed);
    setOsisUrlInput(trimmed);
    electionStore.updateSchool({ osisLogoUrl: trimmed });
    showToast(`Logo ${school.type} berhasil diperbarui!`);
  };

  const handleResetOsisLogo = () => {
    setOsisLogoUrl('');
    setOsisUrlInput('');
    electionStore.updateSchool({ osisLogoUrl: '' });
    showToast(`Logo ${school.type} dikembalikan ke lencana resmi standar.`);
  };

  const handleUploadSchoolLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file logo terlalu besar (maksimal 10MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSchoolLogoUrl(dataUrl);
      electionStore.updateSchool({ logoUrl: dataUrl });
      showToast('Logo Sekolah (Sisi Kiri) berhasil diunggah dan disimpan!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetSchoolLogo = () => {
    setSchoolLogoUrl('');
    electionStore.updateSchool({ logoUrl: '' });
    showToast('Logo Sekolah dikembalikan ke lambang standar.');
  };

  // --- STATE: PENGATURAN UKURAN & POSISI LOGO (INPUT MASUKAN UKURAN & TARIK/SUSUN MANUAL) ---
  const initialLogoCfg = loadSavedKopLogoConfig(school.kopLogoConfig);
  const [schoolLogoWidth, setSchoolLogoWidth] = useState<number>(initialLogoCfg.schoolLogoWidth);
  const [schoolLogoHeight, setSchoolLogoHeight] = useState<number>(initialLogoCfg.schoolLogoHeight);
  const [schoolLogoOffsetX, setSchoolLogoOffsetX] = useState<number>(initialLogoCfg.schoolLogoOffsetX);
  const [schoolLogoOffsetY, setSchoolLogoOffsetY] = useState<number>(initialLogoCfg.schoolLogoOffsetY);

  const [osisLogoWidth, setOsisLogoWidth] = useState<number>(initialLogoCfg.osisLogoWidth);
  const [osisLogoHeight, setOsisLogoHeight] = useState<number>(initialLogoCfg.osisLogoHeight);
  const [osisLogoOffsetX, setOsisLogoOffsetX] = useState<number>(initialLogoCfg.osisLogoOffsetX);
  const [osisLogoOffsetY, setOsisLogoOffsetY] = useState<number>(initialLogoCfg.osisLogoOffsetY);

  const [savedLogoConfig, setSavedLogoConfig] = useState<KopLogoSizeConfig>(initialLogoCfg);
  const [hasCustomLogoPreset, setHasCustomLogoPreset] = useState<boolean>(() => Boolean(loadCustomKopLogoPreset()));

  const currentLogoConfig: KopLogoSizeConfig = {
    schoolLogoWidth,
    schoolLogoHeight,
    schoolLogoOffsetX,
    schoolLogoOffsetY,
    osisLogoWidth,
    osisLogoHeight,
    osisLogoOffsetX,
    osisLogoOffsetY,
  };
  const isLogoSizeSaved = areLogoConfigsEqual(currentLogoConfig, savedLogoConfig);

  const handleSaveLogoSize = (closeModalAfterSave = false) => {
    const saved = saveKopLogoConfig(currentLogoConfig);
    setSavedLogoConfig(saved);
    electionStore.updateSchool({
      kopLogoConfig: saved,
      logoUrl: schoolLogoUrl.trim(),
      osisLogoUrl: osisLogoUrl.trim(),
    });
    if (closeModalAfterSave) {
      setShowLogoSizeModal(false);
    }
    showToast(
      `Ukuran & posisi Logo Kop (${saved.schoolLogoWidth}x${saved.schoolLogoHeight}px & ${saved.osisLogoWidth}x${saved.osisLogoHeight}px) berhasil disimpan permanen!`
    );
  };

  const handleSaveCustomLogoPresetSlot = () => {
    const preset = saveCustomKopLogoPreset(currentLogoConfig);
    const saved = saveKopLogoConfig(currentLogoConfig);
    setSavedLogoConfig(saved);
    setHasCustomLogoPreset(true);
    electionStore.updateSchool({ kopLogoConfig: saved });
    showToast(
      `Preset ukuran Logo Kop (${preset.schoolLogoWidth}x${preset.schoolLogoHeight}px) berhasil disimpan ke memori preset!`
    );
  };

  const handleLoadCustomLogoPresetSlot = () => {
    const preset = loadCustomKopLogoPreset();
    if (!preset) {
      showToast('Belum ada preset kustom yang disimpan.');
      return;
    }
    setSchoolLogoWidth(preset.schoolLogoWidth);
    setSchoolLogoHeight(preset.schoolLogoHeight);
    setSchoolLogoOffsetX(preset.schoolLogoOffsetX);
    setSchoolLogoOffsetY(preset.schoolLogoOffsetY);
    setOsisLogoWidth(preset.osisLogoWidth);
    setOsisLogoHeight(preset.osisLogoHeight);
    setOsisLogoOffsetX(preset.osisLogoOffsetX);
    setOsisLogoOffsetY(preset.osisLogoOffsetY);
    showToast('Preset kustom ukuran Logo Kop berhasil dimuat!');
  };

  // --- STATE: PENGATURAN & MENU EDIT STEMPEL, TANDA TANGAN & PENGESAHAN ---
  const initialStampCfg = loadSavedStampConfig(school.name, school.stampConfig);
  const [stampHeaderText, setStampHeaderText] = useState<string>(initialStampCfg.headerText);
  const [stampInstitutionText, setStampInstitutionText] = useState<string>(initialStampCfg.institutionText);
  const [stampFooterText, setStampFooterText] = useState<string>(initialStampCfg.footerText);
  const [stampSizePx, setStampSizePx] = useState<number>(initialStampCfg.sizePx);
  const [stampRotationDeg, setStampRotationDeg] = useState<number>(initialStampCfg.rotationDeg);
  const [stampOffsetX, setStampOffsetX] = useState<number>(initialStampCfg.offsetX);
  const [stampOffsetY, setStampOffsetY] = useState<number>(initialStampCfg.offsetY);
  const [stampColorTheme, setStampColorTheme] = useState<OfficialStampConfig['colorTheme']>(initialStampCfg.colorTheme);
  const [signatoryTitle, setSignatoryTitle] = useState<string>(initialStampCfg.signatoryTitle);
  const [showEditStampModal, setShowEditStampModal] = useState<boolean>(false);

  const handleSaveStampAndSignee = (closeModal = true) => {
    const savedStamp = saveStampConfig(
      {
        headerText: stampHeaderText,
        institutionText: stampInstitutionText,
        footerText: stampFooterText,
        sizePx: stampSizePx,
        rotationDeg: stampRotationDeg,
        offsetX: stampOffsetX,
        offsetY: stampOffsetY,
        colorTheme: stampColorTheme,
        signatoryTitle,
      },
      schoolCustomName
    );
    electionStore.updateSchool({
      principalName: principalName.trim(),
      principalNip: principalNip.trim(),
      city: skCity.trim(),
      stampConfig: savedStamp,
    });
    if (closeModal) {
      setShowEditStampModal(false);
    }
    showToast('Perubahan Stempel, Tanda Tangan & Pengesahan Kepala Sekolah berhasil disimpan!');
  };

  const handleResetStampConfig = () => {
    const defaults = createDefaultStampConfig(schoolCustomName);
    setStampHeaderText(defaults.headerText);
    setStampInstitutionText(defaults.institutionText);
    setStampFooterText(defaults.footerText);
    setStampSizePx(defaults.sizePx);
    setStampRotationDeg(defaults.rotationDeg);
    setStampOffsetX(defaults.offsetX);
    setStampOffsetY(defaults.offsetY);
    setStampColorTheme(defaults.colorTheme);
    setSignatoryTitle(defaults.signatoryTitle);
    showToast('Format Stempel & Pengesahan dikembalikan ke standar baku.');
  };

  const [showLogoSizeModal, setShowLogoSizeModal] = useState<boolean>(false);
  const [resizingTarget, setResizingTarget] = useState<'school' | 'osis' | null>(null);
  const [dragMode, setDragMode] = useState<'resize' | 'position'>('resize');
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    offX: number;
    offY: number;
  } | null>(null);

  // Real-time Drag Listener for Direct Manual Dragging on Preview Sheet
  React.useEffect(() => {
    if (!resizingTarget || !dragStart) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;

      if (dragMode === 'resize') {
        const newW = Math.max(24, Math.min(220, dragStart.w + dx));
        const newH = Math.max(24, Math.min(320, dragStart.h + dy));

        if (resizingTarget === 'school') {
          setSchoolLogoWidth(Math.round(newW));
          setSchoolLogoHeight(Math.round(newH));
        } else {
          setOsisLogoWidth(Math.round(newW));
          setOsisLogoHeight(Math.round(newH));
        }
      } else if (dragMode === 'position') {
        const newOffX = Math.max(-120, Math.min(120, dragStart.offX + dx));
        const newOffY = Math.max(-80, Math.min(80, dragStart.offY + dy));

        if (resizingTarget === 'school') {
          setSchoolLogoOffsetX(Math.round(newOffX));
          setSchoolLogoOffsetY(Math.round(newOffY));
        } else {
          setOsisLogoOffsetX(Math.round(newOffX));
          setOsisLogoOffsetY(Math.round(newOffY));
        }
      }
    };

    const handleMouseUp = () => {
      setResizingTarget(null);
      setDragStart(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [resizingTarget, dragStart, dragMode]);

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    target: 'school' | 'osis',
    mode: 'resize' | 'position'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const currentW = target === 'school' ? schoolLogoWidth : osisLogoWidth;
    const currentH = target === 'school' ? schoolLogoHeight : osisLogoHeight;
    const currentOffX = target === 'school' ? schoolLogoOffsetX : osisLogoOffsetX;
    const currentOffY = target === 'school' ? schoolLogoOffsetY : osisLogoOffsetY;

    setResizingTarget(target);
    setDragMode(mode);
    setDragStart({
      x: clientX,
      y: clientY,
      w: currentW,
      h: currentH,
      offX: currentOffX,
      offY: currentOffY,
    });
  };

  const applyLogoPreset = (target: 'school' | 'osis', preset: '2x3' | '3x4' | '1x1' | 'reset') => {
    if (preset === '2x3') {
      if (target === 'school') { setSchoolLogoWidth(52); setSchoolLogoHeight(78); }
      else { setOsisLogoWidth(52); setOsisLogoHeight(78); }
    } else if (preset === '3x4') {
      if (target === 'school') { setSchoolLogoWidth(54); setSchoolLogoHeight(72); }
      else { setOsisLogoWidth(54); setOsisLogoHeight(72); }
    } else if (preset === '1x1') {
      if (target === 'school') { setSchoolLogoWidth(60); setSchoolLogoHeight(60); }
      else { setOsisLogoWidth(60); setOsisLogoHeight(60); }
    } else if (preset === 'reset') {
      if (target === 'school') {
        setSchoolLogoWidth(52); setSchoolLogoHeight(78);
        setSchoolLogoOffsetX(0); setSchoolLogoOffsetY(0);
      } else {
        setOsisLogoWidth(52); setOsisLogoHeight(78);
        setOsisLogoOffsetX(0); setOsisLogoOffsetY(0);
      }
    }
    showToast(`Ukuran logo ${target === 'school' ? 'Sekolah' : school.type} diperbarui!`);
  };

  // Preset Cepat Kop Surat (Bisa dipilih 1-klik untuk Pemprov, Pemkab/Pemkot, Kemenag, Yayasan, atau Bebas Manual)
  const KOP_PRESETS = [
    {
      id: 'pemprov',
      label: '🏛️ Pemprov (SMA/SMK)',
      line1: `PEMERINTAH DAERAH PROVINSI ${school.province ? school.province.toUpperCase() : 'DKI JAKARTA'}`,
      line2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
    },
    {
      id: 'pemkab_pemkot',
      label: '🏢 Pemkot/Pemkab (SMP/SD)',
      line1: `PEMERINTAH ${skCity.toUpperCase().startsWith('KOTA') || skCity.toUpperCase().startsWith('KAB') ? skCity.toUpperCase() : `KOTA ${skCity.toUpperCase()}`}`,
      line2: 'DINAS PENDIDIKAN',
    },
    {
      id: 'kemenag',
      label: '🕌 Kemenag (MTs/MA)',
      line1: 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
      line2: `KANTOR KEMENTERIAN AGAMA ${skCity.toUpperCase()}`,
    },
    {
      id: 'yayasan',
      label: '🏫 Yayasan Swasta',
      line1: 'YAYASAN PENDIDIKAN ISLAM DAN SOSIAL',
      line2: 'BADAN PENGURUS PENYELENGGARA PENDIDIKAN',
    },
    {
      id: 'bebas',
      label: '✍️ Kosongkan / Bebas',
      line1: '',
      line2: '',
    },
  ];

  const applyKopPreset = (preset: typeof KOP_PRESETS[0]) => {
    setKopBarLine1(preset.line1);
    setKopBarLine2(preset.line2);
    setAgencyProvince(preset.line1);
    setAgencyDept(preset.line2);
    if (!preset.line2) {
      setShowKopLine2(false);
    } else {
      setShowKopLine2(true);
    }
  };

  // --- STATE: 5. KONSIDERAN & DIKTUM MEMUTUSKAN ---
  const [menimbangList, setMenimbangList] = useState<string[]>([
    `bahwa dalam rangka regenerasi kepengurusan dan kesinambungan roda organisasi kesiswaan serta sarana pendidikan demokrasi jujur dan adil (LUBER-JURDIL) bagi peserta didik, perlu diselenggarakan ${eventName} Tahun Ajaran ${academicYear};`,
    `bahwa sehubungan dengan berakhirnya masa bakti kepengurusan sebelumnya, perlu dibentuk Panitia Pelaksana Pemilihan yang berkepribadian cakap, berintegritas tinggi, dan netral;`,
    `bahwa mereka yang namanya tercantum dalam lampiran keputusan ini dipandang mampu dan memenuhi syarat untuk diangkat dan ditetapkan sebagai Panitia Pemilihan;`
  ]);

  const [mengingatList, setMengingatList] = useState<string[]>([
    'Undang-Undang Republik Indonesia Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional;',
    'Peraturan Menteri Pendidikan Nasional Nomor 39 Tahun 2008 tentang Pembinaan Kesiswaan;',
    'Permendikbudristek Nomor 46 Tahun 2023 tentang Pencegahan dan Penanganan Kekerasan di Lingkungan Satuan Pendidikan;',
    `Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) Organisasi Kesiswaan ${school.name};`,
    `Program Kerja Tahunan Kesiswaan ${school.name} Tahun Ajaran ${academicYear}.`
  ]);

  const [memperhatikanText, setMemperhatikanText] = useState(
    `Hasil Rapat Koordinasi Dewan Pembina Kesiswaan bersama Pengurus ${school.type} dan Perwakilan Musyawarah Perwakilan Kelas (MPK) mengenai tahapan pelaksanaan pemilihan umum siswa.`
  );

  const [diktumMenetapkan, setDiktumMenetapkan] = useState(
    `KEPUTUSAN KEPALA ${schoolCustomName.toUpperCase()} TENTANG PEMBENTUKAN DAN PENETAPAN SUSUNAN PANITIA PEMILIHAN KETUA DAN WAKIL KETUA ${school.type} TAHUN AJARAN ${academicYear}.`
  );

  const [diktumKesatu, setDiktumKesatu] = useState(
    `Membentuk dan menetapkan Panitia Pemilihan Ketua dan Wakil Ketua ${school.type} Periode ${academicYear} dengan susunan personalia sebagaimana tercantum pada Lampiran I keputusan ini.`
  );

  const [diktumKedua, setDiktumKedua] = useState(
    `Panitia sebagaimana dimaksud Diktum KESATU bertugas menyusun tata tertib, memverifikasi berkas persyaratan pasangan calon, memutakhirkan Daftar Pemilih Tetap (DPT), mengelola fasilitas kampanye, mengoperasikan bilik suara digital, dan menyusun Berita Acara Hasil Pemilihan (BAHP).`
  );

  const [diktumKetiga, setDiktumKetiga] = useState(
    `Segala biaya yang timbul akibat pelaksanaan keputusan ini dibebankan pada anggaran pembinaan kesiswaan dan kas ${school.type} yang sah serta dapat dipertanggungjawabkan.`
  );

  const [diktumKeempat, setDiktumKeempat] = useState(
    `Keputusan ini berlaku sejak tanggal ditetapkan, dan apabila di kemudian hari terdapat kekeliruan dalam penetapannya akan diperbaiki sebagaimana mestinya.`
  );

  // --- STATE: 6. SUSUNAN PERSONALIA PANITIA (EDITABLE) ---
  const defaultCommitteeItems: EditableCommitteeMember[] = initialCommittee.length > 0
    ? initialCommittee.map((c) => ({
        id: c.id,
        role: c.role,
        memberName: c.memberName,
        className: c.className || 'Kelas VIII',
        duties: getDutyDescription(c.role),
      }))
    : [
        { id: 'c1', role: 'Ketua Panitia', memberName: 'Dimas Arya Pratama', className: 'VIII A', duties: 'Memimpin seluruh tahapan, koordinasi pleno & pengesahan berita acara' },
        { id: 'c2', role: 'Wakil Ketua', memberName: 'Alya Syahira', className: 'VIII B', duties: 'Membantu ketua & mengoordinasikan bidang teknis lapangan' },
        { id: 'c3', role: 'Sekretaris', memberName: 'Rizky Ramadhan', className: 'VII B', duties: 'Administrasi persuratan, verifikasi DPT & notulensi rapat pleno' },
        { id: 'c4', role: 'Bendahara', memberName: 'Nadia Putri Utami', className: 'VIII C', duties: 'Penyusunan anggaran biaya operasional & laporan keuangan' },
        { id: 'c5', role: 'Koordinator IT & Bilik', memberName: 'Fajar Nugraha', className: 'VIII A', duties: 'Operator sistem e-voting, pembagian token PIN & keamanan server' },
        { id: 'c6', role: 'Seksi Logistik & TPS', memberName: 'Bagas Aditya', className: 'VII A', duties: 'Perlengkapan bilik suara fisik, cetak kartu PIN & tata ruang TPS' },
        { id: 'c7', role: 'Pengawas & Saksi', memberName: 'Zahra Amelia', className: 'IX A', duties: 'Pengawasan independen kepatuhan tata tertib & saksi pleno rekapitulasi' },
      ];

  const [committeeList, setCommitteeList] = useState<EditableCommitteeMember[]>(defaultCommitteeItems);

  // --- STATE: 7. TOGGLES & DISPLAY OPTIONS ---
  const [showQrCode, setShowQrCode] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [showWatermark, setShowWatermark] = useState(false);

  // --- STATE: 8. DYNAMIC PAGES CONFIG (1-99 PAGES) ---
  const initialPages: SkPageConfig[] = [
    {
      id: 'page-1',
      pageNumber: 1,
      type: 'main_sk',
      title: 'SURAT KEPUTUSAN KEPALA SATUAN PENDIDIKAN',
      subtitle: `TENTANG PEMBENTUKAN DAN PENETAPAN PANITIA PEMILIHAN KETUA DAN WAKIL KETUA ${school.type} TAHUN AJARAN ${academicYear}`,
    },
    {
      id: 'page-2',
      pageNumber: 2,
      type: 'appendix_members',
      title: 'LAMPIRAN I: KEPUTUSAN KEPALA SEKOLAH',
      subtitle: `SUSUNAN PERSONALIA PANITIA PEMILIHAN ${school.type} TAHUN AJARAN ${academicYear}`,
    },
    {
      id: 'page-3',
      pageNumber: 3,
      type: 'appendix_duties',
      title: 'LAMPIRAN II: KEPUTUSAN KEPALA SEKOLAH',
      subtitle: 'URAIAN TUGAS, WEWENANG, DAN TANGGUNG JAWAB PANITIA PEMILIHAN',
    },
    {
      id: 'page-4',
      pageNumber: 4,
      type: 'appendix_rules',
      title: 'LAMPIRAN III: KEPUTUSAN KEPALA SEKOLAH',
      subtitle: 'TATA TERTIB DAN KETENTUAN TEKNIS BILIK SUARA DIGITAL (E-VOTING)',
    },
    {
      id: 'page-5',
      pageNumber: 5,
      type: 'appendix_integrity',
      title: 'LAMPIRAN IV: KEPUTUSAN KEPALA SEKOLAH',
      subtitle: 'PAKTA INTEGRITAS DAN IKRAR NETRALITAS KEPANITIAAN PEMILIHAN',
    },
  ];

  const [pages, setPages] = useState<SkPageConfig[]>(initialPages);

  // Format Indonesian date
  const formattedSkDate = (() => {
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(skDate));
    } catch {
      return skDate;
    }
  })();

  function showToast(message: string) {
    setSaveToast(message);
    setTimeout(() => setSaveToast(null), 3500);
  }

  function getDutyDescription(roleName: string): string {
    if (roleName.includes('Ketua')) return 'Memimpin seluruh tahapan, koordinasi pleno & pengesahan berita acara';
    if (roleName.includes('Sekretaris')) return 'Administrasi persuratan, verifikasi DPT & notulensi rapat pleno';
    if (roleName.includes('Bendahara')) return 'Penyusunan anggaran biaya operasional & laporan keuangan';
    if (roleName.includes('IT') || roleName.includes('Bilik')) return 'Operator sistem e-voting, pembagian token PIN & keamanan server';
    if (roleName.includes('Logistik')) return 'Perlengkapan bilik suara fisik, cetak kartu PIN & tata ruang TPS';
    return 'Pengawasan independen kepatuhan tata tertib & saksi pleno rekapitulasi';
  }

  // --- COMMITTEE HANDLERS ---
  const handleAddCommitteeMember = () => {
    const newMember: EditableCommitteeMember = {
      id: `comm_new_${Date.now()}`,
      role: 'Seksi Pembantu Umum',
      memberName: '',
      className: 'Kelas VIII',
      duties: 'Membantu kelancaran operasional bilik suara dan registrasi pemilih',
    };
    setCommitteeList([...committeeList, newMember]);
  };

  const handleUpdateCommitteeMember = (id: string, updates: Partial<EditableCommitteeMember>) => {
    setCommitteeList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleDeleteCommitteeMember = (id: string) => {
    if (committeeList.length <= 1) {
      alert('Minimal harus ada 1 anggota panitia.');
      return;
    }
    setCommitteeList((prev) => prev.filter((c) => c.id !== id));
  };

  const handleMoveCommitteeMember = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === committeeList.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...committeeList];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setCommitteeList(updated);
  };

  // --- MENIMBANG & MENGINGAT HANDLERS ---
  const handleAddMenimbang = () => {
    setMenimbangList([...menimbangList, 'bahwa dalam rangka kelancaran dan ketertiban administrasi pemilihan...']);
  };

  const handleUpdateMenimbang = (idx: number, val: string) => {
    const updated = [...menimbangList];
    updated[idx] = val;
    setMenimbangList(updated);
  };

  const handleDeleteMenimbang = (idx: number) => {
    if (menimbangList.length <= 1) return;
    setMenimbangList(menimbangList.filter((_, i) => i !== idx));
  };

  const handleAddMengingat = () => {
    setMengingatList([...mengingatList, 'Peraturan Tata Tertib Sekolah tentang Kedisiplinan dan Organisasi Kesiswaan;']);
  };

  const handleUpdateMengingat = (idx: number, val: string) => {
    const updated = [...mengingatList];
    updated[idx] = val;
    setMengingatList(updated);
  };

  const handleDeleteMengingat = (idx: number) => {
    if (mengingatList.length <= 1) return;
    setMengingatList(mengingatList.filter((_, i) => i !== idx));
  };

  // --- DYNAMIC PAGE HANDLERS (1-99 PAGES) ---
  const handleSetTotalPages = (targetTotal: number) => {
    const clamped = Math.max(1, Math.min(99, targetTotal));
    if (clamped === pages.length) return;

    if (clamped > pages.length) {
      const newPagesList = [...pages];
      for (let i = pages.length + 1; i <= clamped; i++) {
        newPagesList.push({
          id: `page-${Date.now()}-${i}`,
          pageNumber: i,
          type: 'custom',
          title: `LAMPIRAN ${i - 1 > 0 ? romanize(i - 1) : i}: KEPUTUSAN KEPALA SEKOLAH`,
          subtitle: `DOKUMEN PENDUKUNG PELAKSANAAN PILKETOS HALAMAN ${i}`,
          customContent: `Halaman tambahan resmi SK Panitia Pemilihan ${school.type} ${schoolCustomName}.\n\nBagian ini dapat digunakan untuk mencantumkan Berita Acara Rapat Pleno, Jadwal Sosialisasi & Debat Paslon, Denah Tempat Pemungutan Suara (TPS), atau Daftar Saksi Perwakilan Kelas.`,
        });
      }
      setPages(newPagesList);
    } else {
      const newPagesList = pages.slice(0, clamped);
      setPages(newPagesList);
      if (activePreviewPage > clamped) {
        setActivePreviewPage(clamped);
      }
    }
  };

  const handleAddSinglePage = () => {
    if (pages.length >= 99) {
      alert('Batas maksimal halaman yang didukung adalah 99 halaman.');
      return;
    }
    const nextNum = pages.length + 1;
    const newPage: SkPageConfig = {
      id: `page-${Date.now()}-${nextNum}`,
      pageNumber: nextNum,
      type: 'custom',
      title: `LAMPIRAN ${romanize(nextNum - 1)}: KEPUTUSAN KEPALA SEKOLAH`,
      subtitle: `DOKUMEN PENDUKUNG TAMBAHAN HALAMAN ${nextNum}`,
      customContent: `Halaman lampiran tambahan resmi Ke-${nextNum}.\n\nSilakan isi dengan rincian kebutuhan operasional kepanitiaan, berita acara pleno, jadwal sosialisasi kelas, pakta saksi, atau regulasi teknis lainnya sesuai kebijakan sekolah.`,
    };
    setPages([...pages, newPage]);
    setActivePreviewPage(nextNum);
  };

  const handleDeletePage = (pageIndex: number) => {
    if (pages.length <= 1) {
      alert('Minimal dokumen harus memiliki 1 halaman.');
      return;
    }
    const updated = pages
      .filter((_, idx) => idx !== pageIndex)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    setPages(updated);
    if (activePreviewPage > updated.length) {
      setActivePreviewPage(updated.length);
    }
  };

  const handleUpdatePageContent = (index: number, updates: Partial<SkPageConfig>) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, ...updates } : p))
    );
  };

  // --- SAVE & SYNC TO SYSTEM STORE ---
  const handleSaveAndSync = () => {
    const savedLogo = saveKopLogoConfig(currentLogoConfig);
    setSavedLogoConfig(savedLogo);
    const savedStamp = saveStampConfig(
      {
        headerText: stampHeaderText,
        institutionText: stampInstitutionText,
        footerText: stampFooterText,
        sizePx: stampSizePx,
        rotationDeg: stampRotationDeg,
        offsetX: stampOffsetX,
        offsetY: stampOffsetY,
        colorTheme: stampColorTheme,
        signatoryTitle,
      },
      schoolCustomName
    );
    // 1. Update School Info in store
    electionStore.updateSchool({
      principalName: principalName.trim(),
      principalNip: principalNip.trim(),
      city: skCity.trim(),
      address: schoolAddressText.trim(),
      postalCode: schoolPostalCode.trim(),
      phone: schoolPhoneText.trim(),
      email: schoolEmailText.trim(),
      website: schoolWebsiteText.trim(),
      npsn: schoolNpsnText.trim(),
      logoUrl: schoolLogoUrl.trim(),
      osisLogoUrl: osisLogoUrl.trim(),
      kopLogoConfig: savedLogo,
      stampConfig: savedStamp,
    });

    // 2. Update Period details if needed
    electionStore.updatePeriod(period.id, {
      periodName: eventName.trim(),
      academicYear: academicYear.trim(),
    });

    // 3. Update committee in store
    committeeList.forEach((c) => {
      // Find matching or create
      const exists = initialCommittee.find((orig) => orig.id === c.id);
      if (exists) {
        electionStore.updateCommitteeMember(c.id, {
          memberName: c.memberName,
          role: c.role as any,
          className: c.className,
          skNumber: skNumber,
          skDate: skDate,
        });
      } else if (c.memberName.trim()) {
        electionStore.addCommitteeMember({
          electionPeriodId: period.id,
          memberName: c.memberName.trim(),
          role: c.role as any,
          className: c.className,
          skNumber: skNumber,
          skDate: skDate,
          email: `${c.memberName.toLowerCase().replace(/\s+/g, '')}@sekolah.id`,
        });
      }
    });

    showToast('Seluruh perubahan SK, acara, dan data Panitia berhasil disimpan & disinkronkan ke sistem!');
  };

  // --- RESET TO OFFICIAL TEMPLATE ---
  const handleResetToDefault = () => {
    if (!confirm('Apakah Anda yakin ingin mereset seluruh format SK ke template kedinasan bawaan?')) return;
    setSkNumber(defaultSkNum);
    setSkDate(defaultSkDate);
    setSkCity(school.city || 'Kota Administrasi');
    setPrincipalName(school.principalName || 'Dra. Hj. Nurul Hidayah, M.Pd');
    setPrincipalNip(school.principalNip || '19780512 200212 1 003');
    setKopBarLine1(initialKopLine1);
    setKopBarLine2('DINAS PENDIDIKAN DAN KEBUDAYAAN');
    setShowKopLine2(true);
    setAgencyProvince(initialKopLine1);
    setAgencyDept('DINAS PENDIDIKAN DAN KEBUDAYAAN');
    setSchoolPostalCode(school.postalCode || '10330');
    setSchoolEmailText(school.email || 'info@sekolah.sch.id');
    setEventName(period.periodName || `Pemilihan Umum Ketua dan Wakil Ketua ${school.type} (PILKETOS)`);
    setAcademicYear(period.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`);
    setCommitteeList(defaultCommitteeItems);
    setPages(initialPages);
    showToast('Template SK berhasil dikembalikan ke format kedinasan awal.');
  };

  // Helper roman numerals
  function romanize(num: number): string {
    if (isNaN(num) || num <= 0) return 'I';
    const lookup: { [key: string]: number } = {
      M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
    };
    let roman = '';
    let n = num;
    for (const i in lookup) {
      while (n >= lookup[i]) {
        roman += i;
        n -= lookup[i];
      }
    }
    return roman;
  }

  const chairman = committeeList.find((c) => c.role.toLowerCase().includes('ketua')) || committeeList[0];

  return createPortal(
    <div className="print-portal-root fixed inset-0 z-[9999] overflow-y-auto bg-slate-900 p-2 sm:p-4 md:p-8 print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Toast Notification */}
      {saveToast && (
        <output className="no-print fixed top-5 left-1/2 transform -translate-x-1/2 z-[10001] bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </output>
      )}

      {/* Minimal Floating Restore Bar when in Pure Document Preview Mode */}
      {onlyDocumentMode && (
        <div className="no-print fixed bottom-5 right-5 z-[10000] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => setOnlyDocumentMode(false)}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-white cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
            <span>Tampilkan Menu Preview</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-xl cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Sekarang</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP FLOATING TOOLBAR (NO-PRINT) */}
      {!onlyDocumentMode && (
      <div className="no-print max-w-5xl mx-auto mb-6 bg-white/95 backdrop-blur-xl rounded-3xl p-4 md:p-5 shadow-2xl border border-slate-200 sticky top-2 z-40 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100/90 border border-purple-200 px-2 py-0.5 rounded-full">
                  Menu Preview Sebelum Cetak
                </span>
                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {pages.length} Halaman A4 · Bebas Objek Lain
                </span>
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Surat Bukti Fisik SK Kepanitiaan Pemilihan
              </h2>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Preview vs Editor */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100/80 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pratinjau Cetak</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'editor'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Menu Edit SK & Acara</span>
              </button>
            </div>

            {/* Pure Document Mode Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode('preview');
                setOnlyDocumentMode(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sembunyikan toolbar dan tampilkan murni lembaran dokumen SK"
            >
              <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Layar Murni Dokumen</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode('preview');
                setTimeout(() => window.print(), 50);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all cursor-pointer transform hover:scale-102 active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>

            {/* Logo Size Configuration & Save Menu Group */}
            <div className="flex items-center rounded-xl bg-indigo-50/90 border border-indigo-200 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setShowLogoSizeModal(true)}
                className="px-3 py-1.5 rounded-lg hover:bg-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Pengaturan Ukuran, Posisi & Edit Logo Kop Surat"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ukuran Logo Kop</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveLogoSize(false)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isLogoSizeSaved
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-xs animate-pulse'
                }`}
                title="Simpan Permanen Ukuran & Posisi Logo Kop Surat"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isLogoSizeSaved ? 'Simpan Ukuran' : 'Simpan Ukuran*'}</span>
              </button>
            </div>

            {/* Quick Settings Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                showSettingsDrawer
                  ? 'bg-purple-100 border-purple-300 text-purple-800'
                  : 'glass-button text-slate-700 hover:text-slate-900'
              }`}
              title="Pengaturan Tampilan Cepat"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl glass-button text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Tutup Jendela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Page Controls & Quick Jump Strip */}
        <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Halaman Aktif:</span>
            </span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePreviewPage(p.pageNumber)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer ${
                    activePreviewPage === p.pageNumber
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                  }`}
                  title={`Buka Halaman ${p.pageNumber}: ${p.title}`}
                >
                  Hal {p.pageNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white/80 border border-slate-200 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setZoomScale(clampZoomScale(zoomScale - 10))}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Perkecil Pratinjau"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 text-slate-800 min-w-[38px] text-center">
                {zoomScale}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale(clampZoomScale(zoomScale + 10))}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Perbesar Pratinjau"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomScale !== 100 && (
                <button
                  type="button"
                  onClick={() => setZoomScale(100)}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-purple-700 bg-purple-50 rounded hover:bg-purple-100 cursor-pointer"
                >
                  100%
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddSinglePage}
              className="px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Hal Baru</span>
            </button>
            <div className="flex items-center gap-1 bg-white/70 px-2 py-1 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium">Total Hal (1-99):</span>
              <input
                type="number"
                min={1}
                max={99}
                value={pages.length}
                onChange={(e) => handleSetTotalPages(parseInt(e.target.value) || 1)}
                className="w-12 text-center font-bold text-slate-900 bg-transparent text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* QUICK SETTINGS DRAWER */}
        {showSettingsDrawer && (
          <div className="pt-4 border-t border-slate-200/80 space-y-3 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Preset Cepat:
                </span>
                <button
                  type="button"
                  onClick={() => handleSetTotalPages(2)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/80 hover:bg-white text-slate-700 border border-slate-200 cursor-pointer"
                >
                  2 Hal (Standar)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTotalPages(3)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/80 hover:bg-white text-slate-700 border border-slate-200 cursor-pointer"
                >
                  3 Hal (Lengkap)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTotalPages(5)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/80 hover:bg-white text-slate-700 border border-slate-200 cursor-pointer"
                >
                  5 Hal (Komprehensif)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTotalPages(10)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer"
                >
                  10 Hal
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStamp}
                    onChange={(e) => setShowStamp(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>Stempel & Tanda Tangan Basah</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>QR Code Validasi</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>Watermark Asli</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* =========================================================================
          MODE 1: MENU EDIT SURAT BUKTI FISIK SK PANITIA (COMPREHENSIVE EDITOR)
         ========================================================================= */}
      {!onlyDocumentMode && viewMode === 'editor' && (
        <div className="no-print max-w-5xl mx-auto mb-8 glass-panel rounded-3xl p-6 shadow-2xl border-white/80 animate-in fade-in space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-purple-600">
                <Edit3 className="w-4 h-4" />
                <span>Editor Penyesuaian Surat Keputusan Resmi</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Menu Kustomisasi Isi Surat, Acara, & Nama Panitia
              </h3>
              <p className="text-xs text-slate-500">
                Sesuaikan seluruh teks isi surat keputusan, data acara, susunan nama panitia, dan identitas kepala sekolah secara fleksibel.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white/70 hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Kembalikan format standar baku SK"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Baku</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAndSync}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan & Sinkronkan</span>
              </button>
            </div>
          </div>

          {/* Sub Tabs for Editor */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200/70 pb-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setEditorTab('committee')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                editorTab === 'committee'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Nama-Nama Panitia ({committeeList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('event')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                editorTab === 'event'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Acara & Pelaksanaan Pemilihan</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('signee')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                editorTab === 'signee'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Kepala Sekolah & SK</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('letter')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                editorTab === 'letter'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Isi Surat (Konsideran & Diktum)</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorTab('pages')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                editorTab === 'pages'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Kelola Halaman (1-99 Hal)</span>
            </button>
          </div>

          {/* TAB 1: EDIT NAMA-NAMA PANITIA */}
          {editorTab === 'committee' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-200/80">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Susunan Struktur & Personalia Panitia Pemilihan (Lampiran I)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ubah jabatan, nama siswa/guru, kelas, dan tugas pokok anggota. Otomatis tampil di tabel Lampiran I.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCommitteeMember}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Anggota Panitia</span>
                </button>
              </div>

              <div className="space-y-3">
                {committeeList.map((c, idx) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl glass-card border border-slate-200/80 space-y-3 bg-white/60 hover:bg-white/90 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {c.role || 'Anggota Panitia'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveCommitteeMember(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          title="Pindah ke Atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCommitteeMember(idx, 'down')}
                          disabled={idx === committeeList.length - 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          title="Pindah ke Bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCommitteeMember(c.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Hapus Anggota Panitia Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Jabatan Panitia</label>
                        <input
                          type="text"
                          value={c.role}
                          onChange={(e) => handleUpdateCommitteeMember(c.id, { role: e.target.value })}
                          placeholder="Ketua / Sekretaris / dll"
                          className="w-full px-3 py-1.5 text-xs rounded-xl glass-input font-bold text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Lengkap Anggota</label>
                        <input
                          type="text"
                          value={c.memberName}
                          onChange={(e) => handleUpdateCommitteeMember(c.id, { memberName: e.target.value })}
                          placeholder="Nama lengkap siswa / guru"
                          className="w-full px-3 py-1.5 text-xs rounded-xl glass-input font-semibold text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Kelas / Unsur</label>
                        <input
                          type="text"
                          value={c.className}
                          onChange={(e) => handleUpdateCommitteeMember(c.id, { className: e.target.value })}
                          placeholder="VIII A / Dewan Guru"
                          className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900 text-center font-medium"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Tugas Pokok Singkat</label>
                        <input
                          type="text"
                          value={c.duties}
                          onChange={(e) => handleUpdateCommitteeMember(c.id, { duties: e.target.value })}
                          placeholder="Uraian tugas pokok..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: EDIT ACARA & PELAKSANAAN PEMILIHAN */}
          {editorTab === 'event' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200/80">
                <h4 className="text-sm font-bold text-slate-900">
                  Parameter Acara & Pelaksanaan Pemilihan
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informasi tema, waktu, dan lokasi bilik suara yang dicantumkan dalam SK dan lampiran tata tertib.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Acara Pemilihan</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Contoh: Pemilihan Umum Ketua dan Wakil Ketua OSIS (PILKETOS)"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tema Acara Pemilihan</label>
                  <textarea
                    rows={2}
                    value={eventTheme}
                    onChange={(e) => setEventTheme(e.target.value)}
                    placeholder="Mewujudkan Kepemimpinan Berintegritas..."
                    className="w-full p-3 text-xs rounded-xl glass-input text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hari & Tanggal Pemilihan</label>
                  <input
                    type="text"
                    value={eventDateText}
                    onChange={(e) => setEventDateText(e.target.value)}
                    placeholder="Senin, 27 Oktober 2026"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Pelaksanaan Bilik Suara</label>
                  <input
                    type="text"
                    value={eventTimeText}
                    onChange={(e) => setEventTimeText(e.target.value)}
                    placeholder="Pukul 08.00 s/d 14.00 WIB"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi TPS / Bilik Digital</label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Aula Utama & Laboratorium Komputer"
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EDIT KEPALA SEKOLAH & IDENTITAS SK */}
          {editorTab === 'signee' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80">
                <h4 className="text-sm font-bold text-slate-900">
                  Kepala Sekolah, Pejabat Pengesah & Kop Kedinasan
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identitas resmi kepala satuan pendidikan, nomor SK, titimangsa pengesahan, dan informasi kop surat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Surat Keputusan (SK)</label>
                  <input
                    type="text"
                    value={skNumber}
                    onChange={(e) => setSkNumber(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Pengesahan SK</label>
                  <input
                    type="date"
                    value={skDate}
                    onChange={(e) => setSkDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tempat Pengesahan (Kota/Kab)</label>
                  <input
                    type="text"
                    value={skCity}
                    onChange={(e) => setSkCity(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Data Kepala Sekolah (Penanda Tangan Utama)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      value={principalNip}
                      onChange={(e) => setPrincipalNip(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pangkat / Golongan</label>
                    <input
                      type="text"
                      value={principalRank}
                      onChange={(e) => setPrincipalRank(e.target.value)}
                      placeholder="Pembina Utama Muda / IV-c"
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Dewan Pembina Kesiswaan / OSIS
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pembina</label>
                    <input
                      type="text"
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jabatan Pembina</label>
                    <input
                      type="text"
                      value={supervisorRole}
                      onChange={(e) => setSupervisorRole(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP Pembina</label>
                    <input
                      type="text"
                      value={supervisorNip}
                      onChange={(e) => setSupervisorNip(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl glass-input font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Informasi Kop Surat Kedinasan & Kontak Satuan Pendidikan
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Isi manual baris kop surat tanpa batasan format atau pilih preset instansi di bawah ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualKopModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-2xs transition-all hover:scale-105 active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Menu Isi Manual Bar Kop</span>
                  </button>
                </div>

                {/* Preset Chips */}
                <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Preset Cepat Format Kop Surat (1-Klik):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {KOP_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyKopPreset(preset)}
                        className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 transition-colors shadow-2xs"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Baris 1 Kop (Manual Bebas)</span>
                      <span className="text-[10px] text-amber-600 font-semibold">Teks Bebas</span>
                    </label>
                    <input
                      type="text"
                      value={kopBarLine1}
                      onChange={(e) => {
                        setKopBarLine1(e.target.value);
                        setAgencyProvince(e.target.value);
                      }}
                      placeholder="Contoh: PEMERINTAH DAERAH PROVINSI..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900 font-semibold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Baris 2 Kop (Dinas/Instansi)</span>
                      <span className="text-[10px] text-amber-600 font-semibold">Teks Bebas</span>
                    </label>
                    <input
                      type="text"
                      value={kopBarLine2}
                      onChange={(e) => {
                        setKopBarLine2(e.target.value);
                        setAgencyDept(e.target.value);
                      }}
                      placeholder="Contoh: DINAS PENDIDIKAN..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Satuan Pendidikan</label>
                    <input
                      type="text"
                      value={schoolCustomName}
                      onChange={(e) => setSchoolCustomName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">NPSN</label>
                    <input
                      type="text"
                      value={schoolNpsnText}
                      onChange={(e) => setSchoolNpsnText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input font-mono text-slate-900"
                    />
                  </div>
                </div>

                {/* Additional Contact & Address Details: Alamat, Kode Pos, Email, Telepon, Website */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                  <div className="sm:col-span-8">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Alamat Jalan Satuan Pendidikan
                    </label>
                    <input
                      type="text"
                      value={schoolAddressText}
                      onChange={(e) => setSchoolAddressText(e.target.value)}
                      placeholder="Jl. Cikini Raya No. 45, Menteng"
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1 text-purple-700">
                      <Hash className="w-3.5 h-3.5" />
                      <span>Kode Pos Wilayah</span>
                    </label>
                    <input
                      type="text"
                      value={schoolPostalCode}
                      onChange={(e) => setSchoolPostalCode(e.target.value)}
                      placeholder="Contoh: 10330 / 40123"
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input font-mono font-bold text-slate-900 border-purple-300 focus:ring-purple-400"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1 text-purple-700">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email Resmi Sekolah / Kepala Sekolah</span>
                    </label>
                    <input
                      type="email"
                      value={schoolEmailText}
                      onChange={(e) => setSchoolEmailText(e.target.value)}
                      placeholder="info@sekolah.sch.id"
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input font-medium text-slate-900 border-purple-300 focus:ring-purple-400"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Nomor Telepon Sekolah</span>
                    </label>
                    <input
                      type="text"
                      value={schoolPhoneText}
                      onChange={(e) => setSchoolPhoneText(e.target.value)}
                      placeholder="(021) 31924510"
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>Laman Resmi (Website)</span>
                    </label>
                    <input
                      type="text"
                      value={schoolWebsiteText}
                      onChange={(e) => setSchoolWebsiteText(e.target.value)}
                      placeholder="https://smpn1teladan.sch.id"
                      className="w-full px-3 py-1.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>
                </div>

                {/* Logo Kop Surat Section: Logo Sekolah & Logo OSIS/OSIM */}
                <div className="pt-3 border-t border-slate-200/70">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 p-3.5 rounded-2xl border border-purple-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-purple-200 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                        {osisLogoUrl ? (
                          <img src={osisLogoUrl} alt={`Logo ${school.type}`} className="w-full h-full object-contain p-1" />
                        ) : (
                          <OsisLogoBadge size={44} type={school.type} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h6 className="text-xs font-bold text-slate-900">
                            Logo Resmi Organisasi Siswa ({school.type})
                          </h6>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full border border-purple-200">
                            Tampil di Pojok Kanan Kop Surat
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {osisLogoUrl ? 'Logo kustom telah terpasang dan tersinkronisasi ke sistem.' : 'Menggunakan lambang resmi standar. Klik tombol untuk mengunggah logo sendiri.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setShowUploadOsisModal(true)}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Menu Upload Logo {school.type}</span>
                      </button>
                      {osisLogoUrl && (
                        <button
                          type="button"
                          onClick={handleResetOsisLogo}
                          className="px-2.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
                          title="Hapus logo kustom"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EDIT ISI SURAT (KONSIDERAN & DIKTUM) */}
          {editorTab === 'letter' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80">
                <h4 className="text-sm font-bold text-slate-900">
                  Konsideran (Menimbang, Mengingat, Memperhatikan) & Diktum Putusan
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Teks landasan yuridis, operasional, dan diktum penetapan resmi SK Kepala Sekolah.
                </p>
              </div>

              {/* Konsideran Menimbang */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    1. Konsideran: Menimbang (Poin a, b, c...)
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddMenimbang}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Poin</span>
                  </button>
                </div>
                {menimbangList.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                      {String.fromCharCode(97 + idx)}
                    </span>
                    <textarea
                      rows={2}
                      value={m}
                      onChange={(e) => handleUpdateMenimbang(idx, e.target.value)}
                      className="flex-1 p-2 text-xs rounded-xl glass-input text-slate-900 font-serif leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteMenimbang(idx)}
                      disabled={menimbangList.length <= 1}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30 cursor-pointer mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Konsideran Mengingat */}
              <div className="space-y-3 pt-3 border-t border-slate-200/70">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    2. Konsideran: Mengingat (Dasar Hukum 1, 2, 3...)
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddMengingat}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Dasar Hukum</span>
                  </button>
                </div>
                {mengingatList.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={m}
                      onChange={(e) => handleUpdateMengingat(idx, e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl glass-input text-slate-900 font-serif"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteMengingat(idx)}
                      disabled={mengingatList.length <= 1}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Konsideran Memperhatikan */}
              <div className="pt-3 border-t border-slate-200/70">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                  3. Konsideran: Memperhatikan (Hasil Rapat Pleno)
                </h5>
                <textarea
                  rows={2}
                  value={memperhatikanText}
                  onChange={(e) => setMemperhatikanText(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl glass-input text-slate-900 font-serif leading-relaxed"
                />
              </div>

              {/* Diktum Putusan */}
              <div className="pt-3 border-t border-slate-200/70 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  4. Diktum Memutuskan & Menetapkan
                </h5>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Penetapan (Menetapkan)</label>
                    <textarea
                      rows={2}
                      value={diktumMenetapkan}
                      onChange={(e) => setDiktumMenetapkan(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl glass-input font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Diktum KESATU (Pembentukan Panitia)</label>
                    <textarea
                      rows={2}
                      value={diktumKesatu}
                      onChange={(e) => setDiktumKesatu(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Diktum KEDUA (Tugas & Wewenang)</label>
                    <textarea
                      rows={2}
                      value={diktumKedua}
                      onChange={(e) => setDiktumKedua(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Diktum KETIGA (Pembiayaan Anggaran)</label>
                    <textarea
                      rows={2}
                      value={diktumKetiga}
                      onChange={(e) => setDiktumKetiga(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Diktum KEEMPAT (Masa Berlaku & Penutup)</label>
                    <textarea
                      rows={2}
                      value={diktumKeempat}
                      onChange={(e) => setDiktumKeempat(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl glass-input text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EDIT KELOLA HALAMAN & LAMPIRAN KUSTOM */}
          {editorTab === 'pages' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/80">
                <h4 className="text-sm font-bold text-slate-900">
                  Manajemen Halaman Dokumen SK (1 s/d 99 Halaman)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan atau sesuaikan halaman lampiran kustom seperti jadwal kampanye, form verifikasi, dan denah bilik suara.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      activePreviewPage === p.pageNumber
                        ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20'
                        : 'bg-white/70 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono font-bold text-purple-700">
                        Hal {p.pageNumber} ({p.type})
                      </span>
                      {p.type === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleDeletePage(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          title="Hapus Halaman Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-xs truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{p.subtitle}</p>

                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePreviewPage(p.pageNumber);
                          setViewMode('preview');
                        }}
                        className="text-[11px] text-purple-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat Lembar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Page Text Editor if active page is custom */}
              {pages[activePreviewPage - 1]?.type === 'custom' && (
                <div className="p-4 rounded-2xl glass-card border border-purple-200 space-y-3 bg-white/80">
                  <h5 className="text-xs font-bold text-purple-900">
                    Edit Konten Halaman {activePreviewPage}:
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={pages[activePreviewPage - 1]?.title || ''}
                      onChange={(e) => handleUpdatePageContent(activePreviewPage - 1, { title: e.target.value })}
                      placeholder="Judul Halaman..."
                      className="px-3 py-2 text-xs rounded-xl glass-input font-bold text-slate-900"
                    />
                    <input
                      type="text"
                      value={pages[activePreviewPage - 1]?.subtitle || ''}
                      onChange={(e) => handleUpdatePageContent(activePreviewPage - 1, { subtitle: e.target.value })}
                      placeholder="Subjudul Halaman..."
                      className="px-3 py-2 text-xs rounded-xl glass-input text-slate-800"
                    />
                  </div>
                  <textarea
                    rows={6}
                    value={pages[activePreviewPage - 1]?.customContent || ''}
                    onChange={(e) => handleUpdatePageContent(activePreviewPage - 1, { customContent: e.target.value })}
                    placeholder="Isi teks berita acara, daftar saksi, tata tertib tambahan, dll..."
                    className="w-full p-3 text-xs rounded-xl glass-input font-serif text-slate-900"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODE 2: LEMBAR SURAT KEPUTUSAN CETAK (A4 STANDARD MULTI-PAGE PRINTABLE)
         ========================================================================= */}
      <div
        className="print-scale-wrapper max-w-4xl mx-auto space-y-8 print:space-y-0 print:max-w-none text-slate-900 font-serif leading-relaxed transition-transform duration-200 origin-top pb-12 print:pb-0"
        style={{ transform: zoomScale !== 100 ? `scale(${zoomScale / 100})` : 'none' }}
      >
        {pages.map((pageItem, pageIdx) => {
          return (
            <div
              key={pageItem.id}
              className={`print-document-sheet bg-white p-8 md:p-14 rounded-none sm:rounded-lg shadow-2xl border border-slate-300 print:p-0 print:m-0 print:shadow-none print:border-none print:rounded-none print:ring-0 print:opacity-100 print:min-h-0 relative min-h-[1120px] flex flex-col justify-between ${
                viewMode === 'editor' && activePreviewPage === pageItem.pageNumber ? 'ring-4 ring-purple-500/30' : ''
              }`}
              style={getPageBreakStyle(pageIdx, pages.length)}
            >
              {/* Watermark option */}
              {showWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                  <span className="text-8xl font-black font-sans uppercase text-slate-200/40 transform -rotate-45 tracking-widest">
                    DOKUMEN ASLI
                  </span>
                </div>
              )}

              {/* ================= HEADER SETIAP HALAMAN ================= */}
              <div className="relative z-10 space-y-4">
                {/* Halaman 1: KOP SURAT RESMI LENGKAP */}
                {pageItem.pageNumber === 1 ? (
                  <div className="border-b-4 border-double border-slate-900 pb-4 text-center relative flex items-center justify-between">
                    {/* Logo Sekolah (Sisi Kiri) */}
                    <div className="w-24 flex-shrink-0 flex items-center justify-center relative group/schoollogo">
                      <div 
                        style={{
                          width: `${schoolLogoWidth}px`,
                          height: `${schoolLogoHeight}px`,
                          transform: `translate(${schoolLogoOffsetX}px, ${schoolLogoOffsetY}px)`,
                        }}
                        className={`bg-transparent flex flex-col items-center justify-center p-0.5 overflow-visible relative transition-all ${
                          resizingTarget === 'school' ? 'ring-2 ring-purple-500 rounded-lg shadow-lg' : ''
                        }`}
                      >
                        {schoolLogoUrl ? (
                          <img src={schoolLogoUrl} alt="Logo Sekolah" className="w-full h-full object-contain filter drop-shadow-2xs pointer-events-none" />
                        ) : (
                          <SchoolCrestLogo width={Math.max(20, schoolLogoWidth - 4)} height={Math.max(20, schoolLogoHeight - 6)} aspectRatio="2x3" type={school.type} logoUrl={school.logoUrl} />
                        )}

                        {/* Drag, Resize, Edit & Save Handle Controls (Never in Print) */}
                        <div className="no-print opacity-0 group-hover/schoollogo:opacity-100 transition-opacity">
                          {/* Move Position Handle (Top-Left ✥) */}
                          <button
                            type="button"
                            onMouseDown={(e) => startDrag(e, 'school', 'position')}
                            onTouchStart={(e) => startDrag(e, 'school', 'position')}
                            className="absolute -top-2.5 -left-2.5 z-30 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md cursor-move hover:scale-125 transition-transform"
                            title="Tarik untuk menggeser posisi Logo Sekolah"
                          >
                            <Move className="w-3 h-3" />
                          </button>

                          {/* Resize Corner Handle (Bottom-Right ↘) */}
                          <button
                            type="button"
                            onMouseDown={(e) => startDrag(e, 'school', 'resize')}
                            onTouchStart={(e) => startDrag(e, 'school', 'resize')}
                            className="absolute -bottom-2.5 -right-2.5 z-30 p-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md cursor-se-resize hover:scale-125 transition-transform"
                            title="Tarik sudut ini (↘) untuk mengubah ukuran gambar secara langsung"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>

                          {/* Numeric Input & Save Quick Action Bar */}
                          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setShowLogoSizeModal(true)}
                              className="px-1.5 py-0.5 bg-slate-900/90 text-white text-[8.5px] font-mono font-bold rounded shadow-md hover:bg-purple-700 transition-colors cursor-pointer"
                              title="Klik untuk membuka menu Edit & Ukuran Logo Kop"
                            >
                              📏 {schoolLogoWidth}x{schoolLogoHeight}px
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveLogoSize(false)}
                              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[8.5px] font-sans font-bold rounded shadow-md transition-colors cursor-pointer flex items-center gap-0.5"
                              title="Simpan ukuran Logo Kop ini"
                            >
                              <Save className="w-2.5 h-2.5" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 px-4 relative group">
                      {/* Floating Quick Action: Menu Isi Manual Bar Kop Ini & Menu Edit Logo */}
                      <div className="no-print absolute -top-3.5 right-2 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setShowManualKopModal(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          title="Buka Menu Isi Manual Bar Kop Ini"
                        >
                          <Edit3 className="w-2.5 h-2.5 text-amber-700" />
                          <span>Menu Edit Kop</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLogoSizeModal(true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-md shadow-xs transition-all cursor-pointer"
                          title="Buka Menu Ukuran & Simpan Logo Kop"
                        >
                          <Save className="w-2.5 h-2.5 text-indigo-700" />
                          <span>Ukuran & Save Logo</span>
                        </button>
                      </div>

                      <p 
                        onClick={() => setShowManualKopModal(true)}
                        className="text-xs uppercase font-sans tracking-widest text-slate-700 font-bold cursor-pointer hover:bg-amber-100/70 hover:text-amber-900 px-1.5 py-0.5 rounded transition-colors"
                        title="Klik untuk membuka menu Isi Manual Bar Kop Surat ini"
                      >
                        {kopBarLine1 || '(Klik untuk isi manual baris instansi induk)'}
                      </p>
                      {showKopLine2 && kopBarLine2 && (
                        <p 
                          onClick={() => setShowManualKopModal(true)}
                          className="text-xs uppercase font-sans tracking-widest text-slate-700 font-bold cursor-pointer hover:bg-amber-100/70 hover:text-amber-900 px-1.5 py-0.5 rounded transition-colors"
                          title="Klik untuk membuka menu Isi Manual Bar Kop Surat ini"
                        >
                          {kopBarLine2}
                        </p>
                      )}
                      <h1 className="text-xl md:text-2xl font-black font-sans uppercase tracking-tight text-slate-950 mt-0.5">
                        {schoolCustomName}
                      </h1>
                      <p className="text-xs font-sans text-slate-600 mt-1">
                        Alamat: {schoolAddressText}, {skCity} {schoolPostalCode ? `· Kode Pos: ${schoolPostalCode}` : ''} · NPSN: {schoolNpsnText} · Telp: {schoolPhoneText}
                      </p>
                      <p className="text-[11px] font-sans text-slate-500 text-center">
                        Laman: {schoolWebsiteText} · Email: {schoolEmailText}
                      </p>
                    </div>

                    {/* Logo OSIS / OSIM (Sisi Kanan) */}
                    <div className="w-24 flex-shrink-0 flex items-center justify-center relative group/osislogo">
                      <div 
                        style={{
                          width: `${osisLogoWidth}px`,
                          height: `${osisLogoHeight}px`,
                          transform: `translate(${osisLogoOffsetX}px, ${osisLogoOffsetY}px)`,
                        }}
                        className={`bg-transparent flex flex-col items-center justify-center p-0.5 overflow-visible relative transition-all ${
                          resizingTarget === 'osis' ? 'ring-2 ring-purple-500 rounded-lg shadow-lg' : ''
                        }`}
                      >
                        {osisLogoUrl ? (
                          <img
                            src={osisLogoUrl}
                            alt={`Logo ${school.type}`}
                            className="w-full h-full object-contain filter drop-shadow-2xs pointer-events-none"
                          />
                        ) : (
                          <OsisLogoBadge width={Math.max(20, osisLogoWidth - 4)} height={Math.max(20, osisLogoHeight - 6)} aspectRatio="2x3" type={school.type} />
                        )}

                        {/* Drag, Resize, Upload & Save Handle Controls (Never in Print) */}
                        <div className="no-print opacity-0 group-hover/osislogo:opacity-100 transition-opacity">
                          {/* Move Position Handle (Top-Left ✥) */}
                          <button
                            type="button"
                            onMouseDown={(e) => startDrag(e, 'osis', 'position')}
                            onTouchStart={(e) => startDrag(e, 'osis', 'position')}
                            className="absolute -top-2.5 -left-2.5 z-30 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md cursor-move hover:scale-125 transition-transform"
                            title={`Tarik untuk menggeser posisi Logo ${school.type}`}
                          >
                            <Move className="w-3 h-3" />
                          </button>

                          {/* Resize Corner Handle (Bottom-Right ↘) */}
                          <button
                            type="button"
                            onMouseDown={(e) => startDrag(e, 'osis', 'resize')}
                            onTouchStart={(e) => startDrag(e, 'osis', 'resize')}
                            className="absolute -bottom-2.5 -right-2.5 z-30 p-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md cursor-se-resize hover:scale-125 transition-transform"
                            title="Tarik sudut ini (↘) untuk mengubah ukuran gambar secara langsung"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>

                          {/* Upload Modal Trigger overlay button */}
                          <button
                            type="button"
                            onClick={() => setShowUploadOsisModal(true)}
                            className="absolute -top-2.5 -right-2.5 z-30 p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md hover:scale-125 transition-transform cursor-pointer"
                            title={`Upload / ganti file logo ${school.type}`}
                          >
                            <Upload className="w-3 h-3" />
                          </button>

                          {/* Numeric Input & Save Quick Action Bar */}
                          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setShowLogoSizeModal(true)}
                              className="px-1.5 py-0.5 bg-slate-900/90 text-white text-[8.5px] font-mono font-bold rounded shadow-md hover:bg-purple-700 transition-colors cursor-pointer"
                              title="Klik untuk membuka menu Edit & Ukuran Logo Kop"
                            >
                              📏 {osisLogoWidth}x{osisLogoHeight}px
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveLogoSize(false)}
                              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[8.5px] font-sans font-bold rounded shadow-md transition-colors cursor-pointer flex items-center gap-0.5"
                              title="Simpan ukuran Logo Kop ini"
                            >
                              <Save className="w-2.5 h-2.5" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Halaman 2 sampai 99: RUNNING HEADER KOMPAK */
                  <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between text-xs font-sans text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-slate-900">{schoolCustomName}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px]">SK No: {skNumber}</span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-slate-700">
                      HALAMAN {pageItem.pageNumber} DARI {pages.length}
                    </div>
                  </div>
                )}

                {/* ================= KONTEN HALAMAN ================= */}
                {/* HALAMAN 1: SURAT KEPUTUSAN UTAMA (KONSIDERAN & DIKTUM) */}
                {pageItem.type === 'main_sk' && (
                  <div className="space-y-4 pt-2">
                    {/* Judul Keputusan */}
                    <div className="text-center space-y-1 font-sans">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 underline underline-offset-4">
                        KEPUTUSAN KEPALA {schoolCustomName.toUpperCase()}
                      </h2>
                      <p className="text-xs font-mono font-bold text-slate-800">
                        NOMOR: {skNumber}
                      </p>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-900 max-w-2xl mx-auto pt-1 leading-snug">
                        TENTANG PEMBENTUKAN DAN PENETAPAN SUSUNAN PANITIA {eventName.toUpperCase()} TAHUN AJARAN {academicYear}
                      </p>
                      {eventTheme && (
                        <p className="text-[11px] italic font-medium text-slate-600 max-w-xl mx-auto">
                          Tema: "{eventTheme}"
                        </p>
                      )}
                    </div>

                    <div className="text-center font-sans font-bold text-xs uppercase tracking-widest text-slate-900 py-1">
                      DENGAN RAHMAT TUHAN YANG MAHA ESA<br />
                      KEPALA {schoolCustomName.toUpperCase()}
                    </div>

                    {/* Konsideran: Menimbang */}
                    <div className="space-y-2 text-xs text-justify">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">Menimbang</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9 space-y-1">
                          {menimbangList.map((m, idx) => (
                            <p key={idx}>
                              <strong>{String.fromCharCode(97 + idx)}.</strong> {m}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Konsideran: Mengingat */}
                      <div className="grid grid-cols-12 gap-2 pt-1">
                        <div className="col-span-2 font-bold font-sans">Mengingat</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9 space-y-1">
                          {mengingatList.map((m, idx) => (
                            <p key={idx}>
                              <strong>{idx + 1}.</strong> {m}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Konsideran: Memperhatikan */}
                      <div className="grid grid-cols-12 gap-2 pt-1">
                        <div className="col-span-2 font-bold font-sans">Memperhatikan</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9">
                          <p>{memperhatikanText}</p>
                        </div>
                      </div>
                    </div>

                    {/* Diktum Memutuskan */}
                    <div className="border-t border-slate-300 pt-3 space-y-2 text-xs text-justify">
                      <div className="text-center font-sans font-bold uppercase tracking-wider text-slate-900 pb-1">
                        MEMUTUSKAN:
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">Menetapkan</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9 font-bold">
                          {diktumMenetapkan}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">KESATU</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9">
                          {diktumKesatu}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">KEDUA</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9">
                          {diktumKedua}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">KETIGA</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9">
                          {diktumKetiga}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 font-bold font-sans">KEEMPAT</div>
                        <div className="col-span-1 text-center">:</div>
                        <div className="col-span-9">
                          {diktumKeempat}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* HALAMAN 2: LAMPIRAN I - SUSUNAN PERSONALIA PANITIA */}
                {pageItem.type === 'appendix_members' && (
                  <div className="space-y-4 pt-2">
                    <div className="text-right text-[11px] font-sans space-y-0.5 text-slate-700">
                      <p><strong>LAMPIRAN I:</strong> KEPUTUSAN KEPALA {schoolCustomName.toUpperCase()}</p>
                      <p>NOMOR: {skNumber}</p>
                      <p>TANGGAL: {formattedSkDate.toUpperCase()}</p>
                      <p>TENTANG: SUSUNAN PANITIA {eventName.toUpperCase()} {academicYear}</p>
                    </div>

                    <div className="text-center py-2 font-sans">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 underline underline-offset-4">
                        SUSUNAN STRUKTUR & PERSONALIA PANITIA PEMILIHAN
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Satuan Pendidikan: {schoolCustomName} · Tahun Ajaran {academicYear}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Pelaksanaan: {eventDateText} ({eventTimeText}) · Tempat: {eventLocation}
                      </p>
                    </div>

                    {/* Hierarchy High-level Overview */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-sans bg-slate-50 p-4 rounded-xl border border-slate-300">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Penanggung Jawab Umum:</span>
                        <p className="font-bold text-slate-900">{principalName} (Kepala Sekolah)</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Pengarah & Pembina Kesiswaan:</span>
                        <p className="font-bold text-slate-900">{supervisorName} ({supervisorRole})</p>
                      </div>
                    </div>

                    {/* Formal Table of Committee Members */}
                    <div className="border border-slate-900 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold">
                          <tr>
                            <th className="p-2.5 w-10 text-center border-r border-slate-400">No</th>
                            <th className="p-2.5 w-44 border-r border-slate-400">Jabatan Kepanitiaan</th>
                            <th className="p-2.5 border-r border-slate-400">Nama Lengkap Anggota</th>
                            <th className="p-2.5 w-24 border-r border-slate-400 text-center">Kelas / Unsur</th>
                            <th className="p-2.5 w-48">Keterangan / Tugas Pokok</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-800">
                          {committeeList.map((m, idx) => (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="p-2.5 text-center font-mono border-r border-slate-300">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-slate-900 border-r border-slate-300">
                                {m.role}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-900 border-r border-slate-300">
                                {m.memberName || '(Belum Diisi)'}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-300 font-medium">
                                {m.className}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-600">
                                {m.duties || getDutyDescription(m.role)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[11px] text-slate-600 font-sans italic pt-2">
                      * Seluruh anggota panitia wajib menandatangani Pakta Integritas dan menjaga asas LUBER-JURDIL selama bertugas.
                    </p>
                  </div>
                )}

                {/* HALAMAN 3: LAMPIRAN II - RINCIAN URAIAN TUGAS & WEWENANG */}
                {pageItem.type === 'appendix_duties' && (
                  <div className="space-y-4 pt-2 text-xs">
                    <div className="text-right text-[11px] font-sans space-y-0.5 text-slate-700">
                      <p><strong>LAMPIRAN II:</strong> KEPUTUSAN KEPALA {schoolCustomName.toUpperCase()}</p>
                      <p>NOMOR: {skNumber}</p>
                      <p>TANGGAL: {formattedSkDate.toUpperCase()}</p>
                      <p>TENTANG: URAIAN TUGAS DAN KEWENANGAN PANITIA</p>
                    </div>

                    <div className="text-center py-2 font-sans">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 underline underline-offset-4">
                        RINCIAN TUGAS POKOK, WEWENANG, DAN TANGGUNG JAWAB PANITIA
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Penyelenggaraan {eventName} {academicYear}
                      </p>
                    </div>

                    <div className="space-y-3 font-sans leading-relaxed">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                        <h4 className="font-bold text-slate-900">1. KETUA & WAKIL KETUA PANITIA</h4>
                        <p className="text-slate-700">
                          - Bertanggung jawab memimpin dan mengoordinasikan seluruh tahapan pra-pemilihan, pemungutan suara, dan rekapitulasi.<br />
                          - Menetapkan jadwal resmi pendaftaran bakal calon, masa kampanye, dan hari pemungutan suara.<br />
                          - Memimpin sidang pleno penetapan hasil perolehan suara dan menandatangani Berita Acara Hasil Pemilihan (BAHP).
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                        <h4 className="font-bold text-slate-900">2. SEKRETARIS</h4>
                        <p className="text-slate-700">
                          - Mengelola seluruh persuratan, formulir pendaftaran paslon, dan verifikasi daftar hadir pemilih DPT.<br />
                          - Menyusun dokumen Berita Acara, notulen rapat pleno, serta arsip portofolio kepanitiaan.<br />
                          - Memverifikasi kelengkapan berkas administrasi syarat calon ketua dan wakil ketua {school.type}.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                        <h4 className="font-bold text-slate-900">3. BENDAHARA</h4>
                        <p className="text-slate-700">
                          - Mengelola dan menyusun Rencana Anggaran Biaya (RAB) kegiatan pemilihan.<br />
                          - Mencatat pemasukan dan pengeluaran secara transparan dan akuntabel.<br />
                          - Membuat Laporan Pertanggungjawaban (LPJ) keuangan pasca pemilihan selesai.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                        <h4 className="font-bold text-slate-900">4. KOORDINATOR IT & BILIK SUARA DIGITAL</h4>
                        <p className="text-slate-700">
                          - Bertanggung jawab atas ketersediaan perangkat komputer/laptop bilik suara dan konektivitas jaringan.<br />
                          - Mengelola pembuatan token PIN rahasia bagi pemilih terdaftar (DPT) secara terisolasi dan aman.<br />
                          - Memastikan integritas database suara tanpa kebocoran pilihan pemilih (asas rahasia/LUBER).
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 space-y-1">
                        <h4 className="font-bold text-slate-900">5. SEKSI LOGISTIK, PENGAWAS & SAKSI</h4>
                        <p className="text-slate-700">
                          - Menyiapkan denah TPS di {eventLocation}, nomor urut bilik, dan pencetakan kartu token fisik pemilih.<br />
                          - Mengawasi jalannya proses pemungutan suara bebas dari intimidasi atau kecurangan.<br />
                          - Menyaksikan pengesahan hasil akhir perhitungan suara dan menandatangani sertifikat penetapan hasil.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* HALAMAN 4: LAMPIRAN III - TATA TERTIB & KETENTUAN BILIK SUARA */}
                {pageItem.type === 'appendix_rules' && (
                  <div className="space-y-4 pt-2 text-xs">
                    <div className="text-right text-[11px] font-sans space-y-0.5 text-slate-700">
                      <p><strong>LAMPIRAN III:</strong> KEPUTUSAN KEPALA {schoolCustomName.toUpperCase()}</p>
                      <p>NOMOR: {skNumber}</p>
                      <p>TANGGAL: {formattedSkDate.toUpperCase()}</p>
                      <p>TENTANG: TATA TERTIB PEMILIHAN & BILIK DIGITAL</p>
                    </div>

                    <div className="text-center py-2 font-sans">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 underline underline-offset-4">
                        TATA TERTIB & REGULASI BILIK SUARA DIGITAL E-PILKETOS
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Asas Penyelenggaraan: Langsung, Umum, Bebas, Rahasia, Jujur, dan Adil (LUBER-JURDIL)
                      </p>
                    </div>

                    <div className="space-y-3 font-sans leading-relaxed text-justify">
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900">Pasal 1: Hak dan Syarat Pemilih</h4>
                        <p className="text-slate-700">
                          (1) Setiap peserta didik {schoolCustomName} yang tercatat aktif dalam Daftar Pemilih Tetap (DPT) memiliki 1 (satu) hak suara yang sah.<br />
                          (2) Hak suara bersifat melekat pribadi dan tidak dapat diwakilkan kepada siapapun dengan alasan apapun.<br />
                          (3) Pemilih wajib menunjukkan kartu pemilih resmi atau menyebutkan NISN kepada meja registrasi panitia untuk mendapatkan token PIN bilik suara.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900">Pasal 2: Kerahasiaan di Bilik Suara</h4>
                        <p className="text-slate-700">
                          (1) Pemilih masuk ke bilik suara digital secara mandiri tanpa didampingi orang lain, kecuali pemilih berkebutuhan khusus dengan persetujuan pengawas.<br />
                          (2) Dilarang membawa kamera, telepon seluler berkamera, atau alat perekam gambar saat berada di dalam bilik suara.<br />
                          (3) Dilarang mempublikasikan atau mendokumentasikan pilihan paslon di media sosial selama masa pemilihan berlangsung.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900">Pasal 3: Validitas Token PIN & Larangan Suara Ganda</h4>
                        <p className="text-slate-700">
                          (1) Token PIN bilik suara bersifat rahasia dan hanya dapat digunakan 1 (satu) kali transaksi pencoblosan digital.<br />
                          (2) Sistem digital secara otomatis membakar (burn) token PIN setelah tombol konfirmasi ditekan, mencegah terjadinya suara ganda.<br />
                          (3) Setiap percobaan manipulasi sistem atau penggunaan akun siswa lain akan dicatat dalam Log Audit Forensik Sistem dan dikenai sanksi tata tertib kesiswaan.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900">Pasal 4: Penetapan Hasil dan Penyelesaian Keberatan</h4>
                        <p className="text-slate-700">
                          (1) Rekapitulasi suara dilakukan secara otomatis oleh sistem digital dan diproyeksikan pada Papan Hitung Cepat secara transparan.<br />
                          (2) Pasangan calon yang memperoleh suara terbanyak dinyatakan sebagai Ketua dan Wakil Ketua {school.type} terpilih.<br />
                          (3) Keberatan saksi hanya dapat diajukan secara tertulis maksimal 1x24 jam pasca pleno dengan melampirkan bukti fisik yang sah.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* HALAMAN 5: LAMPIRAN IV - PAKTA INTEGRITAS & NETRALITAS */}
                {pageItem.type === 'appendix_integrity' && (
                  <div className="space-y-4 pt-2 text-xs">
                    <div className="text-right text-[11px] font-sans space-y-0.5 text-slate-700">
                      <p><strong>LAMPIRAN IV:</strong> KEPUTUSAN KEPALA {schoolCustomName.toUpperCase()}</p>
                      <p>NOMOR: {skNumber}</p>
                      <p>TANGGAL: {formattedSkDate.toUpperCase()}</p>
                      <p>TENTANG: PAKTA INTEGRITAS DAN NETRALITAS PANITIA</p>
                    </div>

                    <div className="text-center py-2 font-sans">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 underline underline-offset-4">
                        PAKTA INTEGRITAS DAN PERNYATAAN NETRALITAS PANITIA
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        Komitmen Menjaga Demokrasi Sekolah yang Bersih, Jujur, dan Bebas Intervensi
                      </p>
                    </div>

                    <div className="space-y-3 font-sans leading-relaxed text-justify">
                      <p className="text-slate-800">
                        Kami yang bertanda tangan di bawah ini, seluruh Anggota Panitia {eventName} {schoolCustomName} Periode {academicYear}, dengan penuh rasa tanggung jawab dan atas nama kehormatan diri serta almamater, berjanji dan menyatakan:
                      </p>

                      <ol className="list-decimal list-outside pl-5 space-y-1.5 text-slate-800">
                        <li>
                          <strong>Menjunjung Tinggi Netralitas:</strong> Tidak memihak kepada salah satu pasangan calon, tidak terlibat dalam kegiatan kampanye paslon tertentu, serta memperlakukan seluruh pasangan calon dengan adil dan setara.
                        </li>
                        <li>
                          <strong>Menegakkan Kejujuran dan Transparansi:</strong> Menjalankan seluruh tahapan verifikasi, pencetakan token, pemungutan suara, dan perhitungan suara secara transparan tanpa manipulasi data.
                        </li>
                        <li>
                          <strong>Menjaga Kerahasiaan Data Pemilih:</strong> Menjaga keamanan token PIN pemilih dan tidak mencoba mengetahui pilihan rahasia setiap siswa dalam bilik suara.
                        </li>
                        <li>
                          <strong>Menolak Intervensi dan Gratifikasi:</strong> Tidak menerima suap, hadiah, janji, atau imbalan dalam bentuk apapun dari pihak manapun yang berpotensi mempengaruhi objektivitas tugas panitia.
                        </li>
                        <li>
                          <strong>Bertanggung Jawab Penuh:</strong> Siap menerima sanksi moral, pembatalan status kepanitiaan, serta tindakan disiplin kesiswaan apabila terbukti melanggar butir-butir pakta integritas ini.
                        </li>
                      </ol>

                      <div className="pt-4 grid grid-cols-2 gap-8 text-center">
                        <div className="space-y-1">
                          <p className="text-slate-600">Mengetahui & Menyetujui,</p>
                          <p className="font-bold text-slate-900">{supervisorRole}</p>
                          <div className="h-16"></div>
                          <p className="font-bold underline text-slate-900">( {supervisorName} )</p>
                          <p className="text-[10px] text-slate-500 font-mono">NIP. {supervisorNip}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-600">Atas Nama Seluruh Panitia,</p>
                          <p className="font-bold text-slate-900">Ketua Panitia Pemilihan</p>
                          <div className="h-16"></div>
                          <p className="font-bold underline text-slate-900">
                            ( {chairman?.memberName || 'Dimas Arya Pratama'} )
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Kelas: {chairman?.className || 'VIII A'} · SK No: {skNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* HALAMAN TAMBAHAN / CUSTOM (HALAMAN 6 HINGGA 99) */}
                {pageItem.type === 'custom' && (
                  <div className="space-y-4 pt-2 text-xs">
                    <div className="text-right text-[11px] font-sans space-y-0.5 text-slate-700">
                      <p><strong>{pageItem.title.toUpperCase()}</strong></p>
                      <p>NOMOR: {skNumber}</p>
                      <p>TANGGAL: {formattedSkDate.toUpperCase()}</p>
                      <p>{pageItem.subtitle.toUpperCase()}</p>
                    </div>

                    <div className="text-center py-2 font-sans">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 underline underline-offset-4">
                        {pageItem.title}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {pageItem.subtitle}
                      </p>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-300 font-serif leading-relaxed whitespace-pre-wrap text-justify text-slate-800">
                      {pageItem.customContent ||
                        `Dokumen lampiran tambahan keputusan kepala satuan pendidikan ${schoolCustomName}. Lembar ini dapat diisi dengan jadwal tahapan kampanye, berita acara pengundian nomor urut paslon, denah TPS bilik suara, atau pakta integritas saksi.`}
                    </div>

                    {/* Table Placeholder / Notes */}
                    <div className="border border-slate-300 rounded-xl p-4 bg-white space-y-2 font-sans text-xs">
                      <h4 className="font-bold text-slate-900">Catatan Khusus Panitia Pengawas:</h4>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Dokumen ini merupakan bagian yang tidak terpisahkan dari Surat Keputusan Kepala {schoolCustomName} Nomor {skNumber}. Segala perubahan isi klausul wajib disahkan kembali melalui addendum Surat Keputusan Kepala Sekolah.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= FOOTER & TANDA TANGAN ================= */}
              <div className="relative z-10 pt-8 mt-6 border-t border-slate-300">
                {/* Bagian Titimangsa & Tanda Tangan Kepala Sekolah (Muncul di Halaman 1 atau Halaman Terakhir) */}
                {(pageItem.pageNumber === 1 || pageItem.pageNumber === pages.length) && (
                  <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pb-4">
                    {/* Security Verification & QR Code */}
                    <div className="space-y-2 text-left font-sans">
                      {showQrCode && (
                        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/80">
                          <div className="w-14 h-14 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
                            <QrCode className="w-12 h-12 text-slate-900" />
                          </div>
                          <div className="space-y-0.5 text-[10px] text-slate-600">
                            <span className="font-bold text-slate-900 block flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                              VERIFIKASI OTENTIKASI RESMI
                            </span>
                            <p className="font-mono">ID: SK-{period.id.substring(0, 8).toUpperCase()}</p>
                            <p>Tersimpan dalam database arsip sekolah.</p>
                          </div>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 font-sans space-y-0.5">
                        <p><strong>Tembusan disampaikan kepada:</strong></p>
                        <p>1. Yth. Kepala Dinas Pendidikan Provinsi / Kab/Kota</p>
                        <p>2. Yth. Pengawas Sekolah Pembina</p>
                        <p>3. Yth. Dewan Pembina {school.type} {schoolCustomName}</p>
                        <p>4. Arsip Satuan Pendidikan</p>
                      </div>
                    </div>

                    {/* Official Signature Block (With Interactive Menu Edit Component) */}
                    <div className="w-64 text-center font-sans space-y-1 relative group/sigblock rounded-xl transition-colors hover:bg-purple-50/40 p-1 -m-1">
                      {/* Floating Quick Edit Trigger for Signature & Stamp Component (Never in Print) */}
                      <button
                        type="button"
                        onClick={() => setShowEditStampModal(true)}
                        className="no-print absolute -top-7 right-0 z-30 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-purple-900 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg shadow-sm transition-all cursor-pointer"
                        title="Buka Menu Edit Stempel, Tanda Tangan & Pengesahan di komponen ini"
                      >
                        <Edit3 className="w-3 h-3 text-purple-700" />
                        <span>Menu Edit</span>
                      </button>

                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-xs text-slate-700 cursor-pointer hover:text-purple-800"
                        title="Klik untuk mengedit tempat penetapan"
                      >
                        Ditetapkan di: <strong>{skCity}</strong>
                      </p>
                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-xs text-slate-700 cursor-pointer hover:text-purple-800"
                        title="Klik untuk mengedit tanggal penetapan"
                      >
                        Pada tanggal: <strong>{formattedSkDate}</strong>
                      </p>
                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-xs font-bold uppercase text-slate-900 pt-1 cursor-pointer hover:text-purple-800"
                        title="Klik untuk mengedit jabatan pengesah"
                      >
                        {signatoryTitle || `KEPALA ${schoolCustomName.toUpperCase()}`}
                      </p>

                      {/* Digital Stamp & Signature Simulation */}
                      <div
                        onClick={() => setShowEditStampModal(true)}
                        className="h-20 flex items-center justify-center relative my-1 cursor-pointer"
                      >
                        {showStamp && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEditStampModal(true);
                            }}
                            style={{
                              width: `${stampSizePx}px`,
                              height: `${stampSizePx}px`,
                              left: `${stampOffsetX}px`,
                              top: `${stampOffsetY}px`,
                              transform: `rotate(${stampRotationDeg}deg)`,
                            }}
                            className={`absolute z-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-[8px] font-black uppercase text-center p-1 shadow-2xs cursor-pointer transition-all hover:ring-2 hover:ring-purple-400 group/stampitem ${
                              stampColorTheme === 'blue'
                                ? 'border-sky-600/75 text-sky-700/85'
                                : stampColorTheme === 'emerald'
                                ? 'border-emerald-600/75 text-emerald-700/85'
                                : stampColorTheme === 'rose'
                                ? 'border-rose-600/75 text-rose-700/85'
                                : stampColorTheme === 'slate'
                                ? 'border-slate-700/75 text-slate-800/85'
                                : 'border-purple-600/70 text-purple-700/80'
                            }`}
                            title="Klik untuk membuka Menu Edit Stempel & Tanda Tangan"
                          >
                            <span>{stampHeaderText}</span>
                            <span className="text-[7px] leading-tight font-extrabold">
                              {stampInstitutionText || schoolCustomName}
                            </span>
                            <span>{stampFooterText}</span>
                            <span className="no-print opacity-0 group-hover/stampitem:opacity-100 absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-sans font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                              ✏️ Edit Stempel
                            </span>
                          </div>
                        )}
                      </div>

                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-xs font-bold text-slate-950 underline underline-offset-4 cursor-pointer hover:text-purple-800"
                      >
                        {principalName}
                      </p>
                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-[11px] font-mono text-slate-700 cursor-pointer hover:text-purple-800"
                      >
                        NIP. {principalNip}
                      </p>
                      <p
                        onClick={() => setShowEditStampModal(true)}
                        className="text-[10px] text-slate-500 font-medium cursor-pointer hover:text-purple-800"
                      >
                        {principalRank}
                      </p>
                    </div>
                  </div>
                )}

                {/* Running Footer: Halaman X dari Y */}
                <div className="flex items-center justify-between text-[11px] font-sans text-slate-500 pt-2 border-t border-slate-200">
                  <span>Dokumen Resmi Surat Keputusan (SK) Kepala Sekolah · {schoolCustomName}</span>
                  <span className="font-mono font-bold text-slate-700">
                    Halaman {pageItem.pageNumber} dari {pages.length}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL MENU ISI MANUAL BAR KOP SURAT ================= */}
      {showManualKopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Menu Isi Manual Bar Kop Surat
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sesuaikan teks baris 1 & 2 kop surat secara bebas tanpa batasan prefix
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualKopModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Preset Cepat Kop Surat (1-Klik):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {KOP_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyKopPreset(preset)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 transition-colors shadow-2xs cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input Baris 1 & 2 */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Baris 1 Kop (Instansi Induk / Pemerintah Daerah / Yayasan)
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={kopBarLine1}
                    onChange={(e) => {
                      setKopBarLine1(e.target.value);
                      setAgencyProvince(e.target.value);
                    }}
                    placeholder="Contoh: PEMERINTAH DAERAH PROVINSI DKI JAKARTA atau YAYASAN PENDIDIKAN..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-bold uppercase text-slate-900 bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Teks ini tampil persis apa adanya di baris paling atas kop surat tanpa penambahan otomatis.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Baris 2 Kop (Dinas Pendidikan / Kantor Wilayah / Badan Pengurus)
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showKopLine2}
                        onChange={(e) => setShowKopLine2(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Tampilkan Baris 2</span>
                    </label>
                  </div>
                  {showKopLine2 && (
                    <input
                      type="text"
                      value={kopBarLine2}
                      onChange={(e) => {
                        setKopBarLine2(e.target.value);
                        setAgencyDept(e.target.value);
                      }}
                      placeholder="Contoh: DINAS PENDIDIKAN DAN KEBUDAYAAN atau KANTOR KEMENTERIAN AGAMA"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-bold uppercase text-slate-900 bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                  Pratinjau Hasil Bar Kop Surat:
                </span>
                <div className="border-b-2 border-slate-800 pb-2 text-center bg-white p-3 rounded shadow-2xs">
                  <p className="text-[11px] uppercase font-sans tracking-widest text-slate-700 font-bold">
                    {kopBarLine1 || '(Kosong / Tidak Ditampilkan)'}
                  </p>
                  {showKopLine2 && kopBarLine2 && (
                    <p className="text-[11px] uppercase font-sans tracking-widest text-slate-700 font-bold">
                      {kopBarLine2}
                    </p>
                  )}
                  <p className="text-sm font-black font-sans uppercase text-slate-900 mt-0.5">
                    {schoolCustomName}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {schoolAddressText}, {skCity} {schoolPostalCode ? `· Kode Pos: ${schoolPostalCode}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualKopModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualKopModal(false);
                  showToast('Teks Bar Kop Surat berhasil diperbarui!');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= MODAL MENU UPLOAD LOGO OSIS / OSIM ================= */}
      {showUploadOsisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-amber-500/10 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Menu Upload Logo {school.type}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kustomisasi lambang resmi {school.type} di pojok kanan kop surat SK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadOsisModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Preview Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Pratinjau Lambang {school.type} Saat Ini:
                </span>
                <div className="w-20 h-20 rounded-full border-2 border-slate-800 bg-white flex items-center justify-center p-1 shadow-md overflow-hidden">
                  {osisLogoUrl ? (
                    <img src={osisLogoUrl} alt={`Logo ${school.type}`} className="w-full h-full object-contain" />
                  ) : (
                    <OsisLogoBadge size={72} type={school.type} />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {osisLogoUrl ? `Logo Kustom ${school.type} Aktif` : `Menggunakan Lambang Resmi Standar (${school.type})`}
                </div>
              </div>

              {/* OPSI 1: UPLOAD FILE GAMBAR (KOMPUTER / HP) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Opsi 1: Unggah File Logo (Mendukung Semua Format Gambar: PNG, JPG, JPEG, WEBP, SVG, GIF, AVIF, HEIC, BMP)
                </label>
                <label className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="image/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.tiff,.avif,.heic,.heif"
                    onChange={handleUploadOsisFile}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-purple-900">
                    {isUploadingOsis ? 'Sedang memproses logo...' : `Klik atau Tarik File Logo ${school.type} ke Sini`}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Maksimal 10MB · Mendukung PNG, JPG, SVG, WEBP, GIF, AVIF, HEIC, HEIF, BMP, ICO
                  </span>
                </label>
              </div>

              {/* OPSI 2: PRESET LOGO RESMI NASIONAL */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800">
                  Opsi 2: Pilih Lambang Standar Resmi Nasional
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOsisLogoUrl('');
                      setOsisUrlInput('');
                      electionStore.updateSchool({ osisLogoUrl: '', type: 'OSIS' });
                      showToast('Menggunakan Lambang Resmi OSIS Kemendikbud!');
                    }}
                    className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 text-left flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <OsisLogoBadge size={32} type="OSIS" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-amber-900">OSIS Nasional</p>
                      <p className="text-[10px] text-slate-500">Kemendikbudristek</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOsisLogoUrl('');
                      setOsisUrlInput('');
                      electionStore.updateSchool({ osisLogoUrl: '', type: 'OSIM' });
                      showToast('Menggunakan Lambang Resmi OSIM Kemenag!');
                    }}
                    className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-left flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <OsisLogoBadge size={32} type="OSIM" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-900">OSIM Madrasah</p>
                      <p className="text-[10px] text-slate-500">Kementerian Agama</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* OPSI 3: TAUTAN URL GAMBAR */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800">
                  Opsi 3: Masukkan Tautan / URL Logo Online
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={osisUrlInput}
                    onChange={(e) => setOsisUrlInput(e.target.value)}
                    placeholder="https://example.com/logo-osis.png"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyOsisUrl(osisUrlInput)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Pasang URL
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {osisLogoUrl ? (
                <button
                  type="button"
                  onClick={handleResetOsisLogo}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Logo Kustom</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Lambang standar aktif</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadOsisModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadOsisModal(false);
                    showToast(`Logo ${school.type} berhasil diterapkan!`);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Selesai & Terapkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================= MODAL MENU PENGATURAN UKURAN & POSISI LOGO ================= */}
      {showLogoSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    Pengaturan Ukuran & Posisi Logo Kop Surat
                  </h3>
                  <p className="text-xs text-purple-100">
                    Masukan angka ukuran atau tarik langsung handles di pratinjau lembar SK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoSizeModal(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* MENU SAVE UKURAN LOGO KOP BAR */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                      <Save className="w-3 h-3" />
                      <span>Menu Save Ukuran Logo Kop</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isLogoSizeSaved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {isLogoSizeSaved ? '✓ Tersimpan Permanen' : '● Perubahan Belum Disimpan'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Simpan ukuran & posisi Logo Kop agar tetap tersimpan saat halaman dimuat ulang atau dicetak.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveLogoSize(false)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Ukuran Logo Kop</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomLogoPresetSlot}
                    className="px-2.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Simpan ukuran saat ini sebagai Preset Favorit"
                  >
                    Simpan Preset
                  </button>
                  {hasCustomLogoPreset && (
                    <button
                      type="button"
                      onClick={handleLoadCustomLogoPresetSlot}
                      className="px-2.5 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Muat ukuran dari Preset Favorit yang disimpan"
                    >
                      Muat Preset
                    </button>
                  )}
                </div>
              </div>

              {/* Petunjuk Cara 2: Tarik & Susun Langsung */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                  <Move className="w-4 h-4" />
                </div>
                <div className="text-xs text-amber-950 space-y-1">
                  <span className="font-bold block text-amber-900">
                    💡 2 Cara Pengaturan Ukuran & Posisi Logo:
                  </span>
                  <p className="leading-relaxed text-[11px]">
                    <strong>1. Masukan Ukuran (Form Angka):</strong> Isi angka lebar, tinggi, dan offset X/Y di bawah atau klik tombol preset rasio (2x3, 3x4, 1x1), lalu klik <strong>Simpan Ukuran Logo Kop</strong>.<br />
                    <strong>2. Tarik & Susun Langsung pada Gambar:</strong> Arahkan kursor ke logo di pratinjau surat. Tarik ikon sudut kanan bawah (<strong>↘</strong>) untuk mengubah ukuran, atau klik tombol <strong>Save</strong> di bawah logo!
                  </p>
                </div>
              </div>

              {/* GRID: LOGO SEKOLAH (KIRI) vs LOGO OSIS (KANAN) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. LOGO SEKOLAH (KIRI) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        1. Logo Sekolah (Sisi Kiri)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      {schoolLogoWidth} x {schoolLogoHeight} px
                    </span>
                  </div>

                  {/* Menu Edit Gambar Logo Sekolah (Kiri) */}
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                        {schoolLogoUrl ? (
                          <img src={schoolLogoUrl} alt="Logo Sekolah" className="w-full h-full object-contain" />
                        ) : (
                          <SchoolCrestLogo size={28} type={school.type} />
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Edit Gambar Logo Kiri</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*,.png,.jpg,.jpeg,.svg,.webp"
                          onChange={handleUploadSchoolLogoFile}
                          className="hidden"
                        />
                      </label>
                      {schoolLogoUrl && (
                        <button
                          type="button"
                          onClick={handleResetSchoolLogo}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Reset Logo Sekolah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preset Chips */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Preset Ukuran Cepat:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('school', '2x3')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 cursor-pointer transition-colors"
                      >
                        2x3 (52x78px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('school', '3x4')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                      >
                        3x4 (54x72px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('school', '1x1')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                      >
                        1x1 (60x60px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('school', 'reset')}
                        className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Input Dimensions */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Lebar (Width px)</label>
                      <input
                        type="number"
                        min={20}
                        max={200}
                        value={schoolLogoWidth}
                        onChange={(e) => setSchoolLogoWidth(Math.max(20, parseInt(e.target.value) || 20))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tinggi (Height px)</label>
                      <input
                        type="number"
                        min={20}
                        max={300}
                        value={schoolLogoHeight}
                        onChange={(e) => setSchoolLogoHeight(Math.max(20, parseInt(e.target.value) || 20))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                  </div>

                  {/* Input Offsets (Geser Posisi) */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Geser Posisi Presisi (Offset X / Y):
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Geser Horisontal (X)</label>
                        <input
                          type="number"
                          value={schoolLogoOffsetX}
                          onChange={(e) => setSchoolLogoOffsetX(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1 text-xs rounded-xl border border-slate-300 font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Geser Vertikal (Y)</label>
                        <input
                          type="number"
                          value={schoolLogoOffsetY}
                          onChange={(e) => setSchoolLogoOffsetY(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1 text-xs rounded-xl border border-slate-300 font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. LOGO OSIS / OSIM (KANAN) */}
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        2. Logo {school.type} (Sisi Kanan)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-700">
                      {osisLogoWidth} x {osisLogoHeight} px
                    </span>
                  </div>

                  {/* Menu Edit Gambar Logo OSIS (Kanan) */}
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-purple-200 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                        {osisLogoUrl ? (
                          <img src={osisLogoUrl} alt={`Logo ${school.type}`} className="w-full h-full object-contain" />
                        ) : (
                          <OsisLogoBadge size={28} type={school.type} />
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Edit Gambar Logo Kanan</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowUploadOsisModal(true)}
                        className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit / Upload</span>
                      </button>
                    </div>
                  </div>

                  {/* Preset Chips */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Preset Ukuran Cepat:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('osis', '2x3')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-purple-300 bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-colors"
                      >
                        2x3 (52x78px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('osis', '3x4')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                      >
                        3x4 (54x72px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('osis', '1x1')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                      >
                        1x1 (60x60px)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyLogoPreset('osis', 'reset')}
                        className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Input Dimensions */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Lebar (Width px)</label>
                      <input
                        type="number"
                        min={20}
                        max={200}
                        value={osisLogoWidth}
                        onChange={(e) => setOsisLogoWidth(Math.max(20, parseInt(e.target.value) || 20))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tinggi (Height px)</label>
                      <input
                        type="number"
                        min={20}
                        max={300}
                        value={osisLogoHeight}
                        onChange={(e) => setOsisLogoHeight(Math.max(20, parseInt(e.target.value) || 20))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                  </div>

                  {/* Input Offsets (Geser Posisi) */}
                  <div className="pt-2 border-t border-purple-200/80">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Geser Posisi Presisi (Offset X / Y):
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Geser Horisontal (X)</label>
                        <input
                          type="number"
                          value={osisLogoOffsetX}
                          onChange={(e) => setOsisLogoOffsetX(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1 text-xs rounded-xl border border-slate-300 font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Geser Vertikal (Y)</label>
                        <input
                          type="number"
                          value={osisLogoOffsetY}
                          onChange={(e) => setOsisLogoOffsetY(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1 text-xs rounded-xl border border-slate-300 font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  applyLogoPreset('school', 'reset');
                  applyLogoPreset('osis', 'reset');
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Reset Seluruh Ukuran Logo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoSizeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveLogoSize(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Selesai & Simpan Ukuran</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL MENU EDIT STEMPEL, TANDA TANGAN & PENGESAHAN ================= */}
      {showEditStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 via-indigo-600 to-sky-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">
                    Menu Edit Stempel, Tanda Tangan & Pengesahan SK
                  </h3>
                  <p className="text-xs text-purple-100">
                    Sesuaikan teks stempel kedinasan, ukuran/posisi stempel, dan data pejabat pengesah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditStampModal(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Preset Stempel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Preset Cepat Stempel Resmi (1-Klik):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '★ Pemerintah Daerah', h: '★ PEMERINTAH ★', f: 'KEPALA SEKOLAH', c: 'purple' as const },
                    { label: '★ Kementerian Agama', h: '★ KEMENTERIAN AGAMA ★', f: 'KEPALA MADRASAH', c: 'emerald' as const },
                    { label: '★ Yayasan Pendidikan', h: '★ YAYASAN PENDIDIKAN ★', f: 'KEPALA SATUAN PENDIDIKAN', c: 'blue' as const },
                    { label: '★ Komisi Pemilihan OSIS', h: '★ KOMISI PEMILIHAN ★', f: `PANITIA ${school.type}`, c: 'rose' as const },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setStampHeaderText(p.h);
                        setStampFooterText(p.f);
                        setStampColorTheme(p.c);
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Teks & Ukuran Stempel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    1. Teks & Warna Stempel Kedinasan
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Baris Atas Stempel</label>
                    <input
                      type="text"
                      value={stampHeaderText}
                      onChange={(e) => setStampHeaderText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold uppercase text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Baris Tengah (Nama Instansi/Sekolah)</label>
                    <input
                      type="text"
                      value={stampInstitutionText}
                      onChange={(e) => setStampInstitutionText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold uppercase text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Baris Bawah Stempel</label>
                    <input
                      type="text"
                      value={stampFooterText}
                      onChange={(e) => setStampFooterText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold uppercase text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Warna Tinta Stempel</label>
                    <select
                      value={stampColorTheme}
                      onChange={(e) => setStampColorTheme(e.target.value as OfficialStampConfig['colorTheme'])}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 bg-white cursor-pointer"
                    >
                      <option value="purple">Ungu Kedinasan (Standar)</option>
                      <option value="blue">Biru Resmi Instansi</option>
                      <option value="emerald">Hijau Kementerian / Madrasah</option>
                      <option value="rose">Merah Marun</option>
                      <option value="slate">Hitam Formal</option>
                    </select>
                  </div>
                </div>

                {/* Ukuran, Posisi & Pejabat Pengesah */}
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    2. Ukuran Stempel & Pejabat Pengesah
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Ukuran Stempel (px)</label>
                      <input
                        type="number"
                        min={64}
                        max={150}
                        value={stampSizePx}
                        onChange={(e) => setStampSizePx(Math.max(64, Math.min(150, parseInt(e.target.value) || 96)))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Rotasi Stempel (°)</label>
                      <input
                        type="number"
                        min={-45}
                        max={45}
                        value={stampRotationDeg}
                        onChange={(e) => setStampRotationDeg(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Jabatan Pengesah</label>
                    <input
                      type="text"
                      value={signatoryTitle}
                      onChange={(e) => setSignatoryTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold uppercase text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Kepala Sekolah & Gelar</label>
                    <input
                      type="text"
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                      <input
                        type="text"
                        value={principalNip}
                        onChange={(e) => setPrincipalNip(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Kota Penetapan</label>
                      <input
                        type="text"
                        value={skCity}
                        onChange={(e) => setSkCity(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetStampConfig}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Reset Stempel Baku
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditStampModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveStampAndSignee(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};


