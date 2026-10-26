/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cinematic Video Opening Sequence for E-Pilketos / E-Pilkosim Digital.
 * Features broadcast-grade motion graphics, Web Audio API sound design,
 * school emblem reveal, candidate showcases, video player controls,
 * custom school video playback support, and instant skip options.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, FastForward, RotateCcw, 
  Sparkles, CheckCircle2, Award, Vote, Users, ShieldCheck,
  Radio, Maximize2, Minimize2
} from 'lucide-react';
import { SchoolConfig, ElectionPeriod, Candidate } from '../types';
import { cinematicAudio } from '../utils/cinematicAudio';
import { SchoolCrestLogo, CandidateAvatar } from './CandidateAvatar';

interface OpeningSequenceProps {
  school: SchoolConfig;
  period: ElectionPeriod;
  candidates: Candidate[];
  onComplete: () => void;
}

export const OpeningSequence: React.FC<OpeningSequenceProps> = ({
  school,
  period,
  candidates,
  onComplete,
}) => {
  // Duration of procedural animation: 30 seconds
  const TOTAL_DURATION = 30;
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [soundActivated, setSoundActivated] = useState<boolean>(false);
  const [useCustomVideo, setUseCustomVideo] = useState<boolean>(Boolean(school.openingVideoUrl));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoElemRef = useRef<HTMLVideoElement>(null);
  const audioLastStageRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Determine active cinematic stage based on currentTime (30s Total Duration)
  // Stage 0 (0 - 5.0s): Countdown 5, 4, 3, 2, 1
  // Stage 1 (5.0 - 15.0s): School Emblem & OSIS Crest Reveal
  // Stage 2 (15.0 - 24.0s): Meet the Candidates & Digital Ballot Showcase
  // Stage 3 (24.0 - 30.0s): System Ready & Launch Call-To-Action
  const getStage = (t: number) => {
    if (t < 5.0) return 0;
    if (t < 15.0) return 1;
    if (t < 24.0) return 2;
    return 3;
  };

  const currentStage = getStage(currentTime);

  // Trigger sound effects at exact timestamps
  const handleStageSound = useCallback((t: number) => {
    if (isMuted) return;

    // Stage 0: Countdown Ticks (at ~0.1s, ~1.0s, ~2.0s, ~3.0s, ~4.0s)
    if (t >= 0.1 && t < 0.25 && audioLastStageRef.current < 0) {
      audioLastStageRef.current = 0;
      cinematicAudio.playCountdownTick(false);
    } else if (t >= 1.0 && t < 1.15 && audioLastStageRef.current === 0) {
      audioLastStageRef.current = 1;
      cinematicAudio.playCountdownTick(false);
    } else if (t >= 2.0 && t < 2.15 && audioLastStageRef.current === 1) {
      audioLastStageRef.current = 2;
      cinematicAudio.playCountdownTick(false);
    } else if (t >= 3.0 && t < 3.15 && audioLastStageRef.current === 2) {
      audioLastStageRef.current = 3;
      cinematicAudio.playCountdownTick(false);
    } else if (t >= 4.0 && t < 4.15 && audioLastStageRef.current === 3) {
      audioLastStageRef.current = 4;
      cinematicAudio.playCountdownTick(true);
    }

    // Stage 1: Big Boom & Fanfare at 5.0s
    if (t >= 5.0 && t < 5.2 && audioLastStageRef.current <= 4) {
      audioLastStageRef.current = 5;
      cinematicAudio.playCinematicBoom();
      setTimeout(() => {
        cinematicAudio.playFanfareChord();
      }, 150);
    }

    // Stage 2: Swoosh into Candidates at 15.0s
    if (t >= 15.0 && t < 15.2 && audioLastStageRef.current <= 5) {
      audioLastStageRef.current = 6;
      cinematicAudio.playSwoosh();
      setTimeout(() => {
        cinematicAudio.playBiometricPing();
      }, 700);
    }

    // Stage 3: Biometric Fanfare at 24.0s
    if (t >= 24.0 && t < 24.2 && audioLastStageRef.current <= 6) {
      audioLastStageRef.current = 7;
      cinematicAudio.playBiometricPing();
    }
  }, [isMuted]);

  // Main playback timer loop
  useEffect(() => {
    if (useCustomVideo) return; // Handled by HTML5 video events

    if (!isPlaying) {
      lastTimestampRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + delta;
        handleStageSound(next);
        if (next >= TOTAL_DURATION) {
          // Video animation complete: pause at final stage and wait for user to click "MASUK KE SISTEM PEMILIHAN"
          setIsPlaying(false);
          return TOTAL_DURATION;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, useCustomVideo, handleStageSound]);

  // Smooth finish transition
  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  // Toggle Mute & Sound Activation
  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    cinematicAudio.setMuted(nextMuted);
    setSoundActivated(true);
    if (!nextMuted) {
      cinematicAudio.playCountdownTick(true);
    }
  };

  const handleActivateSound = () => {
    setIsMuted(false);
    cinematicAudio.setMuted(false);
    setSoundActivated(true);
    cinematicAudio.playCountdownTick(true);
  };

  const handleReplay = () => {
    audioLastStageRef.current = -1;
    setCurrentTime(0);
    setIsPlaying(true);
    if (videoElemRef.current) {
      videoElemRef.current.currentTime = 0;
      videoElemRef.current.play().catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // YouTube embed helper if school video is YouTube
  const getYouTubeEmbed = (url: string) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`;
    }
    return null;
  };

  const customYtEmbed = school.openingVideoUrl ? getYouTubeEmbed(school.openingVideoUrl) : null;
  const isDirectVideo = school.openingVideoUrl && !customYtEmbed;

  // Countdown calculations
  const countdownNumber = Math.max(1, 5 - Math.floor(currentTime));
  const progressPercent = Math.min(100, (currentTime / TOTAL_DURATION) * 100);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Animated Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dynamic Light Beams */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-sky-500/15 rounded-full blur-[130px] animate-pulse" />
        <div className="absolute -bottom-40 left-1/4 w-[600px] h-[400px] bg-rose-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px]" />

        {/* Ambient Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Subtle Scanline Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-500/[0.02] to-transparent pointer-events-none" />
      </div>

      {/* Top Header Bar: Broadcast Identity & Skip Action */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-slate-950/90 to-transparent">
        {/* Left: Broadcast Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold tracking-wider uppercase animate-pulse">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Siaran Resmi E-Pilketos</span>
          </div>
          <span className="text-slate-400 text-xs hidden sm:inline-block">
            {school.type} {school.name}
          </span>
        </div>

        {/* Right: Sound Notice & Quick Skip Button */}
        <div className="flex items-center gap-3">
          {!soundActivated && !isMuted && !useCustomVideo && (
            <button
              onClick={handleActivateSound}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer animate-bounce"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Nyalakan Suara Intro</span>
            </button>
          )}

          <button
            onClick={handleFinish}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 transition-all cursor-pointer group"
          >
            <span>Lewati Video & Masuk</span>
            <FastForward className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Center Cinematic Stage (Widescreen 16:9 Viewport) */}
      <div className="relative w-full max-w-5xl aspect-video max-h-[80vh] flex items-center justify-center p-4">
        {/* Cinema Matte Frame */}
        <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/80 backdrop-blur-md shadow-2xl flex items-center justify-center">

          {/* MODE A: Custom School Video (if configured) */}
          {useCustomVideo && school.openingVideoUrl ? (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              {customYtEmbed ? (
                <iframe
                  src={customYtEmbed}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={school.openingVideoTitle || 'Video Pembukaan Resmi'}
                />
              ) : isDirectVideo ? (
                <video
                  ref={videoElemRef}
                  src={school.openingVideoUrl}
                  autoPlay
                  controls
                  playsInline
                  onEnded={() => {
                    setUseCustomVideo(false);
                    setCurrentTime(TOTAL_DURATION);
                    setIsPlaying(false);
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <p className="text-sm text-slate-300">Format video khusus tidak didukung secara langsung.</p>
                  <button 
                    onClick={() => setUseCustomVideo(false)}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold"
                  >
                    Beralih ke Motion Graphic Intro
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* MODE B: Procedural Broadcast Cinematic Motion Graphic */
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">

              {/* STAGE 0: Countdown 3, 2, 1 */}
              {currentStage === 0 && (
                <div className="relative flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
                  {/* Glowing Reticle Rings */}
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-sky-400/40 animate-ping opacity-60" />
                    <div className="absolute inset-2 rounded-full border border-dashed border-sky-500/60 animate-spin" style={{ animationDuration: '8s' }} />
                    <div className="absolute inset-6 rounded-full border border-white/20" />
                    
                    {/* Big Countdown Number */}
                    <span 
                      key={countdownNumber}
                      className="text-8xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-sky-200 to-sky-400 drop-shadow-[0_0_35px_rgba(56,189,248,0.7)] animate-in zoom-in-75 duration-200"
                    >
                      {countdownNumber}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-[0.35em] text-sky-400">
                      Peluncuran Sistem Digital
                    </p>
                    <h2 className="text-lg md:text-2xl font-black text-white tracking-wide">
                      DEMOKRASI GENERASI EMAS
                    </h2>
                    <p className="text-xs text-slate-400">
                      Persiapkan hak suaramu untuk masa depan sekolah yang lebih gemilang
                    </p>
                  </div>
                </div>
              )}

              {/* STAGE 1: School Crest, OSIS Seal & Official Title Reveal */}
              {currentStage === 1 && (
                <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-5 animate-in fade-in zoom-in-95 duration-500">
                  {/* Rotating Hologram Halo */}
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-gradient-to-r from-sky-500 via-amber-400 to-rose-500 rounded-full blur-xl opacity-60 animate-pulse" />
                    <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-slate-900/90 border-2 border-amber-400/80 p-3 shadow-2xl flex items-center justify-center transform hover:rotate-2 transition-transform">
                      <SchoolCrestLogo size={96} type={school.type} logoUrl={school.logoUrl} />
                    </div>
                  </div>

                  {/* School & Period Title */}
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-widest uppercase">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>{school.type} {school.name}</span>
                    </div>

                    <h1 className="text-2xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-sky-200 tracking-tight leading-tight">
                      PEMILIHAN UMUM KETUA & WAKIL KETUA {school.type}
                    </h1>

                    <p className="text-xs md:text-sm text-sky-300/90 font-semibold tracking-wide">
                      Periode Masa Bakti {period.academicYear} · Terdaftar Resmi di NPSN {school.npsn}
                    </p>
                  </div>

                  {/* Democratic Principles Ribbon */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] font-bold">
                    <span className="px-3 py-1 rounded-lg bg-red-600/30 border border-red-500/40 text-red-200">
                      LANGSUNG
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-red-600/30 border border-red-500/40 text-red-200">
                      UMUM
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-red-600/30 border border-red-500/40 text-red-200">
                      BEBAS
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-red-600/30 border border-red-500/40 text-red-200">
                      RAHASIA
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/20 border border-white/40 text-white">
                      JUJUR
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/20 border border-white/40 text-white">
                      ADIL
                    </span>
                  </div>
                </div>
              )}

              {/* STAGE 2: Candidates Showcase & Biometric Voting Box */}
              {currentStage === 2 && (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-400">
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Putra-Putri Terbaik Bangsa</span>
                    </span>
                    <h2 className="text-xl md:text-3xl font-black text-white">
                      DAFTAR PASANGAN CALON TERDAFTAR
                    </h2>
                    <p className="text-xs text-slate-400">
                      Pilih pemimpin yang memiliki visi, misi, dan aksi nyata untuk sekolah kita
                    </p>
                  </div>

                  {/* Candidates Grid Showcase */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl pt-2">
                    {candidates.slice(0, 3).map((cand) => (
                      <div 
                        key={cand.id}
                        className="relative rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 flex flex-col items-center text-center space-y-2.5 shadow-xl hover:border-sky-400/80 transition-all transform hover:-translate-y-1"
                      >
                        {/* Ballot Badge */}
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-sky-500 text-slate-950 font-black text-xs font-mono shadow-md">
                          0{cand.ballotNumber}
                        </div>

                        {/* Dual or Single Candidate Avatar */}
                        <div className="pt-2">
                          <CandidateAvatar
                            ballotNumber={cand.ballotNumber}
                            chairmanName={cand.chairmanName}
                            viceChairmanName={cand.viceChairmanName}
                            chairmanPhotoUrl={cand.chairmanPhotoUrl}
                            viceChairmanPhotoUrl={cand.viceChairmanPhotoUrl}
                            photoUrl={cand.photoUrl}
                            size="sm"
                          />
                        </div>

                        {/* Candidate Names */}
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-extrabold text-white line-clamp-1">
                            {cand.chairmanName}
                          </h4>
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            & {cand.viceChairmanName}
                          </p>
                        </div>

                        {/* Motto tag */}
                        <div className="w-full bg-slate-800/80 rounded-lg py-1 px-2 text-[10px] text-sky-300 font-medium italic line-clamp-1">
                          &ldquo;{cand.motto || cand.vision}&rdquo;
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Digital Voting Box Indicator */}
                  <div className="flex items-center gap-2 pt-2 text-xs text-slate-300 bg-slate-900/60 px-4 py-1.5 rounded-full border border-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Keamanan Terjamin · Enkripsi PIN SHA-256 · Anonim & Bebas Intimidasi</span>
                  </div>
                </div>
              )}

              {/* STAGE 3: Final Launch Call-to-Action */}
              {currentStage === 3 && (
                <div className="relative flex flex-col items-center justify-center text-center p-6 space-y-6 animate-in zoom-in-95 duration-400">
                  {/* Glowing Vote Icon */}
                  <div className="relative">
                    <div className="absolute -inset-4 bg-sky-500 rounded-full blur-2xl opacity-60 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-3xl bg-slate-900 border-2 border-sky-400 flex items-center justify-center text-sky-400 shadow-2xl">
                      <Vote className="w-12 h-12 animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sistem Siap Digunakan</span>
                    </div>

                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                      SELAMAT DATANG DI E-PILKETOS
                    </h2>

                    <p className="text-xs md:text-sm text-slate-300 max-w-md mx-auto">
                      Satu suara Anda menentukan arah kepemimpinan {school.name}. Gunakan hak suaramu hari ini!
                    </p>
                  </div>

                  {/* Big Enter Button */}
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <button
                      onClick={handleFinish}
                      className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-slate-950 font-black text-sm md:text-base shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 transition-all cursor-pointer transform hover:scale-105 active:scale-95 flex items-center gap-2.5 animate-pulse"
                    >
                      <span>MASUK KE SISTEM PEMILIHAN</span>
                      <FastForward className="w-5 h-5" />
                    </button>
                    <span className="text-[11px] text-slate-300 font-mono font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span>Silakan tekan tombol di atas untuk masuk ke sistem pemilihan</span>
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="relative z-20 w-full max-w-5xl px-6 py-4 flex flex-col gap-2.5">
        {/* Seekable Progress Bar */}
        <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden cursor-pointer">
          <div 
            className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-emerald-400 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          {/* Left Controls: Play/Pause, Replay, Sound */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={handleReplay}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Putar Ulang dari Awal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                isMuted 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : 'bg-slate-900 hover:bg-slate-800 text-sky-400'
              }`}
              title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline font-mono text-[11px]">
                {isMuted ? 'Bisu' : 'Audio Aktif'}
              </span>
            </button>

            {/* Time Stamp */}
            <span className="font-mono text-slate-400 ml-1">
              00:{String(Math.floor(currentTime)).padStart(2, '0')} / 00:{TOTAL_DURATION}
            </span>
          </div>

          {/* Center Stage Navigator Badges (Desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { id: 0, label: 'Hitung Mundur', start: 0 },
              { id: 1, label: 'Emblem OSIS', start: 5 },
              { id: 2, label: 'Paslon Calon', start: 15 },
              { id: 3, label: 'Masuk Bilik', start: 24 },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setCurrentTime(st.start);
                  audioLastStageRef.current = st.id === 0 ? -1 : st.id + 1;
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  currentStage === st.id 
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Custom Video Toggle, Fullscreen, and Skip */}
          <div className="flex items-center gap-3">
            {school.openingVideoUrl && (
              <button
                onClick={() => setUseCustomVideo(!useCustomVideo)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  useCustomVideo 
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200' 
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {useCustomVideo ? 'Ganti ke Motion Graphic' : 'Putar Video Khusus Sekolah'}
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleFinish}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-900 font-bold text-xs transition-colors cursor-pointer"
            >
              Lewati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
