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
import { Vote, Layers, BarChart3, Users, Building2, BookOpen, Film } from 'lucide-react';
import { SchoolConfig } from '../types';

export type AppView = 'PUBLIC' | 'BOOTH' | 'PANITIA' | 'ADMIN' | 'PRD';

interface NavbarProps {
  school: SchoolConfig;
  currentView: AppView;
  onSelectView: (view: AppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  school,
  currentView,
  onSelectView,
}) => {
  return (
    <header className="no-print sticky top-0 z-40 glass-nav">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 py-3">
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
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">
              {school.type} {school.name}
            </span>
          </div>
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Navigation Links in Glass Segmented Bar */}
        <nav className="hidden md:flex items-center gap-1 p-1 glass-tab-bar rounded-2xl">
          <button
            onClick={() => onSelectView('PUBLIC')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'PUBLIC'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Papan Hitung Cepat
          </button>

          <button
            onClick={() => onSelectView('BOOTH')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'BOOTH'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Bilik Suara
          </button>

          <button
            onClick={() => onSelectView('PANITIA')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'PANITIA'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Portal Panitia
          </button>

          <button
            onClick={() => onSelectView('ADMIN')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              currentView === 'ADMIN'
                ? 'bg-white text-sky-600 shadow-xs font-bold border border-white/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            Admin Sekolah
          </button>


        </nav>

        {/* Zone 3: 1 Primary Action with Specular Glass Light Accent */}
        <div className="flex items-center gap-3 shrink-0">
          {currentView !== 'BOOTH' ? (
            <button
              onClick={() => onSelectView('BOOTH')}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900/95 hover:bg-sky-600 rounded-xl transition-all shadow-md shadow-slate-900/10 border border-white/20 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transform hover:scale-102 active:scale-98"
            >
              <Vote className="w-3.5 h-3.5 text-sky-400" />
              <span>Bilik Suara Siswa</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectView('PUBLIC')}
              className="px-4 py-2 text-xs font-bold text-slate-700 glass-button rounded-xl transition-all shadow-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
              <span>Lihat Quick Count</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar in Frosted Glass */}
      <div className="md:hidden flex items-center gap-1.5 border-t border-white/40 bg-white/60 backdrop-blur-xl py-2 px-3 text-[11px] font-semibold text-slate-600 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => onSelectView('PUBLIC')}
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
          onClick={() => onSelectView('BOOTH')}
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
          onClick={() => onSelectView('PANITIA')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            currentView === 'PANITIA'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Portal Panitia
        </button>
        <button
          type="button"
          onClick={() => onSelectView('ADMIN')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            currentView === 'ADMIN'
              ? 'text-sky-600 bg-white/95 shadow-2xs font-bold border border-white/80'
              : 'hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Admin Sekolah
        </button>

      </div>
    </header>
  );
};
