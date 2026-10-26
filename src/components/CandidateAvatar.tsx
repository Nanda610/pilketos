/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Official Candidate & School Crest Visual Components
 * Styled vector graphics providing resilient, zero-broken-image institutional branding.
 */

import React from 'react';

interface CandidateAvatarProps {
  ballotNumber: number;
  chairmanName: string;
  viceChairmanName: string;
  chairmanPhotoUrl?: string;
  viceChairmanPhotoUrl?: string;
  photoUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const CandidateAvatar: React.FC<CandidateAvatarProps> = ({
  ballotNumber,
  chairmanName,
  viceChairmanName,
  chairmanPhotoUrl,
  viceChairmanPhotoUrl,
  photoUrl,
  className = '',
  size = 'md',
}) => {
  // Color palette per paslon number
  const palettes = [
    { bg: 'from-blue-600 via-indigo-700 to-slate-900', accent: 'bg-blue-500', badge: 'bg-blue-600' },
    { bg: 'from-emerald-600 via-teal-700 to-slate-900', accent: 'bg-emerald-500', badge: 'bg-emerald-600' },
    { bg: 'from-amber-600 via-rose-700 to-slate-900', accent: 'bg-amber-500', badge: 'bg-amber-600' },
    { bg: 'from-purple-600 via-violet-700 to-slate-900', accent: 'bg-purple-500', badge: 'bg-purple-600' },
  ];

  const palette = palettes[(ballotNumber - 1) % palettes.length];

  const sizeClasses = {
    sm: 'h-24 w-18',
    md: 'h-48 w-36',
    lg: 'h-64 w-48',
    xl: 'h-80 w-60',
  }[size];

  const circleSizeClass = {
    sm: 'w-7 h-7',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  }[size];

  const iconSizeClass = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
    xl: 'w-11 h-11',
  }[size];

  const chairmanImg = chairmanPhotoUrl || photoUrl;
  const viceChairmanImg = viceChairmanPhotoUrl;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b ${palette.bg} shadow-md flex flex-col items-center justify-between p-3 select-none ${sizeClasses} ${className}`}
      style={{ aspectRatio: '3/4' }}
    >
      {/* Official Watermark Crest */}
      <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-40 h-40 text-white fill-current">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M50 15 L60 38 L85 38 L65 53 L73 78 L50 63 L27 78 L35 53 L15 38 L40 38 Z" />
        </svg>
      </div>

      {/* Top Ballot Badge */}
      <div className="z-10 w-full flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
          PASLON
        </span>
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-white text-slate-900 font-bold text-sm shadow">
          {ballotNumber < 10 ? `0${ballotNumber}` : ballotNumber}
        </span>
      </div>

      {/* Center Student Photo or Silhouette Duo */}
      <div className="z-10 flex items-end justify-center gap-1.5 my-auto w-full px-1">
        {/* Chairman */}
        <div className="flex flex-col items-center">
          <div className={`${circleSizeClass} rounded-full border-2 border-white/80 bg-white/20 overflow-hidden flex items-center justify-center text-white shadow-md relative`}>
            {chairmanImg ? (
              <img src={chairmanImg} alt={chairmanName} className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className={iconSizeClass}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          <span className="text-[9px] text-white/90 font-bold mt-1 truncate max-w-[65px] text-center">
            {chairmanName.split(' ')[0]}
          </span>
        </div>

        {/* Plus divider */}
        <span className="text-white/70 text-xs font-black mb-3">&</span>

        {/* Vice Chairman */}
        <div className="flex flex-col items-center">
          <div className={`${circleSizeClass} rounded-full border-2 border-white/80 bg-white/20 overflow-hidden flex items-center justify-center text-white shadow-md relative`}>
            {viceChairmanImg ? (
              <img src={viceChairmanImg} alt={viceChairmanName} className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className={iconSizeClass}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          <span className="text-[9px] text-white/90 font-bold mt-1 truncate max-w-[65px] text-center">
            {viceChairmanName.split(' ')[0]}
          </span>
        </div>
      </div>

      {/* Bottom Bar: Formal Student Council Banner */}
      <div className="z-10 w-full bg-slate-900/85 backdrop-blur-xs rounded-lg p-1.5 text-center border border-white/10">
        <p className="text-[10px] font-semibold text-white truncate">
          {chairmanName}
        </p>
        <p className="text-[9px] text-slate-300 truncate">
          & {viceChairmanName}
        </p>
      </div>
    </div>
  );
};

export const SchoolCrestLogo: React.FC<{
  size?: number;
  width?: number;
  height?: number;
  type?: 'OSIS' | 'OSIM';
  logoUrl?: string;
  className?: string;
  aspectRatio?: '2x3' | '1x1';
}> = ({
  size = 48,
  width,
  height,
  type = 'OSIS',
  logoUrl,
  className = '',
  aspectRatio = '2x3',
}) => {
  const finalWidth = width || size;
  const finalHeight = height || (aspectRatio === '2x3' ? Math.round(finalWidth * 1.5) : finalWidth);

  if (logoUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-transparent flex-shrink-0 ${className}`}
        style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
      >
        <img src={logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain filter drop-shadow-2xs" />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm flex-shrink-0 overflow-hidden ${className}`}
      style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
    >
      <svg
        viewBox="0 0 48 48"
        className="w-3/4 h-3/4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M24 4L6 11V22C6 33.05 13.68 43.34 24 46C34.32 43.34 42 33.05 42 22V11L24 4Z"
          fill="#1E293B"
          stroke="#38BDF8"
          strokeWidth="2"
        />
        <path
          d="M16 26C18 24.5 21 24.5 24 26C27 24.5 30 24.5 32 26V32C30 30.5 27 30.5 24 32C21 30.5 18 30.5 16 32V26Z"
          fill="#F8FAFC"
        />
        <path
          d="M24 12V22M21 16L24 13L27 16"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute bottom-0.5 right-1 text-[7.5px] font-extrabold px-1 rounded bg-amber-500 text-slate-950 uppercase tracking-tighter">
        {type}
      </span>
    </div>
  );
};

export const OsisLogoBadge: React.FC<{
  size?: number;
  width?: number;
  height?: number;
  type?: 'OSIS' | 'OSIM';
  logoUrl?: string;
  className?: string;
  aspectRatio?: '2x3' | '1x1';
}> = ({
  size = 48,
  width,
  height,
  type = 'OSIS',
  logoUrl,
  className = '',
  aspectRatio = '2x3',
}) => {
  const finalWidth = width || size;
  const finalHeight = height || (aspectRatio === '2x3' ? Math.round(finalWidth * 1.5) : finalWidth);

  if (logoUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-transparent flex-shrink-0 ${className}`}
        style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
      >
        <img src={logoUrl} alt={`Logo ${type}`} className="w-full h-full object-contain filter drop-shadow-2xs" />
      </div>
    );
  }

  if (type === 'OSIM') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-lg bg-emerald-900 border-2 border-emerald-600 text-white shadow-2xs flex-shrink-0 p-1 overflow-hidden ${className}`}
        style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
      >
        <span className="w-full h-full flex flex-col items-center justify-center relative">
          <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
            <polygon
              points="24,2 29,14 42,14 31,23 35,36 24,28 13,36 17,23 6,14 19,14"
              fill="#065F46"
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
            <circle cx="24" cy="24" r="10" fill="#047857" stroke="#FDE68A" strokeWidth="1" />
            <path d="M18 25C20 23.5 22 23.5 24 25C26 23.5 28 23.5 30 25V29C28 27.5 26 27.5 24 29C22 27.5 20 27.5 18 29V25Z" fill="#FFFFFF" />
            <path d="M24 16V22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="absolute bottom-0.5 font-black text-[7px] tracking-widest text-amber-300 font-sans">
            OSIM
          </span>
        </span>
      </div>
    );
  }

  // Official Kemendikbud OSIS Emblem
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-lg bg-amber-500 border-2 border-amber-600 text-white shadow-2xs flex-shrink-0 p-1 overflow-hidden ${className}`}
      style={{ width: `${finalWidth}px`, height: `${finalHeight}px` }}
    >
      <span className="w-full h-full flex flex-col items-center justify-center relative">
        <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
          <circle cx="24" cy="24" r="22" fill="#D97706" />
          <circle cx="24" cy="24" r="19" fill="#92400E" stroke="#FDE68A" strokeWidth="1" />
          <path d="M15 28C18 26 21 26 24 28C27 26 30 26 33 28V33C30 31 27 31 24 33C21 31 18 31 15 33V28Z" fill="#FFFFFF" />
          <path d="M16 23C19 20 29 20 32 23" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M17 21C20 18.5 28 18.5 31 21" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M24 11V25" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M22 13C22 10 24 9 24 9C24 9 26 10 26 13C26 14.5 25 15.5 24 15.5C23 15.5 22 14.5 22 13Z" fill="#DC2626" />
        </svg>
        <span className="absolute bottom-0.5 font-black text-[7.5px] tracking-wider text-white font-sans drop-shadow-xs">
          OSIS
        </span>
      </span>
    </div>
  );
};

