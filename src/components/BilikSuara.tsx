/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bilik Suara Digital (Student Voting Booth)
 * Conforms to LUBER-JURDIL with atomic anonymous ballot casting,
 * modal confirmation, Framer Motion celebratory success animations,
 * and 5-second automatic countdown logout.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { safeConfetti as confetti } from '../utils/confettiHelper';
import { 
  Vote, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, 
  ArrowRight, Check, X, Sparkles, RefreshCw, LogOut, Info, Clock
} from 'lucide-react';
import { SchoolConfig, Candidate, Voter, ElectionPeriod, RealtimeSyncMetadata } from '../types';
import { electionStore } from '../lib/store';
import { CandidateAvatar, SchoolCrestLogo } from './CandidateAvatar';
import { CandidateVideoDisplay } from './CandidateVideoDisplay';
import { formatAppTimeDisplay } from '../lib/realtimeSync';

interface BilikSuaraProps {
  school: SchoolConfig;
  appTimeMs: number;
  syncMeta: RealtimeSyncMetadata;
  onExitBooth: () => void;
}

type BoothStep = 'AUTH' | 'BALLOT' | 'CONFIRM' | 'SUCCESS';

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'star';
}

export const BilikSuara: React.FC<BilikSuaraProps> = ({ school, appTimeMs, syncMeta, onExitBooth }) => {
  const [step, setStep] = useState<BoothStep>('AUTH');
  const [nisn, setNisn] = useState('');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authenticatedVoter, setAuthenticatedVoter] = useState<Voter | null>(null);
  const [activePeriod, setActivePeriod] = useState<ElectionPeriod>(() => electionStore.getActivePeriod());
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    electionStore.getCandidates(electionStore.getActivePeriod().id)
  );
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [receiptCode, setReceiptCode] = useState('');
  const [countdown, setCountdown] = useState(5);

  const formattedClock = formatAppTimeDisplay(appTimeMs);

  // Subscribe to real-time updates from Admin/Panitia so candidates & activePeriod stay live in Bilik Suara
  useEffect(() => {
    const syncBoothData = () => {
      const period = electionStore.getActivePeriod();
      const latestCandidates = electionStore.getCandidates(period.id);
      setActivePeriod(period);
      setCandidates(latestCandidates);
      setSelectedCandidate((prev) =>
        prev ? latestCandidates.find((c) => c.id === prev.id) || prev : null
      );
      setPreviewCandidate((prev) =>
        prev ? latestCandidates.find((c) => c.id === prev.id) || null : null
      );
    };

    syncBoothData();
    const unsubscribe = electionStore.subscribe(syncBoothData);
    return () => unsubscribe();
  }, []);

  // 5-second countdown timer on SUCCESS screen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'SUCCESS' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (step === 'SUCCESS' && countdown === 0) {
      handleResetBooth();
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Generate subtle random Framer Motion confetti particles on vote completion
  const confettiParticles = useMemo<ConfettiParticle[]>(() => {
    if (step !== 'SUCCESS') return [];
    const colors = ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#38bdf8'];
    const shapes: ('circle' | 'square' | 'star')[] = ['circle', 'square', 'star'];
    return Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * 360 + (Math.random() * 20 - 10);
      const distance = 120 + Math.random() * 180;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance + 60, // slight downward bias
        rotation: Math.random() * 720 - 360,
        color: colors[i % colors.length],
        size: 8 + Math.random() * 8,
        shape: shapes[i % shapes.length],
      };
    });
  }, [step]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const res = electionStore.verifyVoterLogin(nisn, pin);
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setAuthenticatedVoter(res.voter!);
    setActivePeriod(res.activePeriod!);
    setStep('BALLOT');
  };

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setStep('CONFIRM');
  };

  const handleConfirmVote = () => {
    if (!authenticatedVoter || !selectedCandidate) return;

    const res = electionStore.submitAnonymousVote(authenticatedVoter.id, selectedCandidate.id);
    if (!res.success) {
      setErrorMessage(res.message);
      setStep('BALLOT');
      return;
    }

    setReceiptCode(res.receiptCode || 'VERIFIED');
    setStep('SUCCESS');
    setCountdown(5);

    // Trigger celebratory canvas-confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Fallback
    }
  };

  const handleResetBooth = () => {
    setStep('AUTH');
    setNisn('');
    setPin('');
    setErrorMessage('');
    setAuthenticatedVoter(null);
    setSelectedCandidate(null);
    setReceiptCode('');
    setCountdown(5);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 relative">
      {/* Booth Top Header in Frosted Glass */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-panel border border-white/80 rounded-2xl px-6 py-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <SchoolCrestLogo size={36} type={school.type} logoUrl={school.logoUrl} className="shadow-xs" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
              Bilik Suara Digital (E-Voting Kiosk)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {school.name} · {activePeriod?.periodName} · Rev #{syncMeta.revision}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-mono font-bold shadow-xs">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>{formattedClock.timeString} WIB</span>
          </div>
          <button
            onClick={onExitBooth}
            className="text-xs font-bold text-slate-700 glass-button hover:text-slate-900 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Kembali ke Beranda</span>
          </button>
        </div>
      </div>

      {/* STEP 1: AUTHENTICATION */}
      {step === 'AUTH' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Instructions Card (5 cols) in Dark Frosted Glass */}
          <div className="md:col-span-5 rounded-3xl glass-dark text-white p-7 shadow-2xl flex flex-col justify-between border border-white/15 relative overflow-hidden">
            {/* Ambient Refraction inside Card */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Asas LUBER-JURDIL</span>
              </div>
              <h1 className="text-xl font-extrabold leading-snug tracking-tight">
                Selamat Datang di Bilik Suara Siswa
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Silakan masukkan <strong>NISN 10 digit</strong> dan <strong>Token PIN 6 karakter</strong> yang tercetak pada Kartu Suara Anda dari Meja Panitia Pemilihan.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-extrabold text-sky-400">1</span>
                  <span>Setiap siswa hanya memiliki 1 (satu) kali hak suara sah.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold text-sky-400">2</span>
                  <span>Pilihan Anda dijamin rahasia dan tidak terhubung dengan identitas pemilih.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold text-sky-400">3</span>
                  <span>Token PIN akan hangus seketika setelah suara Anda dicoblos.</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 border-t border-white/10 text-[11px] text-slate-400">
              Butuh bantuan? Hubungi panitia bilik terdekat jika kartu suara hilang atau PIN bermasalah.
            </div>
          </div>

          {/* Form Card (7 cols) in Frosted Glass Panel */}
          <div className="md:col-span-7 rounded-3xl glass-panel border border-white/80 p-7 md:p-8 shadow-xl flex flex-col justify-center">
            <h2 className="text-lg font-extrabold text-slate-900 mb-1 tracking-tight">
              Otentikasi Kredensial Siswa
            </h2>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Verifikasi identitas pemilih sebelum membuka surat suara digital.
            </p>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 backdrop-blur-xs shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Induk Siswa Nasional (NISN)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 0111234001"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm font-mono-numbers font-bold"
                    required
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-medium font-mono">
                    {nisn.length}/10 digit
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Token PIN Acak (6 Karakter Alfanumerik)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    placeholder="Contoh: TK7N2X"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm tracking-widest uppercase font-mono-numbers font-black text-slate-900"
                    required
                  />
                  <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Periksa kartu suara yang dibagikan oleh panitia bilik.
                </p>
              </div>

              {/* Sample Hint Buttons for quick demo testing */}
              <div className="pt-2">
                <p className="text-[11px] font-bold text-slate-500 mb-2">
                  Bantuan Cepat Simulasi (Pilih Akun Demo Belum Memilih):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNisn('0111234004');
                      setPin('R6T2CY');
                    }}
                    className="text-[11px] px-3 py-1.5 glass-button rounded-xl text-slate-700 font-mono font-bold cursor-pointer"
                  >
                    Cantika (VII A)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNisn('0111234007');
                      setPin('M2G7VP');
                    }}
                    className="text-[11px] px-3 py-1.5 glass-button rounded-xl text-slate-700 font-mono font-bold cursor-pointer"
                  >
                    Farel (VII B)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNisn('0101234016');
                      setPin('T7P4WD');
                    }}
                    className="text-[11px] px-3 py-1.5 glass-button rounded-xl text-slate-700 font-mono font-bold cursor-pointer"
                  >
                    Olivia (VIII C)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-101 active:scale-99"
              >
                <span>Buka Surat Suara Digital</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: DIGITAL BALLOT PAPER (SURAT SUARA DIGITAL) */}
      {step === 'BALLOT' && authenticatedVoter && (
        <div className="space-y-6">
          {/* Official Ballot Header in Frosted Glass */}
          <div className="rounded-3xl glass-panel border-2 border-slate-900/80 p-6 md:p-8 shadow-xl text-center relative overflow-hidden">
            <div className="flex flex-col items-center">
              <SchoolCrestLogo size={48} type={school.type} className="mb-2 shadow-sm" />
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-slate-900">
                SURAT SUARA PEMILIHAN KETUA & WAKIL KETUA {school.type}
              </h1>
              <p className="text-xs md:text-sm font-extrabold text-slate-600 uppercase tracking-wide mt-0.5">
                {school.name} · TAHUN AJARAN {activePeriod?.academicYear}
              </p>
              <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-4 px-4 py-1.5 rounded-2xl bg-white/70 border border-white/80 shadow-2xs text-xs text-slate-700 font-medium">
                <span>Pemilih: <strong className="font-bold text-slate-900">{authenticatedVoter.fullName}</strong></span>
                <span>·</span>
                <span>Kelas: <strong className="font-bold text-slate-900">{authenticatedVoter.className}</strong></span>
                <span>·</span>
                <span>NISN: <strong className="font-bold font-mono text-slate-900">{authenticatedVoter.nisn}</strong></span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl text-xs text-amber-900 font-semibold backdrop-blur-xs">
              Instruksi: Tentukan pilihan Anda dengan menekan tombol <strong>"Pilih Paslon Ini"</strong> pada kolom pasangan calon yang Anda kehendaki.
            </div>
          </div>

          {/* Ballot Columns Grid in Frosted Glass Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="rounded-3xl glass-card glass-card-hover border-2 border-white/80 p-6 shadow-lg flex flex-col justify-between hover:border-sky-400/80 hover:shadow-2xl transition-all group"
              >
                <div className="space-y-4">
                  {/* Ballot Number Stamp */}
                  <div className="text-center pb-3 border-b border-slate-200/60">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                      NOMOR URUT
                    </span>
                    <div className="text-4xl font-black text-slate-900 font-mono-numbers mt-0.5">
                      {cand.ballotNumber < 10 ? `0${cand.ballotNumber}` : cand.ballotNumber}
                    </div>
                  </div>

                  {/* Candidate Visual Vector Avatar */}
                  <div className="flex justify-center py-1">
                    <CandidateAvatar
                      ballotNumber={cand.ballotNumber}
                      chairmanName={cand.chairmanName}
                      viceChairmanName={cand.viceChairmanName}
                      chairmanPhotoUrl={cand.chairmanPhotoUrl}
                      viceChairmanPhotoUrl={cand.viceChairmanPhotoUrl}
                      photoUrl={cand.photoUrl}
                      size="lg"
                    />
                  </div>

                  {/* Candidate Names */}
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {cand.chairmanName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Calon Ketua ({cand.chairmanClass})
                    </p>
                    <div className="pt-1.5 border-t border-slate-200/60 mt-1">
                      <h4 className="text-sm font-bold text-slate-800 leading-snug">
                        {cand.viceChairmanName}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">
                        Calon Wakil ({cand.viceChairmanClass})
                      </p>
                    </div>
                  </div>

                  {/* Motto in Frosted Bubble */}
                  <p className="text-xs italic text-slate-600 text-center bg-white/60 backdrop-blur-xs p-2.5 rounded-xl border border-white/60 shadow-2xs">
                    &ldquo;{cand.motto}&rdquo;
                  </p>

                  {/* Visi, Misi & Video Kampanye Preview Trigger */}
                  <button
                    type="button"
                    onClick={() => setPreviewCandidate(cand)}
                    className="w-full py-2.5 px-3 rounded-xl glass-button text-sky-700 hover:text-sky-900 border border-sky-200/80 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Info className="w-3.5 h-3.5 text-sky-600" />
                    <span>Lihat Visi, Misi & Video Orasi</span>
                  </button>
                </div>

                {/* Primary Action Button: Coblos / Pilih */}
                <div className="mt-5 pt-4 border-t border-slate-200/60">
                  <button
                    onClick={() => handleSelectCandidate(cand)}
                    className="w-full py-3.5 rounded-2xl bg-slate-900/90 group-hover:bg-gradient-to-r group-hover:from-sky-500 group-hover:to-indigo-600 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-101 active:scale-99"
                  >
                    <Vote className="w-4 h-4" />
                    <span>PILIH PASLON {cand.ballotNumber < 10 ? `0${cand.ballotNumber}` : cand.ballotNumber}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CANDIDATE PREVIEW MODAL IN BILIK SUARA */}
      {previewCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900 text-white font-bold text-sm">
                  {previewCandidate.ballotNumber < 10 ? `0${previewCandidate.ballotNumber}` : previewCandidate.ballotNumber}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {previewCandidate.chairmanName} & {previewCandidate.viceChairmanName}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Informasi Profil & Video Kampanye Paslon No. {previewCandidate.ballotNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewCandidate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex justify-center">
                <CandidateAvatar
                  ballotNumber={previewCandidate.ballotNumber}
                  chairmanName={previewCandidate.chairmanName}
                  viceChairmanName={previewCandidate.viceChairmanName}
                  chairmanPhotoUrl={previewCandidate.chairmanPhotoUrl}
                  viceChairmanPhotoUrl={previewCandidate.viceChairmanPhotoUrl}
                  photoUrl={previewCandidate.photoUrl}
                  size="md"
                />
              </div>

              {/* Visi */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Visi Utama
                </h4>
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-800 leading-relaxed border border-slate-200">
                  {previewCandidate.vision}
                </div>
              </div>

              {/* Misi */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Misi Strategis
                </h4>
                <ul className="space-y-1.5">
                  {previewCandidate.mission.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2 flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Video Player Display */}
              <CandidateVideoDisplay
                candidate={previewCandidate}
                title="Video Orasi & Kampanye Paslon"
                autoPlay={false}
              />
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setPreviewCandidate(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Kembali ke Surat Suara
              </button>
              <button
                onClick={() => {
                  const cand = previewCandidate;
                  setPreviewCandidate(null);
                  handleSelectCandidate(cand);
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Vote className="w-4 h-4" />
                <span>Pilih Paslon Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIRMATION MODAL */}
      {step === 'CONFIRM' && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-5">
            <div className="text-center space-y-2">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-100 text-sky-600 mb-1">
                <Vote className="w-6 h-6" />
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Konfirmasi Pilihan Suara Anda
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Apakah Anda yakin dengan pilihan Anda? Sesuai asas <strong>LUBER-JURDIL</strong>, pilihan ini bersifat <strong>RAHASIA, FINAL</strong>, dan <strong>TIDAK DAPAT DIUBAH</strong> setelah dikirimkan.
              </p>
            </div>

            {/* Selected Card Preview */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
              <div className="flex-shrink-0">
                <CandidateAvatar
                  ballotNumber={selectedCandidate.ballotNumber}
                  chairmanName={selectedCandidate.chairmanName}
                  viceChairmanName={selectedCandidate.viceChairmanName}
                  chairmanPhotoUrl={selectedCandidate.chairmanPhotoUrl}
                  viceChairmanPhotoUrl={selectedCandidate.viceChairmanPhotoUrl}
                  photoUrl={selectedCandidate.photoUrl}
                  size="sm"
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase text-sky-600">
                  Paslon No. Urut {selectedCandidate.ballotNumber < 10 ? `0${selectedCandidate.ballotNumber}` : selectedCandidate.ballotNumber}
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {selectedCandidate.chairmanName}
                </h4>
                <p className="text-xs text-slate-600">
                  & {selectedCandidate.viceChairmanName}
                </p>
                <p className="text-[11px] text-slate-400 pt-1 italic line-clamp-1">
                  "{selectedCandidate.motto}"
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('BALLOT')}
                className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Kembali Periksa
              </button>
              <button
                type="button"
                onClick={handleConfirmVote}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Ya, Kirimkan Pilihan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS SCREEN WITH FRAMER MOTION CONFETTI & ANIMATIONS */}
      {step === 'SUCCESS' && (
        <div className="relative min-h-[460px] flex items-center justify-center">
          {/* Framer Motion Burst Confetti Layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-10">
            {confettiParticles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.2, rotate: 0 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  opacity: [1, 1, 0.8, 0],
                  scale: [0.4, 1.2, 1, 0.6],
                  rotate: p.rotation,
                }}
                transition={{
                  duration: 2.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  position: 'absolute',
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'star' ? '2px' : '3px',
                  boxShadow: '0 0 6px rgba(0,0,0,0.1)',
                }}
              />
            ))}
          </div>

          {/* Main Success Animated Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-center space-y-6"
          >
            {/* Animated Checkmark Badge with Spring & Pulsing Aura */}
            <div className="relative flex justify-center items-center my-2">
              <motion.div
                animate={{
                  scale: [1, 1.35, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute w-24 h-24 rounded-full bg-emerald-400/20 pointer-events-none"
              />

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-10 h-10" />
              </motion.div>
            </div>

            {/* Title & Speech */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-2"
            >
              <h2 className="text-xl font-bold text-slate-900">
                Hak Suara Berhasil Disalurkan!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Terima kasih atas partisipasi aktif Anda dalam menyukseskan pemilihan ketua & wakil ketua {school.type} {school.name}.
              </p>
            </motion.div>

            {/* Anonymous Receipt */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Status Transaksi</span>
                <span className="font-semibold text-emerald-600 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  TERVERIFIKASI SAH
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Kode Resi Anonim</span>
                <span className="font-mono text-slate-900 font-bold">{receiptCode}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Waktu Rekap</span>
                <span className="font-mono text-slate-900">{new Date().toLocaleTimeString('id-ID')} WIB</span>
              </div>
            </motion.div>

            {/* Automatic Countdown Timer Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="pt-2 border-t border-slate-100 space-y-3"
            >
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 px-4 py-2 rounded-full">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Kembali ke layar awal dalam <strong>{countdown}</strong> detik...</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Bilik suara akan disetel ulang agar siap digunakan siswa berikutnya.
              </p>
              <div>
                <button
                  onClick={handleResetBooth}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                >
                  Selesai Sekarang
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
