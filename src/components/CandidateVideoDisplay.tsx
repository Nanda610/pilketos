/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Candidate Video Player Display Component
 * Supports HTML5 videos (mp4/webm/data URLs), YouTube iframe embeds,
 * and fallback interactive video speech simulator.
 */

import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Video } from 'lucide-react';
import { Candidate } from '../types';

interface CandidateVideoDisplayProps {
  candidate: Candidate;
  title?: string;
  autoPlay?: boolean;
}

export const CandidateVideoDisplay: React.FC<CandidateVideoDisplayProps> = ({
  candidate,
  title = 'Video Orasi & Kampanye Paslon',
  autoPlay = false,
}) => {
  const [isPlayingSim, setIsPlayingSim] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [simProgress] = useState(45);

  const url = candidate.videoUrl?.trim() || '';

  // Check if YouTube URL
  const getYouTubeEmbed = (videoUrl: string) => {
    if (!videoUrl) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = videoUrl.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=${autoPlay ? 1 : 0}&rel=0`;
    }
    return null;
  };

  const ytEmbed = getYouTubeEmbed(url);
  const isDirectVideo = url.startsWith('data:video') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Video className="w-4 h-4 text-sky-600" />
          <span>{title}</span>
        </h4>
        <span className="text-[11px] text-sky-600 font-semibold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
          Paslon 0{candidate.ballotNumber}
        </span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video shadow-lg">
        {ytEmbed ? (
          <iframe
            src={ytEmbed}
            title={`Video Orasi ${candidate.chairmanName} & ${candidate.viceChairmanName}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isDirectVideo ? (
          <video
            src={url}
            controls
            autoPlay={autoPlay}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Simulated Interactive Speech Video Player */
          <div className="w-full h-full flex flex-col justify-between p-4 text-white">
            {!isPlayingSim ? (
              <div className="my-auto flex flex-col items-center justify-center text-center p-4">
                <button
                  type="button"
                  onClick={() => setIsPlayingSim(true)}
                  className="w-16 h-16 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center mb-3 shadow-xl hover:scale-105 transition-all cursor-pointer"
                  title="Putar Video Kampanye"
                >
                  <Play className="w-7 h-7 ml-1 fill-current" />
                </button>
                <p className="text-sm font-bold text-white">
                  Putar Orasi & Visi Misi Paslon No. {candidate.ballotNumber}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {candidate.chairmanName} ({candidate.chairmanClass}) & {candidate.viceChairmanName} ({candidate.viceChairmanClass})
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-between">
                {/* Top bar */}
                <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-slate-800">
                  <span className="font-bold text-sky-400">
                    ORASI RESMI · PASLON 0{candidate.ballotNumber}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlayingSim(false)}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtitles & Audio Waveform */}
                <div className="my-auto space-y-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-6 bg-sky-400 animate-pulse rounded-full"></span>
                    <span className="w-1.5 h-10 bg-sky-500 animate-pulse rounded-full delay-75"></span>
                    <span className="w-1.5 h-5 bg-sky-300 animate-pulse rounded-full delay-150"></span>
                    <span className="w-1.5 h-8 bg-sky-400 animate-pulse rounded-full delay-100"></span>
                    <span className="w-1.5 h-4 bg-sky-500 animate-pulse rounded-full delay-200"></span>
                  </div>

                  <div className="bg-slate-900/95 p-3 rounded-2xl border border-sky-500/30 max-w-md mx-auto shadow-xl">
                    <p className="text-xs font-semibold text-sky-200 italic leading-relaxed">
                      "{candidate.chairmanName}: '{candidate.vision}'"
                    </p>
                  </div>
                </div>

                {/* Video controls bottom */}
                <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-xl backdrop-blur-xs border border-slate-800">
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${simProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>01:45 / 03:20</span>
                    <button
                      type="button"
                      onClick={() => setIsPlayingSim(false)}
                      className="hover:text-white flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Ulangi Video</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
