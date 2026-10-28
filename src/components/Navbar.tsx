/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Top Bar Navigation adhering strictly to the Top Bar Contract:
 * Zone 1: Single-element brand wordmark
 * Zone 2: 4-5 clean single-line nav links
 * Zone 3: 1 primary action button
 */

import React from 'react';
import { Vote, BarChart3, Clock, Radio, Lock, LogOut, ShieldCheck, Users } from 'lucide-react';
import { SchoolConfig, RealtimeSyncMetadata, AuthSession, UserRole } from '../types';
import { formatAppTimeDisplay } from '../lib/realtimeSync';
import { BloggerIcon } from './BloggerIcon';

export type AppView = 'PUBLIC' | 'BOOTH' | 'PANITIA' | 'ADMIN' | 'PRD';

interface NavbarProps {
  school: SchoolConfig;
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  appTimeMs: number;
  syncMeta: RealtimeSyncMetadata;
  activeSession?: AuthSession | null;
  onOpenLoginModal?: (targetRole?: UserRole) => void;
  onLogout?: () => void;
  onOpenShareBlogger?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  school,
  currentView,
  onSelectView,
  appTimeMs,
  syncMeta,
  activeSession,
  onOpenLoginModal,
  onLogout,
  onOpenShareBlogger,
}) => {
  const formattedClock = formatAppTimeDisplay(appTimeMs);

  const handleNavClick = (view: AppView) => {
    if (view === 'PANITIA') {
      if (!activeSession) {
        onOpenLoginModal?.('panitia');
        return;
      }
      onSelectView('PANITIA');
    } else if (view === 'ADMIN') {
      if (!activeSession || activeSession.role !== 'admin') {
        onOpenLoginModal?.('admin');
        return;
      }
      onSelectView('ADMIN');
    } else {
      onSelectView(view);
    }
  };

  return (
    <header className="no-print sticky top-0 z-40 glass-nav">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
        {/* Zone 1: Brand Wordmark (Single text element with glass emblem) */}
        <button
          onClick={() => onSelectView('PUBLIC')}
          className="text-left whitespace-nowrap shrink-0 group flex items-center gap-2.5 cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-900/90 text-sky-400 flex items-center justify-center font-black text-sm shadow-md shadow-sky-500/10 border border-white/20 group-hover:scale-105 transition-transform">
            <Vote className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors leading-none">
              E-Pilketos Digital
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide" data-testid="navbar-school-name">
              {school.type} {school.name}
            </span>
          </div>
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links in Glass Segmented Bar */}
        <nav className="hidden md:flex items-center gap-1 p-1 glass-tab-bar rounded-2xl">
          <button
            onClick={() => handleNavClick('PUBLIC')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'PUBLIC'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Papan Hitung Cepat
          </button>

          <button
            onClick={() => handleNavClick('BOOTH')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'BOOTH'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Bilik Suara
          </button>

          <button
            onClick={() => handleNavClick('PANITIA')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              currentView === 'PANITIA'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            {!activeSession && <Lock className="w-3 h-3 text-slate-400" />}
            <span>Portal Panitia</span>
          </button>

          <button
            onClick={() => handleNavClick('ADMIN')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              currentView === 'ADMIN'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            {(!activeSession || activeSession.role !== 'admin') && <Lock className="w-3 h-3 text-slate-400" />}
            <span>Admin Sekolah</span>
          </button>
        </nav>

        {/* Zone 3: Clock + Login/Session Status + Primary Action */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* User Session Pill or Login Trigger */}
          {activeSession ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs border border-white/10">
              {activeSession.role === 'admin' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              ) : (
                <Users className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              )}
              <span className="hidden lg:inline text-[11px] font-bold">
                {activeSession.role === 'admin' ? 'Admin' : 'Panitia'}
              </span>
              <button
                type="button"
                onClick={onLogout}
                title="Keluar / Logout"
                className="ml-1 text-slate-300 hover:text-rose-300 p-0.5 rounded cursor-pointer transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenLoginModal?.('panitia')}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300/80 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Masuk sebagai Panitia atau Admin"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Login Petugas</span>
            </button>
          )}



          {/* Unified Application Clock & Online Sync Indicator */}
          <div
            className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/85 border border-slate-200/80 shadow-2xs text-[11px] sm:text-xs"
            title={`Sinkronisasi Real-Time (${syncMeta.transport}) · Revisi #${syncMeta.revision} · ${syncMeta.onlineClients} Perangkat Terhubung`}
            data-testid="unified-app-clock"
          >
            <span className="inline-flex items-center gap-1 sm:gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Radio className="w-3 h-3 text-emerald-600 hidden xl:inline" />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-extrabold">Online</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600" />
              <span data-testid="app-clock-time">{formattedClock.timeString}</span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 hidden xs:inline">WIB</span>
            </span>
          </div>

          {currentView !== 'BOOTH' ? (
            <button
              onClick={() => handleNavClick('BOOTH')}
              className="px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-slate-900/95 hover:bg-sky-600 rounded-xl transition-all shadow-md shadow-slate-900/10 border border-white/20 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transform hover:scale-102 active:scale-98"
            >
              <Vote className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Bilik Suara Siswa</span>
              <span className="sm:hidden">Bilik</span>
            </button>
          ) : (
            <button
              onClick={() => handleNavClick('PUBLIC')}
              className="px-3.5 sm:px-4 py-2 text-xs font-bold text-slate-700 glass-button rounded-xl transition-all shadow-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
              <span>Quick Count</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar in Frosted Glass */}
      <div className="md:hidden flex items-center gap-1.5 border-t border-white/40 bg-white/60 backdrop-blur-xl py-2 px-3 text-[11px] font-semibold text-slate-600 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => handleNavClick('PUBLIC')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            currentView === 'PUBLIC'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Papan Hitung Cepat
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('BOOTH')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            currentView === 'BOOTH'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Bilik Suara
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('PANITIA')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
            currentView === 'PANITIA'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          {!activeSession && <Lock className="w-2.5 h-2.5 text-slate-400" />}
          <span>Portal Panitia</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('ADMIN')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
            currentView === 'ADMIN'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          {(!activeSession || activeSession.role !== 'admin') && <Lock className="w-2.5 h-2.5 text-slate-400" />}
          <span>Admin Sekolah</span>
        </button>



        {activeSession ? (
          <button
            type="button"
            onClick={onLogout}
            className="ml-auto px-2.5 py-1.5 rounded-xl bg-slate-900 text-rose-300 font-bold whitespace-nowrap flex items-center gap-1 text-[10px]"
          >
            <LogOut className="w-3 h-3" />
            <span>Keluar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenLoginModal?.('panitia')}
            className="ml-auto px-2.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold whitespace-nowrap flex items-center gap-1 text-[10px]"
          >
            <Lock className="w-3 h-3" />
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
