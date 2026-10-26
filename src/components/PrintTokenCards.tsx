/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Printable Voter Token Cards Template
 * Formatted for A4 / Letter paper with dashed cut lines, QR simulation,
 * school crest header, large legible PIN tokens, and isolated preview menu.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SchoolConfig, ElectionPeriod, Voter } from '../types';
import { SchoolCrestLogo } from './CandidateAvatar';
import { Printer, X, Eye, ZoomIn, ZoomOut, Ticket, Maximize2, Minimize2 } from 'lucide-react';
import { clampZoomScale } from '../utils/printIsolation';

interface PrintTokenCardsProps {
  school: SchoolConfig;
  period: ElectionPeriod;
  voters: Voter[];
  onClose: () => void;
}

export const PrintTokenCards: React.FC<PrintTokenCardsProps> = ({
  school,
  period,
  voters,
  onClose,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [onlyDocumentMode, setOnlyDocumentMode] = useState<boolean>(false);

  // Isolate preview & print from all other DOM objects (#root, canvas, navbar)
  useEffect(() => {
    document.body.classList.add('print-preview-open');
    return () => {
      document.body.classList.remove('print-preview-open');
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="print-portal-root fixed inset-0 z-[9999] overflow-y-auto bg-slate-900 p-2 sm:p-4 md:p-8 print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Minimal Floating Restore Bar when in Pure Document Preview Mode */}
      {onlyDocumentMode && (
        <div className="no-print fixed bottom-5 right-5 z-[10000] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => setOnlyDocumentMode(false)}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
            <span>Tampilkan Menu Preview</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-xl cursor-pointer"
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

      {/* Top Floating Preview & Print Toolbar (Hidden in Print & Pure Document Mode) */}
      {!onlyDocumentMode && (
        <div className="no-print max-w-5xl mx-auto mb-6 bg-white/95 backdrop-blur-xl rounded-3xl p-4 md:p-5 shadow-2xl border border-slate-200 sticky top-2 z-40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30 shrink-0">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-100/90 border border-sky-200 px-2.5 py-0.5 rounded-full">
                    Menu Preview Sebelum Cetak
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {voters.length} Kartu Pemilih · Bebas Objek Lain
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                  Pratinjau Lembar Kartu Token Pemilih Siap Potong
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setOnlyDocumentMode(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Sembunyikan menu ini dan tampilkan murni kertas dokumen"
              >
                <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Layar Murni Dokumen</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all transform hover:scale-102 active:scale-98 cursor-pointer"
                title="Cetak murni lembar kartu token tanpa elemen web"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Kartu (Print / PDF)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl glass-button text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Zoom & Cut Line Controls Bar */}
          <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>Skala Pratinjau:</span>
              </span>
              <div className="flex items-center gap-1 bg-white/80 border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setZoomScale(clampZoomScale(zoomScale - 10))}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold px-2 text-slate-800 min-w-[42px] text-center">
                  {zoomScale}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(clampZoomScale(zoomScale + 10))}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(100)}
                  className="px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 rounded hover:bg-sky-100 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showCutLines}
                onChange={(e) => setShowCutLines(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span>Tampilkan Garis Putus-Putus Potong Kartu</span>
            </label>
          </div>
        </div>
      )}

      {/* Printable Sheet Container */}
      <div 
        className="print-scale-wrapper max-w-5xl mx-auto transition-transform duration-200 origin-top pb-12 print:pb-0"
        style={{ transform: zoomScale !== 100 ? `scale(${zoomScale / 100})` : 'none' }}
      >
        <div className="print-document-sheet bg-white p-6 md:p-10 rounded-none sm:rounded-lg shadow-2xl border border-slate-300 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none">
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
            {voters.map((voter) => (
              <div
                key={voter.id}
                className={`${
                  showCutLines ? 'border-2 border-dashed border-slate-400' : 'border border-slate-300'
                } rounded-xl p-4 flex flex-col justify-between bg-white relative print:break-inside-avoid print:page-break-inside-avoid print-avoid-break`}
                style={{ minHeight: '220px' }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <SchoolCrestLogo size={28} type={school.type} logoUrl={school.logoUrl} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-900 leading-tight">
                        {school.name}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        KARTU SUARA & TOKEN PEMILIH · {period.academicYear}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                    {voter.className}
                  </span>
                </div>

                {/* Card Center: Student Identity & PIN Token */}
                <div className="grid grid-cols-12 gap-3 my-2 items-center">
                  <div className="col-span-8 space-y-1">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Nama Siswa</span>
                      <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                        {voter.fullName}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">NISN</span>
                        <p className="text-xs font-mono font-bold text-slate-800">
                          {voter.nisn}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">JK</span>
                        <p className="text-xs font-semibold text-slate-800">
                          {voter.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col items-center justify-center p-1 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="w-16 h-16 bg-white p-1 rounded border border-slate-200 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-full h-full text-slate-800 fill-current">
                        <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm8-2h2v2h-2v-2zm4 0h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 2h2v2h-2v-2zm-4 2h2v2h-2v-2zm4 2h4v2h-4v-2zm4-4h2v2h-2v-2z" />
                      </svg>
                    </div>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5 text-center">
                      LOGIN CEPAT
                    </span>
                  </div>
                </div>

                {/* Bottom: Large Monospace PIN Token Box */}
                <div className="mt-1 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">
                      TOKEN PIN RAHASIA:
                    </span>
                    <div className="text-lg font-black tracking-widest text-slate-950 font-mono bg-amber-50 px-3 py-0.5 rounded border border-amber-300 inline-block ml-2">
                      {voter.pinPlain || '******'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-slate-400 block">Gunakan di Bilik Suara</span>
                    <span className="text-[8px] text-rose-600 font-semibold block">Hanya 1 Kali Pakai</span>
                  </div>
                </div>

                {/* Scissors cut indicator */}
                {showCutLines && (
                  <div className="no-print absolute -top-2.5 -right-2.5 bg-white px-1 text-slate-400 text-[9px] print:hidden">
                    ✂ Potong
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
