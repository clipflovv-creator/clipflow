export interface EditorPlayerSkeletonProps {
  videoHeight: number;
}

/**
 * YouTube-style minimal grey moving skeleton.
 * Single unified layout across all platforms.
 */
export function EditorPlayerSkeleton({ videoHeight }: EditorPlayerSkeletonProps) {
  return (
    <div className="w-full flex flex-col gap-0 select-none animate-in fade-in duration-150">
      {/* ── 1. Video Player Stage Skeleton ── */}
      <div
        style={{ height: `${videoHeight}px` }}
        className="w-full flex flex-col items-center justify-center bg-black/60 rounded-2xl border border-white/[0.06] overflow-hidden relative p-3 shrink-0 transition-[height] duration-75"
      >
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Main 16:9 Video Canvas Skeleton */}
          <div
            style={{ aspectRatio: '16/9' }}
            className="relative h-full max-h-full max-w-full w-auto rounded-xl overflow-hidden yt-skeleton border border-white/[0.04]"
          />
        </div>
      </div>

      {/* ── 2. Playback Controls Bar Skeleton ── */}
      <div className="w-full flex flex-col gap-2 pt-2 pb-1 shrink-0">
        {/* Scrubber track line */}
        <div className="w-full h-1 rounded-full yt-skeleton" />

        {/* Controls Row */}
        <div className="w-full flex items-center justify-between pb-1 mt-0.5">
          {/* Left Buttons: Rewind, Play, Forward, Volume */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg yt-skeleton" />
            <div className="w-8 h-8 rounded-lg yt-skeleton" />
            <div className="w-7 h-7 rounded-lg yt-skeleton" />
            <div className="w-6 h-6 rounded-lg yt-skeleton ml-1" />
          </div>

          {/* Center: Time indicator */}
          <div className="w-24 h-4 rounded-md yt-skeleton" />

          {/* Right: Quality / Settings indicator */}
          <div className="w-16 h-5 rounded-md yt-skeleton" />
        </div>
      </div>

      {/* ── 3. Horizontal Splitter Placeholder ── */}
      <div className="relative py-2 z-20 select-none w-full flex items-center">
        <div className="w-full h-[1px] bg-white/[0.06]" />
      </div>

      {/* ── 4. Timeline Track Skeleton ── */}
      <div className="p-3 rounded-2xl bg-[#080808] border border-white/[0.06] shrink-0 space-y-2.5">
        {/* Filmstrip Strip Skeleton */}
        <div className="relative h-[56px] rounded-xl overflow-hidden yt-skeleton border border-white/[0.04]" />

        {/* Bottom Time Marks */}
        <div className="flex items-center justify-between px-1">
          <div className="w-10 h-3 rounded yt-skeleton" />
          <div className="w-16 h-3 rounded yt-skeleton" />
          <div className="w-10 h-3 rounded yt-skeleton" />
        </div>
      </div>
    </div>
  );
}
