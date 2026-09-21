import * as Slider from '@radix-ui/react-slider';
import { Clock } from 'lucide-react';

interface EditorTimelineProps {
  sliderWrapRef: React.RefObject<HTMLDivElement | null>;
  isTrimEnabled: boolean;
  trimRange: [number, number];
  setTrimRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  currentTime: number;
  effectiveDuration: number;
  youtubeId: string | null;
  thumbnail: string;
  isSeekingRef: React.RefObject<boolean>;
  pendingSeekTimeRef: React.RefObject<number | null>;
  lastSeekTimeRef: React.RefObject<number>;
  setCurrentTime: (time: number) => void;
  pauseAndSeek: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  isPlayingRef: React.RefObject<boolean>;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  youtubePlayerRef: React.RefObject<any>;
}

function formatTime(seconds: number, includeDecimals: boolean = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  if (h > 0) {
    const main = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return includeDecimals ? `${main}.${ms}` : main;
  }
  const main = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return includeDecimals ? `${main}.${ms}` : main;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const cleanStr = String(timeStr).trim();
  const parts = cleanStr.split(':').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(cleanStr) || 0;
}

export function EditorTimeline({
  sliderWrapRef,
  isTrimEnabled,
  trimRange,
  setTrimRange,
  currentTime,
  effectiveDuration,
  youtubeId,
  thumbnail,
  isSeekingRef,
  pendingSeekTimeRef,
  lastSeekTimeRef,
  setCurrentTime,
  pauseAndSeek,
  setIsPlaying,
  isPlayingRef,
  videoElementRef,
  youtubePlayerRef,
}: EditorTimelineProps) {
  const startPct = effectiveDuration > 0 ? (trimRange[0] / effectiveDuration) * 100 : 0;
  const widthPct = effectiveDuration > 0 ? ((trimRange[1] - trimRange[0]) / effectiveDuration) * 100 : 100;
  const currentPct = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className="space-y-2.5 p-3 rounded-2xl bg-[#080808] border border-white/[0.06] shrink-0 shadow-lg select-none">
      {/* Filmstrip with slider overlay */}
      <div
        className={`relative h-[56px] rounded-xl overflow-hidden border border-white/[0.07] transition-opacity ${
          !isTrimEnabled ? 'opacity-50' : 'opacity-100'
        }`}
        ref={sliderWrapRef as any}
      >
        {/* Film background with real time-based frames */}
        <div className="absolute inset-0 bg-black flex overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => {
            const totalDur = effectiveDuration > 0 ? effectiveDuration : 12;
            const frameTimeSec = (totalDur / 10) * (i + 0.5);
            const timeStr = formatTime(frameTimeSec, totalDur <= 15);

            const ytSlot = i < 3 ? '1' : i < 7 ? '2' : '3';
            const ytFallback = youtubeId
              ? `https://img.youtube.com/vi/${youtubeId}/${ytSlot}.jpg`
              : thumbnail || '';
            const frameUrl = ytFallback;

            return (
              <div
                key={i}
                className="relative h-full flex-1 border-r border-white/[0.08] bg-zinc-950/80 overflow-hidden group"
              >
                <img
                  src={frameUrl}
                  onError={(e) => {
                    if (e.currentTarget.src !== ytFallback && ytFallback) {
                      e.currentTarget.src = ytFallback;
                    }
                  }}
                  className="h-full w-full object-cover opacity-50 group-hover:opacity-80 transition-opacity"
                  alt={`Frame at ${timeStr}`}
                />
                <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-white/90 bg-black/75 backdrop-blur-xs px-1 py-0.2 rounded border border-white/10 pointer-events-none select-none">
                  {timeStr}
                </span>
              </div>
            );
          })}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 36px)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none" />
        </div>

        {/* Selected region highlight */}
        {isTrimEnabled ? (
          <div
            className="absolute top-0 bottom-0 bg-white/20 border-x-2 border-white/80 z-10 pointer-events-none"
            style={{
              left: `${startPct}%`,
              width: `${Math.max(widthPct, 0.5)}%`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-white/10 border-x-2 border-white/30 z-10 pointer-events-none" />
        )}

        {/* Synchronized Live Playhead Needle */}
        {effectiveDuration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-15 pointer-events-none transition-[left] duration-75 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
            style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
          >
            <div className="w-2.5 h-2.5 -left-[4px] -top-0.5 absolute bg-red-500 rounded-full shadow-md" />
          </div>
        )}

        {/* Radix Slider overlay */}
        {isTrimEnabled && (
          <Slider.Root
            className="absolute inset-0 flex items-center z-20 cursor-pointer"
            value={trimRange}
            min={0}
            max={effectiveDuration > 0 ? effectiveDuration : 10}
            step={effectiveDuration <= 30 ? 0.1 : 0.5}
            minStepsBetweenThumbs={0.1}
            onValueChange={(val) => {
              (isSeekingRef as any).current = true;
              (lastSeekTimeRef as any).current = Date.now();
              setTrimRange([val[0], val[1]]);
              setIsPlaying(false);
              (isPlayingRef as any).current = false;
              if (videoElementRef.current && !videoElementRef.current.paused) {
                try { videoElementRef.current.pause(); } catch (e) { }
              }
              if (youtubeId && youtubePlayerRef.current) {
                try { youtubePlayerRef.current.pauseVideo(); } catch (e) { }
              }

              if (val[0] !== trimRange[0]) {
                setCurrentTime(val[0]);
                (pendingSeekTimeRef as any).current = val[0];
                if (youtubeId && youtubePlayerRef.current) {
                  try { youtubePlayerRef.current.seekTo(val[0], true); } catch {}
                } else if (videoElementRef.current) {
                  try { videoElementRef.current.currentTime = val[0]; } catch {}
                }
              } else if (val[1] !== trimRange[1]) {
                setCurrentTime(val[1]);
                (pendingSeekTimeRef as any).current = val[1];
                if (youtubeId && youtubePlayerRef.current) {
                  try { youtubePlayerRef.current.seekTo(val[1], true); } catch {}
                } else if (videoElementRef.current) {
                  try { videoElementRef.current.currentTime = val[1]; } catch {}
                }
              }
            }}
            onValueCommit={(val) => {
              setTrimRange([val[0], val[1]]);
              pauseAndSeek(val[0]);
            }}
          >
            <Slider.Track className="relative flex-grow h-full rounded-xl cursor-pointer">
              <Slider.Range className="absolute h-full bg-transparent" />
            </Slider.Track>
            <Slider.Thumb
              aria-label="Start Trim"
              className="block w-3.5 h-[56px] bg-zinc-200 rounded-sm border-2 border-white shadow-lg shadow-black/50 cursor-ew-resize focus:outline-none hover:bg-white transition-colors"
            />
            <Slider.Thumb
              aria-label="End Trim"
              className="block w-3.5 h-[56px] bg-zinc-200 rounded-sm border-2 border-white shadow-lg shadow-black/50 cursor-ew-resize focus:outline-none hover:bg-white transition-colors"
            />
          </Slider.Root>
        )}
      </div>

      {/* Duration info and manual inputs */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-gray-400">Selected Duration:</span>
          <span className="font-mono font-bold text-white">
            {isTrimEnabled
              ? formatTime(trimRange[1] - trimRange[0], (trimRange[1] - trimRange[0]) < 10 || (trimRange[1] - trimRange[0]) % 1 !== 0)
              : formatTime(effectiveDuration, effectiveDuration < 10)}
          </span>
          <span className="text-gray-500">
            ({(isTrimEnabled ? (trimRange[1] - trimRange[0]) : effectiveDuration).toFixed(1)}s)
          </span>
        </div>

        {isTrimEnabled ? (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <input
              type="text"
              value={formatTime(trimRange[0], effectiveDuration <= 15 || trimRange[0] % 1 !== 0)}
              onChange={(e) => {
                const val = parseTime(e.target.value);
                if (!isNaN(val) && val < trimRange[1]) {
                  setTrimRange([val, trimRange[1]]);
                  pauseAndSeek(val);
                }
              }}
              className="w-16 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400 text-[11px]"
            />
            <span className="text-gray-500">-</span>
            <input
              type="text"
              value={formatTime(trimRange[1], effectiveDuration <= 15 || trimRange[1] % 1 !== 0)}
              onChange={(e) => {
                const val = parseTime(e.target.value);
                if (!isNaN(val) && val > trimRange[0]) {
                  const endVal = Math.min(effectiveDuration > 0 ? effectiveDuration : 9999, val);
                  setTrimRange([trimRange[0], endVal]);
                  pauseAndSeek(trimRange[0]);
                }
              }}
              className="w-16 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400 text-[11px]"
            />
          </div>
        ) : (
          <span className="text-[11px] text-gray-500 font-medium">Exporting Entire Video</span>
        )}
      </div>

      {/* Note banner */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black border border-white/10 text-white select-none shadow-sm">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500/10 text-red-500 uppercase tracking-wide border border-red-500/20 shrink-0">
          NOTE:
        </span>
        <p className="text-[11px] font-medium text-white leading-tight">
          Preview quality does not affect download quality.
        </p>
      </div>
    </div>
  );
}
