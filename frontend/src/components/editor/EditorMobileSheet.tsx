import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Crop, Sliders, Camera, Download, Check,
  RectangleHorizontal, Smartphone, Square, RectangleVertical,
  Loader2, RefreshCw, Film, ImageIcon, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import type { MobileTab } from './EditorMobileBottomDock';
import type { QualityOption } from '../../hooks/editor/useEditorMetadata';

interface EditorMobileSheetProps {
  activeTab: MobileTab;
  onClose: () => void;
  // Aspect Ratio & Crop
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  applyAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom') => void;
  fitMode: 'crop' | 'pad';
  setFitMode: (mode: 'crop' | 'pad') => void;
  centerCropBox: () => void;
  // Quality & Format
  downloadFormat: 'mp4' | 'mp3' | 'captions';
  setDownloadFormat: (fmt: 'mp4' | 'mp3' | 'captions') => void;
  downloadQuality: string;
  handleSetDownloadQuality: (q: string) => void;
  downloadAudioBitrate: '0' | '320k' | '256k' | '192k' | '128k';
  setDownloadAudioBitrate: (bitrate: '0' | '320k' | '256k' | '192k' | '128k') => void;
  captionFormat: 'srt' | 'vtt' | 'txt';
  setCaptionFormat: (fmt: 'srt' | 'vtt' | 'txt') => void;
  captionLang: string;
  setCaptionLang: (lang: string) => void;
  qualityOptions: QualityOption[];
  // Snapshot
  previewImageMode: 'thumbnail' | 'frame';
  setPreviewImageMode: (mode: 'thumbnail' | 'frame') => void;
  handleDownloadImage: () => Promise<void>;
  isDownloadingImage: boolean;
  downloadSuccess: boolean;
  currentTime: number;
  metadata: any;
  // Export
  customFileName: string;
  setCustomFileName: (name: string) => void;
  statusMessage: string;
  downloadStatus: 'idle' | 'running' | 'success' | 'error';
  isDownloading: boolean;
  handleExportDownload: () => Promise<void>;
  exportDuration: number;
  estimatedBytes: number;
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

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EditorMobileSheet: React.FC<EditorMobileSheetProps> = ({
  activeTab,
  onClose,
  aspectRatio,
  applyAspectRatio,
  fitMode,
  setFitMode,
  centerCropBox,
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
  previewImageMode,
  setPreviewImageMode,
  handleDownloadImage,
  isDownloadingImage,
  downloadSuccess,
  currentTime,
  metadata,
  customFileName,
  setCustomFileName,
  statusMessage,
  downloadStatus,
  isDownloading,
  handleExportDownload,
  exportDuration,
  estimatedBytes,
}) => {
  return (
    <AnimatePresence>
      {activeTab && (
        <div className="fixed inset-0 z-50 md:hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Slide-up Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-0 inset-x-0 bg-[#0d0d12] border-t border-white/15 rounded-t-[26px] max-h-[85vh] flex flex-col shadow-2xl pb-safe overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2">
                {activeTab === 'ratio' && <Crop className="w-4 h-4 text-blue-400" />}
                {activeTab === 'quality' && <Sliders className="w-4 h-4 text-purple-400" />}
                {activeTab === 'snap' && <Camera className="w-4 h-4 text-emerald-400" />}
                {activeTab === 'export' && <Download className="w-4 h-4 text-white" />}
                <h3 className="text-sm font-bold text-white">
                  {activeTab === 'ratio' && 'Aspect Ratio & Framing'}
                  {activeTab === 'quality' && 'Format & Quality'}
                  {activeTab === 'snap' && 'Frame & Thumbnail'}
                  {activeTab === 'export' && 'Export Video / Audio'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-5 space-y-5">
              {/* ══ RATIO & CROP TAB ══ */}
              {activeTab === 'ratio' && (
                <>
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      Select Aspect Ratio
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: '16:9', label: '16:9 Landscape', icon: RectangleHorizontal, sub: 'YouTube, Web' },
                        { id: '9:16', label: '9:16 Vertical', icon: Smartphone, sub: 'Shorts, Reels, TikTok' },
                        { id: '1:1', label: '1:1 Square', icon: Square, sub: 'Instagram Feed' },
                        { id: '4:5', label: '4:5 Portrait', icon: RectangleVertical, sub: 'Social Portrait' },
                        { id: 'custom', label: 'Custom Freeform', icon: Crop, sub: 'Drag on screen' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = aspectRatio === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => applyAspectRatio(item.id as any)}
                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                              isSelected
                                ? 'bg-white text-black border-white shadow-md'
                                : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]'
                            } ${item.id === 'custom' ? 'col-span-2' : ''}`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <Icon className={`w-4 h-4 ${isSelected ? 'text-black' : 'text-zinc-400'}`} />
                              {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                            </div>
                            <span className="text-xs font-bold">{item.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                              {item.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-white/[0.08]">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      Framing Mode
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFitMode('crop')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          fitMode === 'crop'
                            ? 'bg-white/15 text-white border-white/30 font-bold'
                            : 'bg-white/[0.04] text-zinc-400 border-white/10'
                        }`}
                      >
                        <p className="text-xs">Fill & Crop</p>
                        <p className="text-[10px] opacity-70 mt-0.5">Zooms to fill frame</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFitMode('pad')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          fitMode === 'pad'
                            ? 'bg-white/15 text-white border-white/30 font-bold'
                            : 'bg-white/[0.04] text-zinc-400 border-white/10'
                        }`}
                      >
                        <p className="text-xs">Fit & Letterbox</p>
                        <p className="text-[10px] opacity-70 mt-0.5">Pads with black bars</p>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={centerCropBox}
                      className="w-full mt-2 py-2.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Recenter Framing Box</span>
                    </button>
                  </div>
                </>
              )}

              {/* ══ QUALITY & FORMAT TAB ══ */}
              {activeTab === 'quality' && (
                <>
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      Export Format
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'mp4', label: 'Video (MP4)' },
                        { id: 'mp3', label: 'Audio (MP3)' },
                        { id: 'captions', label: 'Captions' },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setDownloadFormat(fmt.id as any)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                            downloadFormat === fmt.id
                              ? 'bg-white text-black shadow-md'
                              : 'bg-white/[0.05] text-zinc-400 border border-white/10 hover:bg-white/[0.08]'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {downloadFormat === 'mp4' && (() => {
                    const maxNativeHeight = qualityOptions.find((q) => q.isNative)?.height || 1080;
                    const selectedOpt = qualityOptions.find((q) => q.label === downloadQuality || q.label.startsWith(downloadQuality));
                    const isSelectedNative = selectedOpt ? selectedOpt.isNative : true;

                    return (
                      <div className="space-y-2 pt-1 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                            Video Resolution
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Max: <span className="text-zinc-300 font-bold">{maxNativeHeight}p</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {qualityOptions.map((opt) => {
                            const isSelected = downloadQuality === opt.label;
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => handleSetDownloadQuality(opt.label)}
                                className={`py-2.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-[0.98] ${
                                  isSelected
                                    ? 'bg-white text-black border-white shadow-md'
                                    : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]'
                                }`}
                              >
                                <span className="text-xs font-bold">{opt.label}</span>
                                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-zinc-600' : opt.isNative ? 'text-emerald-400 font-medium' : 'text-zinc-500'}`}>
                                  {opt.isNative ? 'Native' : `Near ${maxNativeHeight}p`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {!isSelectedNative && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                            ℹ️ <strong>Note:</strong> Source max is {maxNativeHeight}p. Selected {downloadQuality} will automatically download the highest native {maxNativeHeight}p stream directly from the CDN.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {downloadFormat === 'mp3' && (
                    <div className="space-y-2 pt-1 border-t border-white/[0.08]">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                        Audio Quality Bitrate
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: '320k', label: '320 kbps', sub: 'Studio Quality' },
                          { id: '256k', label: '256 kbps', sub: 'High Quality' },
                          { id: '192k', label: '192 kbps', sub: 'Standard' },
                          { id: '128k', label: '128 kbps', sub: 'Compact' },
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setDownloadAudioBitrate(b.id as any)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              downloadAudioBitrate === b.id
                                ? 'bg-white text-black border-white shadow-md'
                                : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]'
                            }`}
                          >
                            <span className="text-xs font-bold block">{b.label}</span>
                            <span className={`text-[10px] ${downloadAudioBitrate === b.id ? 'text-zinc-600' : 'text-zinc-500'}`}>
                              {b.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {downloadFormat === 'captions' && (
                    <div className="space-y-3 pt-1 border-t border-white/[0.08]">
                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                          Caption Format
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {(['srt', 'vtt', 'txt'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setCaptionFormat(fmt)}
                              className={`py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                captionFormat === fmt
                                  ? 'bg-white text-black'
                                  : 'bg-white/[0.04] text-zinc-400 border border-white/10'
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                          Language Code
                        </span>
                        <input
                          type="text"
                          value={captionLang}
                          onChange={(e) => setCaptionLang(e.target.value)}
                          placeholder="e.g. en, es, auto"
                          className="w-full px-3 py-2 bg-black/60 border border-white/15 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ══ SNAPSHOT TAB ══ */}
              {activeTab === 'snap' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewImageMode('frame')}
                      className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        previewImageMode === 'frame'
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-zinc-400 border-white/10'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Current Frame</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewImageMode('thumbnail')}
                      className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        previewImageMode === 'thumbnail'
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-zinc-400 border-white/10'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Thumbnail</span>
                    </button>
                  </div>

                  {previewImageMode === 'thumbnail' ? (
                    <div className="space-y-3">
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/15 bg-black">
                        <img
                          src={metadata?.thumbnail || ''}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-zinc-400 text-center">
                        Official high-resolution video thumbnail
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-white/15 bg-white/[0.02] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Video Frame Snapshot</span>
                        <div className="px-2 py-0.5 rounded bg-black border border-white/15 text-xs font-mono text-white flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{formatTime(currentTime, true)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Captures current timestamp as a full-resolution PNG image directly from the video canvas.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    disabled={isDownloadingImage}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                      downloadSuccess
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isDownloadingImage
                          ? 'bg-white/10 text-zinc-500 cursor-not-allowed'
                          : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {isDownloadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Capturing...</span>
                      </>
                    ) : downloadSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Saved to device!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>
                          {previewImageMode === 'thumbnail' ? 'Download HD Thumbnail' : `Download Frame at ${formatTime(currentTime)}`}
                        </span>
                      </>
                    )}
                  </button>
                </>
              )}

              {/* ══ EXPORT TAB ══ */}
              {activeTab === 'export' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      File Name
                    </label>
                    <div className="flex items-center bg-black border border-white/15 rounded-xl px-3 py-2.5 focus-within:border-white transition-all">
                      <input
                        type="text"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        placeholder="my-clip"
                        className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <span className="text-xs font-mono text-zinc-500 shrink-0">
                        .{downloadFormat === 'captions' ? captionFormat : downloadFormat}
                      </span>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-zinc-400 block">Duration</span>
                      <span className="text-xs font-bold text-white font-mono">{formatTime(exportDuration)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-zinc-400 block">Quality</span>
                      <span className="text-xs font-bold text-white">
                        {downloadFormat === 'mp4' ? downloadQuality : downloadFormat === 'mp3' ? downloadAudioBitrate : captionFormat.toUpperCase()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-zinc-400 block">Format</span>
                      <span className="text-xs font-bold text-white uppercase">{downloadFormat}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-zinc-400 block">Est. Size</span>
                      <span className="text-xs font-bold text-white font-mono">{formatBytes(estimatedBytes) || '~'}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {statusMessage && (
                    <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                      downloadStatus === 'running'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                        : downloadStatus === 'error'
                          ? 'bg-red-500/10 border-red-500/20 text-red-300'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {downloadStatus === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />}
                      {downloadStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      {downloadStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <span className="leading-tight">{statusMessage}</span>
                    </div>
                  )}

                  {/* Big Export Button */}
                  <button
                    type="button"
                    onClick={handleExportDownload}
                    disabled={isDownloading}
                    className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl cursor-pointer ${
                      isDownloading
                        ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/10'
                        : 'bg-white text-black hover:bg-zinc-100 shadow-white/10'
                    }`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Processing & Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Start Export Download</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
