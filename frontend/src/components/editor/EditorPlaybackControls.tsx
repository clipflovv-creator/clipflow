import { useState, useRef, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import {
  RotateCcw, RotateCw, Play, Pause,
  Volume2, VolumeX, Settings, ChevronDown, Check
} from 'lucide-react';
import type { PreviewQualityTier } from '../../hooks/editor/useEditorMetadata';

interface EditorPlaybackControlsProps {
  currentTime: number;
  effectiveDuration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  seekRelative: (seconds: number) => void;
  seekToPosition: (newTime: number) => void;
  togglePlay: () => void;
  handleVolumeChange: (newVol: number) => void;
  toggleMute: () => void;
  isSeekingRef: React.RefObject<boolean>;
  pendingSeekTimeRef: React.RefObject<number | null>;
  lastSeekTimeRef: React.RefObject<number>;
  setCurrentTime: (time: number) => void;
  isYouTube: boolean;
  previewQualities: PreviewQualityTier[];
  currentQualityLabel: string;
  selectedQualityId: string;
  selectedPreviewQualityUrl: string;
  defaultPreviewStreamUrl: string;
  handleSelectPreviewQuality: (q: PreviewQualityTier) => void;
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

export function EditorPlaybackControls({
  currentTime,
  effectiveDuration,
  isPlaying,
  volume,
  isMuted,
  seekRelative,
  seekToPosition,
  togglePlay,
  handleVolumeChange,
  toggleMute,
  isSeekingRef,
  pendingSeekTimeRef,
  lastSeekTimeRef,
  setCurrentTime,
  isYouTube,
  previewQualities,
  currentQualityLabel,
  selectedQualityId,
  selectedPreviewQualityUrl,
  defaultPreviewStreamUrl,
  handleSelectPreviewQuality,
}: EditorPlaybackControlsProps) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState('');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isQualityMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQualityMenuOpen]);

  return (
    <div className="w-full mt-2 pt-2 border-t border-white/[0.08] flex flex-col gap-2 shrink-0 px-2">
      {/* Progress Track */}
      <div className="w-full flex flex-col items-center px-1">
        <Slider.Root
          className="relative w-full flex items-center h-4 cursor-pointer"
          value={[currentTime]}
          min={0}
          max={effectiveDuration > 0 ? effectiveDuration : 10}
          onValueChange={(val) => {
            (isSeekingRef as any).current = true;
            (pendingSeekTimeRef as any).current = val[0];
            (lastSeekTimeRef as any).current = Date.now();
            setCurrentTime(val[0]);
          }}
          onValueCommit={(val) => {
            seekToPosition(val[0]);
          }}
        >
          <Slider.Track className="relative flex-grow h-1.5 bg-white/10 rounded-full">
            <Slider.Range className="absolute h-full bg-white/80 rounded-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none transition-transform" />
        </Slider.Root>
      </div>

      {/* Controls Row */}
      <div className="w-full flex items-center justify-between pb-1 relative mt-0.5 gap-1">
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => seekRelative(-10)}
            className="px-1.5 sm:px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[10px] font-bold font-mono">10s</span>
          </button>

          <button
            onClick={togglePlay}
            className="p-2 sm:p-2 rounded-full sm:rounded-lg bg-white text-black sm:bg-white/[0.08] sm:hover:bg-white/[0.15] sm:text-white transition-all flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekRelative(10)}
            className="px-1.5 sm:px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
            title="Forward 10 seconds"
          >
            <span className="text-[10px] font-bold font-mono">10s</span>
            <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Volume Control */}
          <div className="group/vol flex items-center ml-0.5">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
              title={isMuted || volume === 0 ? 'Unmute Audio' : `Volume: ${Math.round(volume * 100)}% (Click to mute)`}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-300 group-hover/vol:text-white" />
              )}
            </button>
            <div className="hidden sm:flex items-center gap-1.5 w-0 opacity-0 group-hover/vol:w-24 group-hover/vol:opacity-100 overflow-hidden transition-all duration-200 ease-out pl-0.5 pr-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-purple-400 transition-all shrink-0"
                title={`Volume: ${isMuted ? 0 : Math.round(volume * 100)}%`}
              />
              <span className="text-[10px] font-mono text-zinc-400 select-none shrink-0 w-6 text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Time Indicator (Centered on desktop, inline on mobile) */}
        <div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-1 text-[11px] sm:text-[12px] font-mono text-gray-400 bg-black/60 border border-white/10 px-2 py-0.5 rounded-lg shadow-sm shrink-0">
          {isEditingTime ? (
            <input
              type="text"
              autoFocus
              value={timeInputValue}
              onChange={(e) => setTimeInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const parsed = parseTime(timeInputValue);
                  if (!isNaN(parsed)) {
                    const clamped = Math.max(0, Math.min(parsed, effectiveDuration > 0 ? effectiveDuration : parsed));
                    seekToPosition(clamped);
                  }
                  setIsEditingTime(false);
                } else if (e.key === 'Escape') {
                  setIsEditingTime(false);
                }
              }}
              onBlur={() => {
                const parsed = parseTime(timeInputValue);
                if (!isNaN(parsed)) {
                  const clamped = Math.max(0, Math.min(parsed, effectiveDuration > 0 ? effectiveDuration : parsed));
                  seekToPosition(clamped);
                }
                setIsEditingTime(false);
              }}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1 text-center font-bold text-white text-[12px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTimeInputValue(formatTime(currentTime, effectiveDuration <= 15 || currentTime % 1 !== 0));
                setIsEditingTime(true);
              }}
              title="Click to edit current time"
              className="font-bold text-gray-200 hover:text-white hover:bg-white/5 cursor-text transition-colors px-1 py-0.5 rounded"
            >
              {formatTime(currentTime, effectiveDuration <= 15 || currentTime % 1 !== 0)}
            </button>
          )}
          <span className="text-gray-600">/</span>
          <span className="text-gray-400">
            {formatTime(effectiveDuration, effectiveDuration <= 15 || effectiveDuration % 1 !== 0)}
          </span>
        </div>

        {/* Right Controls: Preview Quality Selection (Hidden for YouTube links) */}
        <div className="flex items-center gap-2">
          {!isYouTube && previewQualities.length > 0 && (
            <div className="relative" ref={qualityMenuRef}>
              <button
                type="button"
                onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.2] text-gray-200 hover:text-white transition-all text-[11px] font-semibold border border-white/15 shadow-sm cursor-pointer"
                title="Change Video Preview Quality"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-300" />
                <span className="tracking-tight">{currentQualityLabel}</span>
                <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isQualityMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isQualityMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-44 bg-black border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.08] mb-1 flex items-center justify-between">
                    <span>Preview Quality</span>
                    <span className="text-[9px] text-zinc-300 font-mono">Stream</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {previewQualities.map((q) => {
                      const isSelected =
                        selectedQualityId === q.id ||
                        (!selectedQualityId && selectedPreviewQualityUrl === q.url) ||
                        (!selectedQualityId && !selectedPreviewQualityUrl && (q.url === defaultPreviewStreamUrl || q.label === currentQualityLabel));
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            handleSelectPreviewQuality(q);
                            setIsQualityMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white text-black font-bold'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate font-semibold">{q.label}</span>
                            {!q.isAvailable && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-zinc-400 font-mono">
                                auto-scaled
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-black shrink-0 ml-1.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
