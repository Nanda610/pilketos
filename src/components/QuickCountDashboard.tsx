/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Public Homepage: Live Quick Count Dashboard & Candidate Profiles
 * Includes interactive candidate manifesto modal with simulated video orasi player,
 * animated number counters ("pencapaian hasil angka"), and celebratory confetti animations.
 */

import React, { useState, useEffect, useRef } from 'react';
import { safeConfetti as confetti } from '../utils/confettiHelper';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CheckCircle2, Clock, Vote, ChevronRight, Play, Pause, X,
  BarChart3, PieChart, Volume2, VolumeX, RotateCcw,
  Trophy, PartyPopper, Flame, Radio
} from 'lucide-react';
import { SchoolConfig, ElectionSummary, Candidate, RealtimeSyncMetadata } from '../types';
import { CandidateAvatar, SchoolCrestLogo } from './CandidateAvatar';
import { CandidateVideoDisplay } from './CandidateVideoDisplay';
import { formatAppTimeDisplay, evaluateVotingSchedule } from '../lib/realtimeSync';
import { electionStore } from '../lib/store';
import { GarudaIcon } from './GarudaIcon';
import { BloggerIcon } from './BloggerIcon';

interface QuickCountDashboardProps {
  school: SchoolConfig;
  summary: ElectionSummary;
  appTimeMs: number;
  syncMeta: RealtimeSyncMetadata;
  onNavigateToBooth: () => void;
  onOpenShareBlogger?: () => void;
}

// Helper component for smooth numeric counter animation ("pencapaian hasil angka")
const AnimatedNumber: React.FC<{
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}> = ({
  value,
  duration = 600,
  suffix = '',
  prefix = '',
  decimals = 0,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;
    const startValue = prevValueRef.current;
    const targetValue = value;
    prevValueRef.current = value;

    if (startValue === targetValue) {
      setDisplayValue(targetValue);
      return;
    }

    const updateNumber = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out quad formula
      const easeOut = 1 - (1 - progress) * (1 - progress);
      const raw = startValue + (targetValue - startValue) * easeOut;
      const current = decimals > 0 ? Number(raw.toFixed(decimals)) : Math.floor(raw);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration, decimals]);

  const formatted =
    decimals > 0
      ? displayValue.toLocaleString('id-ID', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : displayValue.toLocaleString('id-ID');

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export const QuickCountDashboard: React.FC<QuickCountDashboardProps> = ({
  school,
  summary,
  appTimeMs,
  syncMeta,
  onNavigateToBooth,
  onOpenShareBlogger,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [chartView, setChartView] = useState<'bar' | 'donut'>('bar');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(35);
  const [hasTriggeredInitialConfetti, setHasTriggeredInitialConfetti] = useState(false);

  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  // Subscribe to real-time store changes for instant visual update across all viewers
  const [, setStoreVersion] = useState(0);
  useEffect(() => {
    const unsub = electionStore.subscribe(() => {
      setStoreVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  const { period, totalVoters, totalVoted, totalUnvoted, participationPercentage, candidatesResults, classParticipation } = summary;
  const formattedClock = formatAppTimeDisplay(appTimeMs);
  const scheduleStatus = evaluateVotingSchedule(period, appTimeMs);

  const [newVoteAlert, setNewVoteAlert] = useState<{
    candidateName: string;
    ballotNumber: number;
    timestamp: string;
    totalVotes: number;
  } | null>(null);
  const [highlightCandidateId, setHighlightCandidateId] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Track previous counts to detect real-time vote transactions coming from Bilik Suara
  const prevTotalVotedRef = useRef<number>(summary.totalVoted);
  const prevCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // If total votes increased, detect which candidate gained the vote and trigger live visual notification
    if (prevTotalVotedRef.current !== undefined && summary.totalVoted > prevTotalVotedRef.current) {
      const gained = summary.candidatesResults.find((r) => {
        const oldVal = prevCountsRef.current[r.candidate.id] || 0;
        return r.voteCount > oldVal;
      });

      if (gained) {
        setHighlightCandidateId(gained.candidate.id);
        setNewVoteAlert({
          candidateName: `${gained.candidate.chairmanName} & ${gained.candidate.viceChairmanName}`,
          ballotNumber: gained.candidate.ballotNumber,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          totalVotes: summary.totalVoted,
        });

        // Clear highlight after 4 seconds
        setTimeout(() => {
          setHighlightCandidateId((curr) => (curr === gained.candidate.id ? null : curr));
        }, 4000);

        // Auto-dismiss banner after 6 seconds
        setTimeout(() => {
          setNewVoteAlert((curr) => (curr?.timestamp ? null : curr));
        }, 6000);
      }
    }

    prevTotalVotedRef.current = summary.totalVoted;
    const currentMap: Record<string, number> = {};
    summary.candidatesResults.forEach((r) => {
      currentMap[r.candidate.id] = r.voteCount;
    });
    prevCountsRef.current = currentMap;
  }, [summary.totalVoted, summary.candidatesResults]);

  // Keep selectedCandidate synced if Admin/Panitia edits candidate while modal is open
  useEffect(() => {
    if (!selectedCandidate) return;
    const updated = candidatesResults.find((r) => r.candidate.id === selectedCandidate.id)?.candidate;
    if (updated) {
      setSelectedCandidate(updated);
    }
  }, [candidatesResults, selectedCandidate]);

  // Find current leading candidate
  const leadingCandidate = [...candidatesResults].sort((a, b) => b.voteCount - a.voteCount)[0];

  // Trigger celebratory confetti when requested or when inspecting results
  const fireCelebrationConfetti = (originX: number = 0.5) => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { x: originX, y: 0.55 },
        colors: ['#38bdf8', '#34d399', '#f59e0b', '#8b5cf6', '#ec4899'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
        });
      }, 150);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (!hasTriggeredInitialConfetti && leadingCandidate && leadingCandidate.voteCount > 0) {
      fireCelebrationConfetti(0.5);
      setHasTriggeredInitialConfetti(true);
    }
  }, [leadingCandidate, hasTriggeredInitialConfetti]);

  const handleOpenCandidateModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsPlayingVideo(false);
    setVideoProgress(25);
    fireCelebrationConfetti(0.5);
  };

  const handleOpenCelebration = () => {
    setShowCelebrationModal(true);
    fireCelebrationConfetti(0.5);
  };

  return (
    <div className="no-print-dashboard space-y-8 pb-16">
      {/* Hero Banner: School Identity & Active Period in Dark Frosted Glass */}
      <div className="relative overflow-hidden rounded-3xl glass-dark text-white p-6 md:p-8 shadow-2xl border border-white/15">
        {/* Subtle Ambient Refraction Glows Inside Hero */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <SchoolCrestLogo size={64} type={school.type} logoUrl={school.logoUrl} className="mt-1 shadow-lg ring-2 ring-white/20" />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wider text-sky-300 uppercase">
                <span data-testid="hero-school-name">{school.type} {school.name}</span>
                <span>·</span>
                <span>NPSN: {school.npsn}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-[10px] text-sky-200 normal-case">
                  Sinkronisasi Online ({syncMeta.onlineClients} Klien · Rev #{syncMeta.revision})
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-1" data-testid="hero-period-name">
                {period.periodName}
              </h1>
              <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Penghitungan suara langsung (Quick Count) berbasis sistem e-voting terintegrasi, transparan, dan tersinkronisasi penuh dengan seluruh perangkat pada waktu aplikasi yang sama.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-300/80">
                <span className="inline-flex items-center gap-1.5 font-mono font-bold text-sky-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/15" data-testid="hero-app-time">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Waktu Aplikasi: {formattedClock.timeString} WIB ({formattedClock.dateString})
                </span>
                <span>·</span>
                <span>Jadwal Pemilihan: {period.votingOpenTime} - {period.votingCloseTime} WIB</span>
                <span>·</span>
                <span>TA {period.academicYear}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {scheduleStatus.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={onNavigateToBooth}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-black text-sm shadow-xl shadow-sky-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Vote className="w-4 h-4 text-slate-950" />
              <span>Masuk Bilik Suara Digital</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip in Frosted Glass Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl glass-card glass-card-hover p-5 border border-white/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total DPT</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100/80 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 font-mono-numbers">
            <AnimatedNumber value={totalVoters} />
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Siswa Terdaftar Hak Pilih</p>
        </div>

        <div className="rounded-2xl glass-card glass-card-hover p-5 border border-white/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Suara Masuk</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-600 font-mono-numbers">
            <AnimatedNumber value={totalVoted} />
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Surat Suara Sah Masuk</p>
        </div>

        <div className="rounded-2xl glass-card glass-card-hover p-5 border border-white/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Belum Memilih</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-700 font-mono-numbers">
            <AnimatedNumber value={totalUnvoted} />
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Menunggu di Bilik Suara</p>
        </div>

        <div className="rounded-2xl glass-card glass-card-hover p-5 border border-white/80 shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Partisipasi (Turnout)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-600">
              <GarudaIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-sky-600 font-mono-numbers">
            <AnimatedNumber value={participationPercentage} decimals={2} suffix="%" />
          </div>
          <div className="w-full bg-slate-200/60 rounded-full h-2 mt-2 overflow-hidden p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(participationPercentage, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Live Candidate Cards & Realtime Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Candidate Cards (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-5 rounded-3xl border border-white/80 shadow-md">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight" data-testid="layar-perolehan-suara-title">
                  Layar Perolehan Suara Pasangan Calon
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live · Sinkron Bilik Suara
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pembaruan otomatis dari bilik suara digital secara real-time ({syncMeta.onlineClients} perangkat terhubung online)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  setIsManualSyncing(true);
                  await electionStore.forceResyncWithServer();
                  setTimeout(() => setIsManualSyncing(false), 500);
                }}
                disabled={isManualSyncing}
                className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-bold border border-slate-200/80 shadow-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60"
                title="Sinkronkan data perolehan suara sekarang dengan server pusat"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin text-sky-600' : 'text-slate-600'}`} />
                <span>{isManualSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
              </button>



              {leadingCandidate && leadingCandidate.voteCount > 0 && (
                <span className="text-xs bg-emerald-500/10 text-emerald-800 border border-emerald-500/25 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 backdrop-blur-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Unggul: Paslon {leadingCandidate.candidate.ballotNumber < 10 ? `0${leadingCandidate.candidate.ballotNumber}` : leadingCandidate.candidate.ballotNumber}</span>
                </span>
              )}

              {/* Interactive Confetti Celebration Button */}
              <button
                onClick={handleOpenCelebration}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Tekan untuk merayakan hasil perolehan suara & menonton video selebrasi pemenang!"
              >
                <PartyPopper className="w-4 h-4 animate-bounce" />
                <span>Rayakan Selebrasi</span>
              </button>
            </div>
          </div>

          {/* Real-time Vote Arrival Notification Banner */}
          <AnimatePresence>
            {newVoteAlert && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-emerald-500/10 backdrop-blur-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Vote className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Suara Baru Masuk Dari Bilik
                      </span>
                      <span className="text-xs text-slate-600 font-mono">Pukul {newVoteAlert.timestamp} WIB</span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                      Paslon {newVoteAlert.ballotNumber < 10 ? `0${newVoteAlert.ballotNumber}` : newVoteAlert.ballotNumber} ({newVoteAlert.candidateName}) bertambah 1 suara sah. Total perolehan sekarang: {newVoteAlert.totalVotes} suara.
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-center px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black shadow-xs shrink-0">
                  +1 Suara Real-time
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {candidatesResults.map((result) => {
              const cand = result.candidate;
              const isLeading = leadingCandidate?.candidate.id === cand.id && result.voteCount > 0;
              const isHighlighted = highlightCandidateId === cand.id;

              return (
                <motion.div
                  key={cand.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  onClick={() => handleOpenCandidateModal(cand)}
                  className={`relative rounded-3xl glass-card glass-card-hover p-5 border flex flex-col justify-between transition-all duration-300 cursor-pointer group overflow-hidden ${
                    isHighlighted
                      ? 'ring-4 ring-emerald-400 border-emerald-500 bg-gradient-to-b from-emerald-50/80 via-white to-white shadow-2xl shadow-emerald-500/25 scale-[1.02]'
                      : isLeading 
                      ? 'border-sky-400/80 ring-2 ring-sky-400/25 bg-gradient-to-b from-sky-50/60 via-white/85 to-white shadow-xl shadow-sky-500/15' 
                      : 'border-white/80 shadow-md'
                  }`}
                >
                  {/* Real-time Vote Arrival Flash Badge */}
                  {isHighlighted && (
                    <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-[11px] font-black uppercase text-center py-1 tracking-wider animate-pulse z-20 flex items-center justify-center gap-1 shadow-md">
                      <Vote className="w-3.5 h-3.5" />
                      <span>+1 Suara Baru Saja Masuk!</span>
                    </div>
                  )}

                  {/* Subtle glow badge for leading paslon */}
                  {isLeading && !isHighlighted && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-sky-500 text-slate-950 font-black text-[10px] uppercase px-3 py-1 rounded-bl-2xl shadow-xs flex items-center gap-1">
                      <Flame className="w-3 h-3 fill-current text-rose-600" />
                      <span>Memimpin ({result.percentage}%)</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header: Ballot Number */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-900/90 text-white font-extrabold text-sm shadow-sm border border-white/20">
                          {cand.ballotNumber < 10 ? `0${cand.ballotNumber}` : cand.ballotNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Paslon
                        </span>
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
                        size="md"
                      />
                    </div>

                    {/* Names & Classes */}
                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug group-hover:text-sky-600 transition-colors">
                        {cand.chairmanName}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Calon Ketua ({cand.chairmanClass})
                      </p>
                      <div className="pt-1.5 border-t border-slate-200/60 mt-1">
                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                          {cand.viceChairmanName}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Calon Wakil ({cand.viceChairmanClass})
                        </p>
                      </div>
                    </div>

                    {/* Motto in Frosted Pill */}
                    <p className="text-xs italic text-slate-600 text-center line-clamp-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-xs border border-white/60 shadow-2xs">
                      &ldquo;{cand.motto}&rdquo;
                    </p>
                  </div>

                  {/* Vote Progress & Statistics with Animated Counter */}
                  <div className="mt-5 pt-4 border-t border-slate-200/60 space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Pencapaian Suara
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-slate-900 font-mono-numbers">
                          <AnimatedNumber value={result.voteCount} />
                        </span>
                        <span className="text-xs text-slate-500 font-medium ml-1">suara</span>
                      </div>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/60">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.percentage}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                          className={`h-full rounded-full shadow-xs ${
                            isLeading ? 'bg-gradient-to-r from-sky-500 to-indigo-600' : 'bg-slate-700'
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 font-medium">Persentase Masuk</span>
                        <span className="font-extrabold text-sky-600 font-mono-numbers">
                          <AnimatedNumber value={result.percentage} decimals={2} suffix="%" />
                        </span>
                      </div>
                    </div>

                    {/* Detail Manifesto Modal Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCandidateModal(cand);
                      }}
                      className="w-full mt-3 py-2.5 text-xs font-bold text-slate-700 glass-button group-hover:bg-slate-900 group-hover:text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Visi, Misi & Selebrasi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Visual Charts & Class Breakdown (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Chart Card in Frosted Glass */}
          <div className="rounded-3xl glass-card p-6 border border-white/80 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Distribusi Suara</h3>
                <p className="text-xs text-slate-500">Proporsi perolehan suara sah</p>
              </div>
              <div className="flex items-center gap-1 glass-tab-bar p-1 rounded-xl">
                <button
                  onClick={() => setChartView('bar')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    chartView === 'bar' ? 'bg-white text-slate-900 shadow-xs font-bold border border-white/80' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Tampilan Diagram Batang"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartView('donut')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    chartView === 'donut' ? 'bg-white text-slate-900 shadow-xs font-bold border border-white/80' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Tampilan Diagram Lingkaran"
                >
                  <PieChart className="w-4 h-4" />
                </button>
              </div>
            </div>

            {chartView === 'bar' ? (
              /* Bar Chart View */
              <div className="space-y-4 pt-2">
                {candidatesResults.map((r, i) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                  const color = colors[i % colors.length];

                  return (
                    <div key={r.candidate.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                          Paslon {r.candidate.ballotNumber} - {r.candidate.chairmanName.split(' ')[0]}
                        </span>
                        <span className="font-bold text-slate-900 font-mono-numbers">
                          {r.voteCount} ({r.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full ${color} transition-all duration-500`}
                          style={{ width: `${r.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SVG Donut Chart View */
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="16"
                    />
                    {totalVoted > 0 &&
                      candidatesResults.map((r, idx) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                        const strokeColor = colors[idx % colors.length];
                        const circumference = 2 * Math.PI * 40;
                        const strokeDasharray = `${(r.percentage / 100) * circumference} ${circumference}`;

                        const previousPercentages = candidatesResults
                          .slice(0, idx)
                          .reduce((sum, item) => sum + item.percentage, 0);
                        const strokeDashoffset = -((previousPercentages / 100) * circumference);

                        return (
                          <circle
                            key={r.candidate.id}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke={strokeColor}
                            strokeWidth="16"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-700"
                          />
                        );
                      })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900 font-mono-numbers">
                      {totalVoted}
                    </span>
                    <span className="text-[10px] text-slate-500">Suara Sah</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 w-full text-xs">
                  {candidatesResults.map((r, idx) => {
                    const dotColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                    return (
                      <div key={r.candidate.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColors[idx % dotColors.length]}`}></span>
                          <span className="text-slate-600 truncate max-w-[140px]">
                            Paslon {r.candidate.ballotNumber}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 font-mono-numbers">
                          {r.percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Turnout per Class Level in Frosted Glass */}
          <div className="rounded-3xl glass-card p-6 border border-white/80 shadow-md space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Partisipasi per Kelas</h3>
              <p className="text-xs text-slate-500">Pemantauan kehadiran pemilih di bilik suara</p>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {classParticipation.map((cp) => (
                <div key={cp.className} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cp.className}</span>
                    <span className="text-slate-500 font-mono-numbers font-medium">
                      {cp.voted}/{cp.total} ({cp.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden p-0.5 border border-white/60">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        cp.percentage >= 80 ? 'bg-emerald-500' : cp.percentage >= 50 ? 'bg-sky-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${cp.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Manifesto Modal in Frosted Glass */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="relative w-full max-w-2xl glass-panel rounded-3xl shadow-2xl border border-white/80 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/60 flex items-center justify-between bg-white/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-900 text-white font-extrabold text-sm shadow-sm border border-white/20">
                  {selectedCandidate.ballotNumber < 10 ? `0${selectedCandidate.ballotNumber}` : selectedCandidate.ballotNumber}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedCandidate.chairmanName} & {selectedCandidate.viceChairmanName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Visi, Misi & Rencana Kerja Pasangan Calon No. Urut {selectedCandidate.ballotNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Motto */}
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                <p className="text-xs uppercase font-bold text-sky-700 tracking-wider">Motto Perjuangan</p>
                <p className="text-sm font-semibold text-slate-800 mt-1 italic">
                  "{selectedCandidate.motto}"
                </p>
              </div>

              {/* Visi */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Visi Utama
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-800 leading-relaxed border border-slate-200/80">
                  {selectedCandidate.vision}
                </div>
              </div>

              {/* Misi */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Misi Strategis
                </h4>
                <ul className="space-y-2">
                  {selectedCandidate.mission.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px] flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Program Kerja Unggulan */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Program Kerja Unggulan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedCandidate.programs.map((prog, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-800 flex items-center gap-2">
                      <GarudaIcon className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>{prog}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Orasi & Kampanye Player */}
              <CandidateVideoDisplay candidate={selectedCandidate} />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Pilihan Anda menentukan masa depan organisasi sekolah.
              </span>
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  onNavigateToBooth();
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Pilih di Bilik Suara</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELEBRASI & SELEBRASI PEMENANG MODAL */}
      {showCelebrationModal && leadingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-amber-300 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-amber-500 via-yellow-400 to-sky-500 text-slate-950 flex items-center justify-between shadow-md relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-white/90 shadow-md flex items-center justify-center text-amber-600">
                  <Trophy className="w-7 h-7 fill-current" />
                </span>
                <div>
                  <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-slate-900">
                    <PartyPopper className="w-4 h-4" />
                    <span>SELEBRASI PEROLEHAN SUARA & PEMENANG</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-950 leading-tight mt-0.5">
                    Pencapaian Paslon No. {leadingCandidate.candidate.ballotNumber}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setShowCelebrationModal(false)}
                className="relative z-10 p-2 rounded-xl bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Dual Candidate Winner Spotlight Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-indigo-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                <div className="flex items-center gap-4">
                  <CandidateAvatar
                    ballotNumber={leadingCandidate.candidate.ballotNumber}
                    chairmanName={leadingCandidate.candidate.chairmanName}
                    viceChairmanName={leadingCandidate.candidate.viceChairmanName}
                    chairmanPhotoUrl={leadingCandidate.candidate.chairmanPhotoUrl}
                    viceChairmanPhotoUrl={leadingCandidate.candidate.viceChairmanPhotoUrl}
                    photoUrl={leadingCandidate.candidate.photoUrl}
                    size="lg"
                  />
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                      <Flame className="w-3 h-3 fill-current text-rose-600" />
                      MEMIMPIN PEROLEHAN SUARA ({leadingCandidate.percentage}%)
                    </span>
                    <h4 className="text-base font-black text-slate-900">
                      {leadingCandidate.candidate.chairmanName}
                    </h4>
                    <p className="text-xs text-slate-600">
                      & {leadingCandidate.candidate.viceChairmanName}
                    </p>
                    <p className="text-xs italic text-slate-500 font-medium">
                      "{leadingCandidate.candidate.motto}"
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-amber-200/80 text-center shrink-0 min-w-[130px]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Perolehan</span>
                  <div className="text-3xl font-black text-slate-900 font-mono-numbers mt-0.5">
                    {leadingCandidate.voteCount}
                  </div>
                  <span className="text-xs font-bold text-sky-600">Suara Sah</span>
                </div>
              </div>

              {/* Visi & Misi Ringkas */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Visi & Misi Kemenangan
                </h4>
                <p className="text-xs font-medium text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/80">
                  {leadingCandidate.candidate.vision}
                </p>
              </div>

              {/* Campaign / Victory Video Player Display */}
              <CandidateVideoDisplay
                candidate={leadingCandidate.candidate}
                title="Video Selebrasi & Orasi Kemenangan Paslon"
                autoPlay={true}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => fireCelebrationConfetti(0.5)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 text-white font-bold text-xs shadow-md hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <PartyPopper className="w-4 h-4 animate-bounce" />
                <span>Luncurkan Kembang Api / Confetti</span>
              </button>

              <button
                onClick={() => setShowCelebrationModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Tutup Selebrasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
