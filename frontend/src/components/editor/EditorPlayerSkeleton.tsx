import { motion } from 'framer-motion';
import { Film, Sparkles } from 'lucide-react';
import type { VideoPlatform } from '../../utils/platforms';

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={className}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export interface EditorPlayerSkeletonProps {
  videoHeight: number;
  platform?: VideoPlatform;
}

export function EditorPlayerSkeleton({ videoHeight, platform = 'youtube' }: EditorPlayerSkeletonProps) {
  const isYT = platform === 'youtube';
  const isTV = platform === 'twitch';
  const isIG = platform === 'instagram';
  const isTW = platform === 'twitter';

  // Platform specific design configurations
  const config = {
    youtube: {
      name: 'YouTube',
      tag: 'YouTube HD Stream',
      aspectRatio: '16/9',
      borderGlow: 'border-red-500/25 shadow-[0_0_35px_rgba(239,68,68,0.08)]',
      badgeBg: 'bg-red-500/15 border-red-500/30 text-red-300',
      pingColor: 'bg-red-500',
      icon: <YoutubeIcon className="text-[#ff0000]" />,
      centerGlow: 'bg-red-600/20 border-red-500/30 text-red-400',
      statusText: 'Connecting to YouTube stream & audio tracks...',
      resPill: '1080p 60fps',
    },
    twitch: {
      name: 'Twitch',
      tag: 'Twitch Stream / DVR VOD',
      aspectRatio: '16/9',
      borderGlow: 'border-purple-500/25 shadow-[0_0_35px_rgba(168,85,247,0.09)]',
      badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
      pingColor: 'bg-purple-400',
      icon: <TwitchIcon className="text-[#a855f7]" />,
      centerGlow: 'bg-purple-600/20 border-purple-500/30 text-purple-300',
      statusText: 'Resolving Twitch HLS stream chunks & video tiers...',
      resPill: 'Source (1080p60)',
    },
    instagram: {
      name: 'Instagram',
      tag: 'Instagram Reel',
      aspectRatio: '9/16',
      borderGlow: 'border-pink-500/25 shadow-[0_0_40px_rgba(236,72,153,0.1)]',
      badgeBg: 'bg-pink-500/15 border-pink-500/30 text-pink-300',
      pingColor: 'bg-pink-400',
      icon: <InstagramIcon className="text-[#ec4899]" />,
      centerGlow: 'bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 border-pink-500/30 text-pink-300',
      statusText: 'Extracting Instagram Reel & direct audio stream...',
      resPill: '9:16 Vertical (1080p)',
    },
    twitter: {
      name: 'Twitter / X',
      tag: 'X / Twitter Post',
      aspectRatio: '16/9',
      borderGlow: 'border-sky-500/25 shadow-[0_0_35px_rgba(56,189,248,0.08)]',
      badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
      pingColor: 'bg-sky-400',
      icon: <TwitterIcon className="text-[#38bdf8]" />,
      centerGlow: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
      statusText: 'Parsing Twitter video bitrate & media streams...',
      resPill: '720p HD',
    },
    generic: {
      name: 'Video',
      tag: 'Direct Stream',
      aspectRatio: '16/9',
      borderGlow: 'border-blue-500/25 shadow-[0_0_35px_rgba(59,130,246,0.08)]',
      badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
      pingColor: 'bg-blue-400',
      icon: <Film className="w-3.5 h-3.5 text-blue-400" />,
      centerGlow: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
      statusText: 'Buffering direct video & timeline data...',
      resPill: '1080p Full HD',
    },
  }[platform] || {
    name: 'Video',
    tag: 'Direct Stream',
    aspectRatio: '16/9',
    borderGlow: 'border-white/10',
    badgeBg: 'bg-white/10 border-white/15 text-white',
    pingColor: 'bg-white',
    icon: <Film className="w-3.5 h-3.5 text-zinc-300" />,
    centerGlow: 'bg-white/10 border-white/20 text-white',
    statusText: 'Loading video streams...',
    resPill: 'HD',
  };

  return (
    <div className="w-full flex flex-col gap-0 select-none animate-in fade-in duration-200">
      {/* ── 1. Video Player Stage Skeleton ── */}
      <div
        style={{ height: `${videoHeight}px` }}
        className="w-full flex flex-col items-center justify-center bg-black/70 rounded-2xl border border-white/[0.07] overflow-hidden relative p-3 shadow-inner shrink-0 select-none transition-[height] duration-75"
      >
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Canvas Wrapper matching exact aspect ratio */}
          <div
            style={{ aspectRatio: config.aspectRatio }}
            className={`relative h-full max-h-full max-w-full w-auto bg-[#070707] rounded-xl overflow-hidden flex items-center justify-center border transition-all duration-200 select-none ${config.borderGlow}`}
          >
            {/* Shimmer Sweep Animation Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

            {/* Subtle background grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Top-Left: Platform Badge with Pulsing Ping */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border shadow-lg">
              <span className="shrink-0">{config.icon}</span>
              <span className={`text-[11px] font-semibold tracking-wide ${config.badgeBg.split(' ').find(c => c.startsWith('text-')) || 'text-white'}`}>
                {config.tag}
              </span>
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pingColor}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.pingColor}`} />
              </span>
            </div>

            {/* Top-Right: Target Resolution Badge */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 border border-white/10 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-mono font-medium text-zinc-300">{config.resPill}</span>
            </div>

            {/* Instagram Reels Vertical Action Buttons Skeleton */}
            {isIG && (
              <div className="absolute right-3 bottom-14 flex flex-col items-center gap-3 z-10 pointer-events-none">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 animate-pulse" />
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 animate-pulse" />
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 animate-pulse" />
              </div>
            )}

            {/* Center: Glowing Platform Icon & Pulsing Radar */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-3 px-6 text-center max-w-sm">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-2xl relative ${config.centerGlow}`}>
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  className="shrink-0"
                >
                  {isYT && <YoutubeIcon className="w-7 h-7 text-red-500" />}
                  {isTV && <TwitchIcon className="w-7 h-7 text-purple-400" />}
                  {isIG && <InstagramIcon className="w-7 h-7 text-pink-400" />}
                  {isTW && <TwitterIcon className="w-7 h-7 text-sky-400" />}
                  {!isYT && !isTV && !isIG && !isTW && <Film className="w-7 h-7 text-blue-400" />}
                </motion.div>
                <div className="absolute -inset-1 rounded-2xl bg-white/[0.05] animate-ping pointer-events-none opacity-20" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-200 tracking-wide">
                  {config.statusText}
                </p>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                  <span>Preparing player stage</span>
                  <span className="inline-block animate-pulse font-bold">•</span>
                  <span>Syncing audio tracks</span>
                </div>
              </div>
            </div>

            {/* Bottom-Left: Skeleton Timecode & Duration */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
              <div className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span>00:00 / --:--</span>
              </div>
            </div>

            {/* Bottom-Right: Aspect Pill */}
            <div className="absolute bottom-3 right-3 z-10">
              <div className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[10px] font-mono text-zinc-500 uppercase">
                {isIG ? '9:16' : '16:9'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Playback Controls Bar Skeleton ── */}
      <div className="w-full flex flex-col gap-1.5 pt-2 pb-1 shrink-0">
        {/* Scrubber track line skeleton with moving gradient shimmer */}
        <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>

        {/* Controls row */}
        <div className="w-full flex items-center justify-between pb-1 relative mt-1">
          {/* Left Buttons: Rewind, Play, Forward, Volume */}
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-7 rounded-lg bg-white/[0.05] border border-white/[0.04] animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.06] animate-pulse flex items-center justify-center">
              <div className="w-3 h-3 bg-white/30 rounded-xs" />
            </div>
            <div className="w-12 h-7 rounded-lg bg-white/[0.05] border border-white/[0.04] animate-pulse" />
            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.04] ml-1 animate-pulse" />
          </div>

          {/* Center: Time indicator skeleton */}
          <div className="w-28 h-7 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center animate-pulse">
            <span className="text-[10px] font-mono text-zinc-500">00:00 / 00:00</span>
          </div>

          {/* Right: Quality dropdown skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-7 rounded-lg bg-white/[0.05] border border-white/[0.06] animate-pulse flex items-center justify-center">
              <span className="text-[10px] font-mono text-zinc-500">{isTV ? 'Source' : '1080p'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Horizontal Splitter Placeholder ── */}
      <div className="relative py-2.5 z-20 select-none w-full flex items-center">
        <div className="w-full h-[2px] bg-white/[0.08]" />
      </div>

      {/* ── 4. Editor Timeline Skeleton ── */}
      <div className="space-y-2.5 p-3 rounded-2xl bg-[#080808] border border-white/[0.06] shrink-0 shadow-lg select-none">
        {/* Filmstrip with 10 frame blocks and trim range outline */}
        <div className="relative h-[56px] rounded-xl overflow-hidden border border-white/[0.07] bg-black/60 flex">
          {/* Shimmer sweep across timeline */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full animate-[shimmer_2.2s_infinite]" />

          {/* 10 Mock frame placeholders */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="relative h-full flex-1 border-r border-white/[0.06] bg-zinc-950/60 overflow-hidden flex items-center justify-center"
            >
              <div className="w-4 h-4 rounded bg-white/[0.03]" />
            </div>
          ))}

          {/* Simulated Trim Selection Range */}
          <div className="absolute inset-y-0 left-[12%] right-[15%] border-2 border-white/25 bg-white/[0.03] rounded-lg flex items-center justify-between pointer-events-none z-20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <div className="w-2.5 h-full bg-white/40 rounded-l flex items-center justify-center">
              <div className="w-0.5 h-3 bg-black/60 rounded" />
            </div>
            {/* Playhead needle */}
            <div className="absolute left-[35%] inset-y-0 w-0.5 bg-white shadow-[0_0_8px_white]" />
            <div className="w-2.5 h-full bg-white/40 rounded-r flex items-center justify-center">
              <div className="w-0.5 h-3 bg-black/60 rounded" />
            </div>
          </div>
        </div>

        {/* Timeline Bottom Indicators: Start / Duration / End */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <span>00:00</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-400">
            Scanning timeline...
          </div>
          <div className="flex items-center gap-1.5">
            <span>--:--</span>
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
