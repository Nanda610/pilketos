/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Main Application Component for E-Pilketos / E-Pilkosim Digital
 */

import React, { useState, useEffect } from 'react';
import { electionStore } from './lib/store';
import { SchoolConfig, ElectionPeriod, CommitteeMember, AuditLog, ElectionSummary, RealtimeSyncMetadata } from './types';
import { Navbar, AppView } from './components/Navbar';
import { QuickCountDashboard } from './components/QuickCountDashboard';
import { BilikSuara } from './components/BilikSuara';
import { PanitiaDashboard } from './components/PanitiaDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { PRDDocument } from './components/PRDDocument';
import { OpeningSequence } from './components/OpeningSequence';
import { AuthLoginModal } from './components/AuthLoginModal';
import { AuthSession, UserRole } from './types';
import { Lock, ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get('view')?.toUpperCase();
      if (
        requestedView === 'PUBLIC' ||
        requestedView === 'BOOTH' ||
        requestedView === 'PANITIA' ||
        requestedView === 'ADMIN' ||
        requestedView === 'PRD'
      ) {
        return requestedView as AppView;
      }
    }
    return 'PUBLIC';
  });

  // Authentication session state
  const [activeSession, setActiveSession] = useState<AuthSession | null>(() => electionStore.getActiveSession());
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [loginTargetRole, setLoginTargetRole] = useState<UserRole | null>(null);

  // Opening video plays before entering the application (skippable via ?autostart=1)
  const [showOpeningVideo, setShowOpeningVideo] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('skipIntro') === '1') {
        return false;
      }
    }
    return true;
  });

  // Reactive state synced with electionStore (and authoritative real-time server)
  const [school, setSchool] = useState<SchoolConfig>(() => electionStore.getSchool());
  const [periods, setPeriods] = useState<ElectionPeriod[]>(() => electionStore.getPeriods());
  const [activePeriod, setActivePeriod] = useState<ElectionPeriod>(() => electionStore.getActivePeriod());
  const [committee, setCommittee] = useState<CommitteeMember[]>(() => electionStore.getCommittee());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => electionStore.getAuditLogs());
  const [summary, setSummary] = useState<ElectionSummary>(() => electionStore.getSummary());
  const [syncMeta, setSyncMeta] = useState<RealtimeSyncMetadata>(() => electionStore.getSyncMetadata());
  const [appTimeMs, setAppTimeMs] = useState<number>(() => electionStore.getAppTimeMs());

  // Enforce auth check on initial view if accessed via direct URL
  useEffect(() => {
    const session = electionStore.getActiveSession();
    setActiveSession(session);

    if (currentView === 'PANITIA' && !session) {
      setLoginTargetRole('panitia');
      setLoginModalOpen(true);
    } else if (currentView === 'ADMIN' && (!session || session.role !== 'admin')) {
      setLoginTargetRole('admin');
      setLoginModalOpen(true);
    }
  }, []);

  useEffect(() => {
    // Subscribe to real-time store updates (local & remote WebSocket/BroadcastChannel/HTTP)
    const unsubscribe = electionStore.subscribe(() => {
      setSchool(electionStore.getSchool());
      setPeriods(electionStore.getPeriods());
      const currentActive = electionStore.getActivePeriod();
      setActivePeriod(currentActive);
      setCommittee(electionStore.getCommittee(currentActive.id));
      setAuditLogs(electionStore.getAuditLogs());
      setSummary(electionStore.getSummary(currentActive.id));
      setSyncMeta(electionStore.getSyncMetadata());
      setAppTimeMs(electionStore.getAppTimeMs());
    });

    // Unified 1-second application clock ticker synchronized across all clients
    const clockTimer = setInterval(() => {
      setAppTimeMs(electionStore.getAppTimeMs());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(clockTimer);
    };
  }, []);

  const handleSelectView = (view: AppView) => {
    if (view === 'PANITIA') {
      if (!activeSession) {
        setLoginTargetRole('panitia');
        setLoginModalOpen(true);
        return;
      }
    } else if (view === 'ADMIN') {
      if (!activeSession || activeSession.role !== 'admin') {
        setLoginTargetRole('admin');
        setLoginModalOpen(true);
        return;
      }
    }
    setCurrentView(view);
  };

  const handleLoginSuccess = (session: AuthSession) => {
    setActiveSession(session);
    setLoginModalOpen(false);
    if (loginTargetRole === 'admin') {
      setCurrentView('ADMIN');
    } else if (loginTargetRole === 'panitia') {
      setCurrentView('PANITIA');
    }
  };

  const handleLoginClose = () => {
    setLoginModalOpen(false);
    if (currentView === 'PANITIA' && !activeSession) {
      setCurrentView('PUBLIC');
    } else if (currentView === 'ADMIN' && (!activeSession || activeSession.role !== 'admin')) {
      setCurrentView('PUBLIC');
    }
  };

  const handleLogout = () => {
    electionStore.logout();
    setActiveSession(null);
    if (currentView === 'PANITIA' || currentView === 'ADMIN') {
      setCurrentView('PUBLIC');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 flex flex-col font-sans relative overflow-x-hidden selection:bg-sky-500 selection:text-white">
      {/* Ambient Glassmorphic Background Glow Orbs */}
      <div className="no-print fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-400/25 rounded-full blur-3xl opacity-75 animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-indigo-400/20 rounded-full blur-[120px] opacity-65" />
        <div className="absolute top-2/3 -left-24 w-[28rem] h-[28rem] bg-emerald-400/18 rounded-full blur-[100px] opacity-55" />
        <div className="absolute -bottom-32 right-1/4 w-[36rem] h-[36rem] bg-rose-400/15 rounded-full blur-[130px] opacity-45" />
        {/* Subtle grid refraction pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Cinematic Opening Video Overlay */}
      {showOpeningVideo && (
        <OpeningSequence
          school={school}
          period={activePeriod}
          candidates={electionStore.getCandidates(activePeriod.id)}
          onComplete={() => setShowOpeningVideo(false)}
        />
      )}

      {/* Top Header Navbar */}
      <Navbar
        school={school}
        currentView={currentView}
        onSelectView={handleSelectView}
        appTimeMs={appTimeMs}
        syncMeta={syncMeta}
        activeSession={activeSession}
        onOpenLoginModal={(role) => {
          setLoginTargetRole(role || 'panitia');
          setLoginModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Authentication Login Modal */}
      <AuthLoginModal
        isOpen={loginModalOpen}
        targetRole={loginTargetRole}
        school={school}
        onSuccess={handleLoginSuccess}
        onClose={handleLoginClose}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 print:p-0 print:m-0 print:max-w-none">
        {currentView === 'PUBLIC' && (
          <QuickCountDashboard
            school={school}
            summary={summary}
            appTimeMs={appTimeMs}
            syncMeta={syncMeta}
            onNavigateToBooth={() => setCurrentView('BOOTH')}
          />
        )}

        {currentView === 'BOOTH' && (
          <BilikSuara
            school={school}
            appTimeMs={appTimeMs}
            syncMeta={syncMeta}
            onExitBooth={() => setCurrentView('PUBLIC')}
          />
        )}

        {currentView === 'PANITIA' && (
          activeSession ? (
            <PanitiaDashboard
              school={school}
              period={activePeriod}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Akses Dibatasi untuk Panitia</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Portal Panitia Pemilihan OSIS memerlukan autentikasi masuk terlebih dahulu.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTargetRole('panitia');
                    setLoginModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Login Sebagai Panitia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('PUBLIC')}
                  className="w-full py-2 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Kembali ke Hitung Cepat
                </button>
              </div>
            </div>
          )
        )}

        {currentView === 'ADMIN' && (
          activeSession && activeSession.role === 'admin' ? (
            <AdminDashboard
              school={school}
              periods={periods}
              committee={committee}
              auditLogs={auditLogs}
              summary={summary}
              appTimeMs={appTimeMs}
              syncMeta={syncMeta}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Akses Khusus Administrator</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeSession 
                  ? `Anda saat ini masuk sebagai "${activeSession.name}" (${activeSession.role}). Masuk sebagai Administrator Sekolah untuk membuka panel ini.`
                  : 'Panel Administrasi Sekolah dilindungi kata sandi dan hak akses Administrator.'}
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTargetRole('admin');
                    setLoginModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-900 hover:bg-indigo-950 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Login Sebagai Administrator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('PUBLIC')}
                  className="w-full py-2 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Kembali ke Hitung Cepat
                </button>
              </div>
            </div>
          )
        )}

        {currentView === 'PRD' && (
          <PRDDocument />
        )}
      </main>

      {/* Footer conforming to design constitution: Quiet copyright and institutional info with glass effect */}
      <footer className="no-print relative z-10 border-t border-white/60 glass-panel py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-700">
            {school.type} {school.name} · Sistem Pemilihan Suara Elektronik (E-Pilketos Digital)
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-400 text-[11px]">
            <span>NPSN: {school.npsn}</span>
            <span>·</span>
            <span>Asas Pemilihan LUBER-JURDIL</span>
            <span>·</span>
            <span>Tahun Ajaran {activePeriod.academicYear}</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => setShowOpeningVideo(true)}
              className="text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
            >
              🎬 Putar Video Pembukaan
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
