/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Official Berita Acara Hasil Pemilihan (BAHP) Printable Template
 * Standardized legal minutes with institutional letterhead, decree references,
 * recapitulation table, elected candidate declaration, signature certification,
 * and comprehensive preview & print settings toolbar.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SchoolConfig, ElectionSummary, CommitteeMember } from '../types';
import { Printer, X, ShieldCheck, Eye, ZoomIn, ZoomOut, Check, Sliders, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { SchoolCrestLogo } from './CandidateAvatar';
import { clampZoomScale, formatOfficialBahpNumber } from '../utils/printIsolation';

interface PrintBeritaAcaraProps {
  school: SchoolConfig;
  summary: ElectionSummary;
  committee: CommitteeMember[];
  onClose: () => void;
}

export const PrintBeritaAcara: React.FC<PrintBeritaAcaraProps> = ({
  school,
  summary,
  committee,
  onClose,
}) => {
  const { period, totalVoters, totalVoted, totalUnvoted, participationPercentage, candidatesResults } = summary;

  // Interactive Document Preview Options State
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [showStamp, setShowStamp] = useState<boolean>(true);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [onlyDocumentMode, setOnlyDocumentMode] = useState<boolean>(false);

  useEffect(() => {
    document.body.classList.add('print-preview-open');
    return () => {
      document.body.classList.remove('print-preview-open');
    };
  }, []);

  // Find winner
  const sortedCandidates = [...candidatesResults].sort((a, b) => b.voteCount - a.voteCount);
  const elected = sortedCandidates[0];

  const chairmanCommittee = committee.find((c) => c.role === 'Ketua Panitia') || {
    memberName: 'Dimas Arya Pratama',
    skNumber: '035/SK-KS/SMPN1/VIII/2026',
    skDate: '2026-08-15',
  };

  const handlePrint = () => {
    window.print();
  };

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return createPortal(
    <div className="print-portal-root fixed inset-0 z-[9999] overflow-y-auto bg-slate-200 p-2 sm:p-4 md:p-8 print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Floating Mini Restore Bar when in "Hanya Dokumen" full preview mode */}
      {onlyDocumentMode && (
        <div className="no-print fixed top-4 right-4 z-[10000] flex items-center gap-2 bg-slate-900/90 text-white px-3.5 py-2 rounded-2xl shadow-xl border border-white/20 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOnlyDocumentMode(false)}
            className="text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Tampilkan Menu Preview</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="text-xs font-black flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Tutup Pratinjau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= TOP FLOATING PREVIEW SEBELUM CETAK TOOLBAR (NO-PRINT) ================= */}
      {!onlyDocumentMode && (
        <div className="no-print max-w-4xl mx-auto mb-6 bg-white rounded-3xl p-4 md:p-5 shadow-xl border border-slate-300 sticky top-2 z-40 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Document Identity */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30 shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                    Menu Preview Sebelum Cetak
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    Murni Dokumen A4 · Tanpa Objek Lain
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                  Pratinjau Berita Acara Hasil Pemilihan (BAHP)
                </h2>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Toggle Pure Document-Only Screen Mode */}
              <button
                type="button"
                onClick={() => setOnlyDocumentMode(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all cursor-pointer"
                title="Sembunyikan panel menu agar layar 100% hanya menampilkan kertas dokumen"
              >
                <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Layar Murni Dokumen</span>
              </button>

              {/* Toggle Options Panel */}
              <button
                type="button"
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showSettingsPanel 
                    ? 'bg-sky-600 text-white shadow-sm' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
                title="Pengaturan Tampilan Pratinjau Dokumen"
              >
                <Sliders className="w-4 h-4" />
                <span>Setelan Cetak</span>
              </button>

              {/* Print Action */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all transform hover:scale-102 active:scale-98 cursor-pointer"
                title="Mencetak murni dokumen Berita Acara tanpa tampilan web"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Dokumen / PDF</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-300 transition-colors cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Dynamic Zoom & Feature Control Bar */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>Skala Pratinjau:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setZoomScale(clampZoomScale(zoomScale - 10))}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Perkecil Pratinjau"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold px-2 text-slate-800 min-w-[42px] text-center">
                  {zoomScale}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(clampZoomScale(zoomScale + 10))}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Perbesar Pratinjau"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(100)}
                  className="px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 rounded hover:bg-sky-100 cursor-pointer"
                >
                  Reset (100%)
                </button>
              </div>
            </div>

            {/* Document Toggles Strip */}
            <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStamp}
                  onChange={(e) => setShowStamp(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Stempel & TTD Digital</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Watermark Dokumen Asli</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>QR Code Otentikasi</span>
              </label>
            </div>
          </div>

          {/* Expanded Settings Sub-Panel */}
          {showSettingsPanel && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-sky-50/70 p-3 rounded-2xl border border-sky-200">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Isolasi Cetak Murni: Hanya Kertas Dokumen A4 Tanpa Objek Lain</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Terintegrasi Kode QR Verifikasi SHA-256 KPU/OSIS</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Siap Cetak Printer Langsung atau Save as PDF A4</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= OFFICIAL LEGAL DOCUMENT PAPER (A4 STANDARD) ================= */}
      <div 
        className="print-scale-wrapper max-w-4xl mx-auto transition-transform duration-200 origin-top pb-12 print:pb-0"
        style={{ transform: zoomScale !== 100 ? `scale(${zoomScale / 100})` : 'none' }}
      >
        <div className="print-document-sheet bg-white p-8 md:p-14 rounded-none sm:rounded-lg shadow-2xl border border-slate-300 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none text-slate-900 font-serif leading-relaxed relative">
          
          {/* Watermark Option */}
          {showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
              <span className="text-8xl font-black font-sans uppercase text-slate-200/50 transform -rotate-45 tracking-widest">
                DOKUMEN ASLI
              </span>
            </div>
          )}

          {/* Institutional Letterhead (KOP SURAT) */}
          <div className="border-b-4 border-double border-slate-900 pb-4 text-center relative flex items-center justify-between">
            <div className="w-20 flex-shrink-0 flex justify-center">
              <SchoolCrestLogo size={64} type={school.type} logoUrl={school.logoUrl} />
            </div>
            <div className="flex-1 px-4">
              <p className="text-xs uppercase font-sans tracking-widest text-slate-600 font-semibold">
                PEMERINTAH PROVINSI {school.province.toUpperCase()}
              </p>
              <p className="text-xs uppercase font-sans tracking-widest text-slate-600 font-semibold">
                DINAS PENDIDIKAN DAN KEBUDAYAAN
              </p>
              <h1 className="text-xl md:text-2xl font-bold font-sans uppercase tracking-tight text-slate-900 mt-0.5">
                {school.name}
              </h1>
              <p className="text-xs font-sans text-slate-600 mt-1">
                Alamat: {school.address}, {school.city} · NPSN: {school.npsn} · Telp: {school.phone}
              </p>
              <p className="text-xs font-sans text-slate-500">
                Laman Resmi: {school.website}
              </p>
            </div>
            <div className="w-20 flex-shrink-0 flex justify-center">
              {showQrCode && (
                <div className="p-1 border border-slate-300 rounded bg-slate-50 text-center">
                  <svg viewBox="0 0 24 24" className="w-12 h-12 text-slate-800 fill-current mx-auto">
                    <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm8-2h2v2h-2v-2zm4 0h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 2h2v2h-2v-2zm-4 2h2v2h-2v-2zm4 2h4v2h-4v-2zm4-4h2v2h-2v-2z" />
                  </svg>
                  <span className="text-[7px] font-mono font-bold text-slate-500 block mt-0.5">VERIFIED</span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6 space-y-1 font-sans">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 underline underline-offset-4">
              BERITA ACARA HASIL PEMILIHAN UMUM (BAHP)
            </h2>
            <p className="text-xs font-semibold text-slate-700">
              KETUA DAN WAKIL KETUA {school.type} PERIODE {period.academicYear}
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              Nomor: {formatOfficialBahpNumber(school.type)}
            </p>
          </div>

          {/* Preamble */}
          <div className="text-xs space-y-3 font-sans text-justify text-slate-800 leading-normal">
            <p>
              Pada hari ini, <strong>{todayFormatted}</strong>, bertempat di Kampus {school.name}, 
              telah dilaksanakan pemungutan dan penghitungan suara secara elektronik (E-Voting) dalam rangka 
              <strong> {period.periodName}</strong> berdasarkan Surat Keputusan Kepala Sekolah Nomor: 
              <strong> {chairmanCommittee.skNumber}</strong> tertanggal {chairmanCommittee.skDate}.
            </p>

            <p>
              Pelaksanaan pemungutan suara diselenggarakan secara tertib, aman, dan lancar dengan berpedoman teguh pada 
              asas <strong>Langsung, Umum, Bebas, Rahasia, Jujur, dan Adil (LUBER & JURDIL)</strong>{' '}
              menggunakan sistem integritas data elektronik terenkripsi.
            </p>
          </div>

          {/* Section 1: Data Pemilih & Partisipasi */}
          <div className="my-5 font-sans space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              I. REKAPITULASI DAFTAR PEMILIH & TINGKAT KEHADIRAN
            </h3>
            <table className="w-full text-xs border border-slate-300">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2 w-1/2 bg-slate-50 font-medium">1. Jumlah Siswa Terdaftar (Daftar Pemilih Tetap / DPT)</td>
                  <td className="p-2 font-bold font-mono text-right">{totalVoters} Orang</td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 font-medium">2. Jumlah Suara Sah Masuk (Telah Menggunakan Hak Pilih)</td>
                  <td className="p-2 font-bold font-mono text-right text-emerald-700">{totalVoted} Suara ({participationPercentage}%)</td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 font-medium">3. Jumlah Pemilih yang Tidak Hadir / Abstain</td>
                  <td className="p-2 font-bold font-mono text-right text-slate-600">{totalUnvoted} Orang ({Number((100 - participationPercentage).toFixed(2))}%)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Hasil Perolehan Suara */}
          <div className="my-5 font-sans space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              II. PEROLEHAN SUARA MASING-MASING PASANGAN CALON
            </h3>
            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                <tr>
                  <th className="p-2 w-12 text-center">No</th>
                  <th className="p-2">Pasangan Calon Ketua & Wakil Ketua</th>
                  <th className="p-2 text-center">Kelas</th>
                  <th className="p-2 text-right">Perolehan Suara</th>
                  <th className="p-2 text-right">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {candidatesResults.map((res) => (
                  <tr key={res.candidate.id} className={res.candidate.id === elected?.candidate.id ? 'bg-sky-50/60 font-semibold' : ''}>
                    <td className="p-2 text-center font-bold font-mono">{res.candidate.ballotNumber}</td>
                    <td className="p-2">
                      <span className="font-bold text-slate-900">{res.candidate.chairmanName}</span> & {res.candidate.viceChairmanName}
                    </td>
                    <td className="p-2 text-center text-slate-600">
                      {res.candidate.chairmanClass} & {res.candidate.viceChairmanClass}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">{res.voteCount} Suara</td>
                    <td className="p-2 text-right font-mono font-bold text-sky-700">{res.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Penetapan Pemenang */}
          {elected && (
            <div className="print-avoid-break my-5 p-4 rounded-xl border border-slate-300 bg-slate-50 font-sans text-xs space-y-2">
              <h3 className="font-bold uppercase tracking-wider text-slate-900">
                III. KEPUTUSAN PENETAPAN PASANGAN CALON TERPILIH
              </h3>
              <p className="leading-relaxed">
                Berdasarkan hasil rekapitulasi penghitungan suara di atas, Panitia Pemilihan menetapkan bahwa Pasangan Calon dengan 
                <strong> Nomor Urut {elected.candidate.ballotNumber}</strong> atas nama:
              </p>
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold text-center text-sm">
                {elected.candidate.chairmanName} (Ketua) & {elected.candidate.viceChairmanName} (Wakil Ketua)
              </div>
              <p className="leading-relaxed">
                Dinyatakan secara sah sebagai <strong>Ketua dan Wakil Ketua {school.type} {school.name} Terpilih Periode {period.academicYear}</strong>{' '}
                dan berhak untuk dilantik serta disahkan oleh Kepala Sekolah sesuai peraturan perundang-undangan yang berlaku.
              </p>
            </div>
          )}

          {/* Closing Preamble */}
          <p className="text-xs font-sans text-justify text-slate-700 mt-4 leading-normal">
            Demikian Berita Acara ini dibuat dan ditandatangani dengan sebenarnya dalam rangkap 3 (tiga) untuk dipergunakan 
            sebagaimana mestinya, masing-masing untuk Arsip Sekolah, Pembina OSIS, dan Panitia Pemilihan.
          </p>

          {/* Signatures Section */}
          <div className="print-avoid-break mt-8 pt-4 grid grid-cols-2 gap-8 font-sans text-xs text-center">
            {/* Committee Chairman */}
            <div className="flex flex-col items-center justify-between min-h-[140px]">
              <div>
                <p className="text-slate-500">Mengetahui & Menetapkan,</p>
                <p className="font-bold text-slate-900 mt-0.5">Ketua Panitia Pemilihan</p>
              </div>

              {/* Digital Stamp / Signature Simulation */}
              {showStamp && (
                <div className="my-2 px-3 py-1 border border-dashed border-sky-400 bg-sky-50/50 rounded text-[10px] text-sky-700 font-mono">
                  [TERVERIFIKASI DIGITAL E-PILKETOS]
                </div>
              )}

              <div>
                <p className="font-bold text-slate-900 underline underline-offset-2">
                  {chairmanCommittee.memberName}
                </p>
                <p className="text-[11px] text-slate-500">NISN / Identitas Panitia Siswa</p>
              </div>
            </div>

            {/* Principal */}
            <div className="flex flex-col items-center justify-between min-h-[140px]">
              <div>
                <p className="text-slate-500">{school.city}, {todayFormatted}</p>
                <p className="font-bold text-slate-900 mt-0.5">Kepala Sekolah {school.name}</p>
              </div>

              {/* Digital Stamp Simulation */}
              {showStamp && (
                <div className="my-2 px-3 py-1 border border-dashed border-emerald-400 bg-emerald-50/50 rounded text-[10px] text-emerald-700 font-mono">
                  [TERTANDATANGANI & TERSTEMPEL RESMI]
                </div>
              )}

              <div>
                <p className="font-bold text-slate-900 underline underline-offset-2">
                  {school.principalName}
                </p>
                <p className="text-[11px] text-slate-500">NIP. {school.principalNip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

