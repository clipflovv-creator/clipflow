import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors, Crop, Sliders, Camera, Download, Loader2, Check,
  RectangleHorizontal, Smartphone, Square, RectangleVertical, RefreshCw,
  Film, ImageIcon,
} from 'lucide-react';
import type { EditorMobileBottomDockProps } from './types';

const RATIO_OPTIONS = [
  { id: '16:9',   label: '16:9',   sub: 'Landscape', Icon: RectangleHorizontal },
  { id: '9:16',   label: '9:16',   sub: 'Vertical',  Icon: Smartphone },
  { id: '1:1',    label: '1:1',    sub: 'Square',    Icon: Square },
  { id: '4:5',    label: '4:5',    sub: 'Portrait',  Icon: RectangleVertical },
  { id: 'custom', label: 'Custom', sub: 'Freeform',  Icon: Crop },
] as const;

const FORMAT_OPTIONS = [
  { id: 'mp4',      label: 'Video (MP4)' },
  { id: 'mp3',      label: 'Audio (MP3)' },
  { id: 'captions', label: 'Captions'    },
] as const;

const BITRATE_OPTIONS = [
  { id: '320k', label: '320k', sub: 'Studio' },
  { id: '256k', label: '256k', sub: 'High'   },
  { id: '192k', label: '192k', sub: 'Std'    },
  { id: '128k', label: '128k', sub: 'Light'  },
] as const;

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const SPRING = { type: 'spring' as const, damping: 30, stiffness: 340, mass: 0.8 };

const PillRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-none">
    {children}
  </div>
);

export const EditorMobileBottomDock: React.FC<EditorMobileBottomDockProps> = ({
  activeTab,
  onSelectTab,
  isTrimEnabled,
  onToggleTrim,
  isDownloading,
  hasMetadata,
  // ratio
  aspectRatio,
  applyAspectRatio,
  fitMode,
  setFitMode,
  centerCropBox,
  // quality
  downloadFormat,
  setDownloadFormat,
  downloadQuality,
  handleSetDownloadQuality,
  downloadAudioBitrate,
  setDownloadAudioBitrate,
  captionFormat,
  setCaptionFormat,
  captionLang,
  setCaptionLang,
  qualityOptions,
  // snap
  previewImageMode,
  setPreviewImageMode,
  handleDownloadImage,
  isDownloadingImage,
  downloadSuccess,
  currentTime,
}) => {
  if (!hasMetadata) return null;

  const showRatioStrips   = activeTab === 'ratio';
  const showFitStrip      = showRatioStrips && aspectRatio !== '16:9' && aspectRatio !== 'custom';
  const showQualityStrips = activeTab === 'quality';
  const showSnapStrip     = activeTab === 'snap';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden select-none">

      {/* ━━━ RATIO strips ━━━ */}
      <AnimatePresence>
        {showRatioStrips && (
          <motion.div key="ratio-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/10"
          >
            <PillRow>
              {RATIO_OPTIONS.map(({ id, label, sub, Icon }) => {
                const sel = aspectRatio === id;
                return (
                  <button key={id} type="button" onClick={() => applyAspectRatio(id as any)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3.5 py-2 rounded-2xl border transition-all active:scale-95 min-w-[64px] ${
                      sel ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                          : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className={`w-3.5 h-3.5 ${sel ? 'text-black' : 'text-zinc-400'}`} />
                      {sel && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-[11px] font-bold leading-none">{label}</span>
                    <span className={`text-[9px] leading-none ${sel ? 'text-zinc-600' : 'text-zinc-500'}`}>{sub}</span>
                  </button>
                );
              })}
            </PillRow>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Fit / Crop sub-strip ━━━ */}
      <AnimatePresence>
        {showFitStrip && (
          <motion.div key="fit-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/[0.06]"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0 pr-1">Framing</span>
              {(['crop', 'pad'] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setFitMode(mode)}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border ${
                    fitMode === mode ? 'bg-white/15 text-white border-white/30'
                                    : 'bg-white/[0.04] text-zinc-400 border-white/10'}`}
                >
                  {mode === 'crop' ? 'Fill & Crop' : 'Fit & Pad'}
                </button>
              ))}
              <button type="button" onClick={centerCropBox} title="Recenter"
                className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 active:scale-95 transition-all shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ QUALITY — Format row ━━━ */}
      <AnimatePresence>
        {showQualityStrips && (
          <motion.div key="quality-format-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/10"
          >
            <PillRow>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0 pr-1">Format</span>
              {FORMAT_OPTIONS.map(({ id, label }) => {
                const sel = downloadFormat === id;
                return (
                  <button key={id} type="button" onClick={() => setDownloadFormat(id as any)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-2xl border text-[11px] font-bold transition-all active:scale-95 ${
                      sel ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                          : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </PillRow>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ QUALITY — Sub-options row (resolution / bitrate / captions) ━━━ */}
      <AnimatePresence>
        {showQualityStrips && downloadFormat === 'mp4' && (
          <motion.div key="quality-res-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/[0.06]"
          >
            <PillRow>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0 pr-1">Res</span>
              {qualityOptions.map((opt) => {
                const sel = downloadQuality === opt.label;
                return (
                  <button key={opt.label} type="button" onClick={() => handleSetDownloadQuality(opt.label)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-2xl border transition-all active:scale-95 min-w-[52px] ${
                      sel ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                          : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
                  >
                    <span className="text-[11px] font-bold leading-none">{opt.label}</span>
                    <span className={`text-[9px] leading-none mt-0.5 ${sel ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {opt.isNative ? 'Original' : opt.height ? `${opt.height}p` : 'Std'}
                    </span>
                  </button>
                );
              })}
            </PillRow>
          </motion.div>
        )}

        {showQualityStrips && downloadFormat === 'mp3' && (
          <motion.div key="quality-bitrate-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/[0.06]"
          >
            <PillRow>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0 pr-1">Bitrate</span>
              {BITRATE_OPTIONS.map(({ id, label, sub }) => {
                const sel = downloadAudioBitrate === id;
                return (
                  <button key={id} type="button" onClick={() => setDownloadAudioBitrate(id as any)}
                    className={`flex-shrink-0 flex flex-col items-center px-3.5 py-1.5 rounded-2xl border transition-all active:scale-95 min-w-[56px] ${
                      sel ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                          : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
                  >
                    <span className="text-[11px] font-bold leading-none">{label}</span>
                    <span className={`text-[9px] leading-none mt-0.5 ${sel ? 'text-zinc-600' : 'text-zinc-500'}`}>{sub}</span>
                  </button>
                );
              })}
            </PillRow>
          </motion.div>
        )}

        {showQualityStrips && downloadFormat === 'captions' && (
          <motion.div key="quality-captions-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/[0.06]"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              {(['srt', 'vtt', 'txt'] as const).map((fmt) => {
                const sel = captionFormat === fmt;
                return (
                  <button key={fmt} type="button" onClick={() => setCaptionFormat(fmt)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-2xl border text-[11px] font-bold uppercase transition-all active:scale-95 ${
                      sel ? 'bg-white text-black border-white'
                          : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
                  >
                    {fmt}
                  </button>
                );
              })}
              <input
                type="text"
                value={captionLang}
                onChange={(e) => setCaptionLang(e.target.value)}
                placeholder="lang (en)"
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-black/60 border border-white/15 rounded-xl text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ SNAP strip ━━━ */}
      <AnimatePresence>
        {showSnapStrip && (
          <motion.div key="snap-strip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={SPRING}
            className="overflow-hidden bg-[#09090c]/98 backdrop-blur-xl border-t border-white/10"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Mode toggle */}
              <button type="button" onClick={() => setPreviewImageMode('frame')}
                className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all active:scale-95 ${
                  previewImageMode === 'frame' ? 'bg-white text-black border-white'
                                               : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
              >
                <Film className="w-3 h-3" />
                <span>Frame</span>
                {previewImageMode === 'frame' && (
                  <span className="text-[9px] font-mono text-zinc-500 ml-0.5">{formatTime(currentTime)}</span>
                )}
              </button>

              <button type="button" onClick={() => setPreviewImageMode('thumbnail')}
                className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all active:scale-95 ${
                  previewImageMode === 'thumbnail' ? 'bg-white text-black border-white'
                                                   : 'bg-white/[0.05] text-zinc-300 border-white/10'}`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>Thumb</span>
              </button>

              {/* Download button — grows to fill remaining space */}
              <button type="button" onClick={handleDownloadImage} disabled={isDownloadingImage}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-2xl text-[11px] font-bold transition-all active:scale-95 ${
                  downloadSuccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isDownloadingImage
                      ? 'bg-white/10 text-zinc-500 border border-white/10 cursor-not-allowed'
                      : 'bg-white text-black shadow-md'}`}
              >
                {isDownloadingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : downloadSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {isDownloadingImage ? 'Saving…' : downloadSuccess ? 'Saved!' : 'Download'}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Main Tab Bar ━━━ */}
      <div className="bg-[#09090c]/95 backdrop-blur-xl border-t border-white/10 pb-safe">
        <div className="h-[58px] px-3 flex items-center justify-around gap-1">

          {/* Trim */}
          <button type="button" onClick={onToggleTrim}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
              isTrimEnabled ? 'text-white bg-white/15 shadow-sm' : 'text-zinc-400'}`}
          >
            <div className="relative">
              <Scissors className={`w-4 h-4 ${isTrimEnabled ? 'text-white' : 'text-zinc-400'}`} />
              {isTrimEnabled && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </div>
            <span className="text-[10px] font-medium tracking-tight mt-1">Trim</span>
          </button>

          {/* Ratio */}
          <button type="button" onClick={() => onSelectTab(activeTab === 'ratio' ? null : 'ratio')}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'ratio' ? 'text-white bg-white/15 shadow-sm' : 'text-zinc-400'}`}
          >
            <Crop className={`w-4 h-4 ${activeTab === 'ratio' ? 'text-white' : 'text-zinc-400'}`} />
            <span className="text-[10px] font-medium tracking-tight mt-1">Ratio</span>
          </button>

          {/* Quality */}
          <button type="button" onClick={() => onSelectTab(activeTab === 'quality' ? null : 'quality')}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'quality' ? 'text-white bg-white/15 shadow-sm' : 'text-zinc-400'}`}
          >
            <Sliders className={`w-4 h-4 ${activeTab === 'quality' ? 'text-white' : 'text-zinc-400'}`} />
            <span className="text-[10px] font-medium tracking-tight mt-1">Quality</span>
          </button>

          {/* Snap */}
          <button type="button" onClick={() => onSelectTab(activeTab === 'snap' ? null : 'snap')}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'snap' ? 'text-white bg-white/15 shadow-sm' : 'text-zinc-400'}`}
          >
            <Camera className={`w-4 h-4 ${activeTab === 'snap' ? 'text-white' : 'text-zinc-400'}`} />
            <span className="text-[10px] font-medium tracking-tight mt-1">Snap</span>
          </button>

          {/* Export */}
          <button type="button" onClick={() => onSelectTab(activeTab === 'export' ? null : 'export')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
              activeTab === 'export' || isDownloading
                ? 'bg-white text-black font-bold shadow-lg shadow-white/10'
                : 'bg-white/10 text-white hover:bg-white/20 font-semibold'}`}
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <Download className="w-3.5 h-3.5" />}
            <span className="text-xs font-bold">{isDownloading ? 'Saving' : 'Export'}</span>
          </button>

        </div>
      </div>
    </div>
  );
};
