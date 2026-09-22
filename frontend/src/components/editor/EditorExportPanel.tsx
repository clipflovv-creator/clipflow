import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ImageIcon, Film, Clock, Download, ChevronDown, Check,
  RectangleHorizontal, Smartphone, Square, RectangleVertical, Crop,
  Minimize2, HardDrive, CheckCircle2, AlertCircle, RefreshCw,
  Loader2, ArrowRight
} from 'lucide-react';
import { ExportFormatSection } from '../ExportFormatSection';
import type { QualityOption } from '../../hooks/editor/useEditorMetadata';

interface EditorExportPanelProps {
  rightPanelWidth: number;
  metadata: any;
  currentTime: number;
  previewImageMode: 'thumbnail' | 'frame';
  setPreviewImageMode: (mode: 'thumbnail' | 'frame') => void;
  handleDownloadImage: () => Promise<void>;
  isDownloadingImage: boolean;
  downloadSuccess: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  applyAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom') => void;
  fitMode: 'crop' | 'pad';
  setFitMode: (mode: 'crop' | 'pad') => void;
  centerCropBox: () => void;
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
  customFileName: string;
  setCustomFileName: (name: string) => void;
  statusMessage: string;
  downloadStatus: 'idle' | 'running' | 'success' | 'error';
  isDownloading: boolean;
  handleExportDownload: () => Promise<void>;
  exportMode?: 'free' | 'pro';
  isPro?: boolean;
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

export function EditorExportPanel({
  rightPanelWidth,
  metadata,
  currentTime,
  previewImageMode,
  setPreviewImageMode,
  handleDownloadImage,
  isDownloadingImage,
  downloadSuccess,
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
  customFileName,
  setCustomFileName,
  statusMessage,
  downloadStatus,
  isDownloading,
  handleExportDownload,
  exportMode: _exportMode,
  isPro: _isPro,
  estimatedBytes,
}: EditorExportPanelProps) {
  const [isImageModeDropdownOpen, setIsImageModeDropdownOpen] = useState(false);
  const imageModeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isImageModeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (imageModeDropdownRef.current && !imageModeDropdownRef.current.contains(e.target as Node)) {
        setIsImageModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isImageModeDropdownOpen]);

  return (
    <aside
      style={{ width: `${rightPanelWidth}px` }}
      className="shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden bg-black select-text"
    >
      {/* Scrollable settings */}
      <div className="flex-1 overflow-y-auto">
        {/* Video Info Header / Image Preview Section */}
        {metadata ? (
          <div className="flex flex-col gap-2.5 px-4 py-4 border-b border-white/[0.06] bg-black">
            <div className="flex items-center justify-between">
              {/* Dropdown Menu */}
              <div className="relative" ref={imageModeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsImageModeDropdownOpen(!isImageModeDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-white/[0.08] text-xs font-bold text-gray-300 hover:text-white uppercase tracking-wider transition-colors cursor-pointer border border-transparent hover:border-white/10"
                  title="Switch between Video Thumbnail and Current Frame"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />
                  <span>{previewImageMode === 'thumbnail' ? 'Thumbnail' : 'Current Frame'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isImageModeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isImageModeDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 rounded-xl bg-black border border-white/15 shadow-2xl p-1 z-30 flex flex-col gap-0.5 backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImageMode('thumbnail');
                        setIsImageModeDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        previewImageMode === 'thumbnail'
                          ? 'bg-white/15 text-white font-bold'
                          : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Thumbnail</span>
                      </span>
                      {previewImageMode === 'thumbnail' && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImageMode('frame');
                        setIsImageModeDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        previewImageMode === 'frame'
                          ? 'bg-white/15 text-white font-bold'
                          : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Film className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Current Frame</span>
                      </span>
                      {previewImageMode === 'frame' && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloadingImage}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  downloadSuccess
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : isDownloadingImage
                      ? 'bg-white/10 text-gray-400 cursor-not-allowed border border-white/5'
                      : 'text-zinc-200 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 active:scale-95'
                }`}
                title={previewImageMode === 'thumbnail' ? 'Download HD Thumbnail' : `Download Frame at ${formatTime(currentTime)}`}
              >
                {isDownloadingImage ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                    <span>Downloading...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 text-zinc-300" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>

            {/* Image Display */}
            {previewImageMode === 'thumbnail' ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-sm flex items-center justify-center group">
                <img
                  src={metadata.thumbnail || ''}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover transition-all duration-300 opacity-100 scale-100"
                />
              </div>
            ) : (
              <div className="relative w-full rounded-xl p-3.5 border border-white/10 bg-black shadow-sm flex flex-col gap-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
                      <Film className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-none">Current Video Frame</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Captures exact on-screen frame</p>
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-zinc-950 border border-white/15 text-[11px] font-mono text-white font-bold flex items-center gap-1 shadow-inner">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{formatTime(currentTime, true)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Click <span className="text-white font-semibold">Download</span> to capture this exact frame from the video player as a full-resolution PNG.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 px-4 py-4 border-b border-white/[0.06] bg-black">
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 rounded-md yt-skeleton" />
              <div className="w-16 h-6 rounded-md yt-skeleton" />
            </div>
            <div className="relative w-full aspect-video rounded-xl yt-skeleton border border-white/[0.04]" />
          </div>
        )}

        <div className="p-4 space-y-5 bg-black">
          {/* ── 1. Custom Framing & Aspect Ratio ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-600 tabular-nums">1.</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Crop & Framing</h3>
              </div>
              {aspectRatio !== '16:9' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 font-semibold uppercase tracking-wider">
                  {aspectRatio}
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[
                { id: '16:9', label: '16:9', sub: 'Full', icon: RectangleHorizontal },
                { id: '9:16', label: '9:16', sub: 'Shorts', icon: Smartphone },
                { id: '1:1', label: '1:1', sub: 'Square', icon: Square },
                { id: '4:5', label: '4:5', sub: 'Portrait', icon: RectangleVertical },
                { id: 'custom', label: 'Custom', sub: 'Free', icon: Crop },
              ].map((r) => {
                const IconComp = r.icon;
                const isSelected = aspectRatio === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => applyAspectRatio(r.id as any)}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black font-black border-white shadow-md'
                        : 'bg-zinc-950/80 border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-bold leading-tight">{r.label}</span>
                    <span className="text-[8px] opacity-60 leading-tight truncate w-full">{r.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* Framing Mode: Fit vs Cropped */}
            {(aspectRatio === '9:16' || aspectRatio === '1:1' || aspectRatio === '4:5') && (
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Framing Mode</span>
                  <div className="flex items-center gap-2">
                    {fitMode === 'crop' && (
                      <button
                        type="button"
                        onClick={centerCropBox}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition-all cursor-pointer border border-white/10"
                        title="Center the crop framing box"
                      >
                        Center
                      </button>
                    )}
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {fitMode === 'pad' ? 'Letterbox (Black Bars)' : 'Crop & Fill'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFitMode('pad')}
                    className={`py-2 px-2.5 rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                      fitMode === 'pad'
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-zinc-900/90 border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    title="Fit entire video inside the frame with top and bottom black bars"
                  >
                    <Minimize2 className={`w-3.5 h-3.5 ${fitMode === 'pad' ? 'text-black' : 'text-zinc-400'}`} />
                    <div className="flex flex-col text-left">
                      <span className="leading-tight">Fit</span>
                      <span className={`text-[8px] font-normal leading-tight ${fitMode === 'pad' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                        Full Video (Black Bars)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode('crop')}
                    className={`py-2 px-2.5 rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                      fitMode === 'crop'
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-zinc-900/90 border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    title="Fill the entire frame by cropping edges"
                  >
                    <Crop className={`w-3.5 h-3.5 ${fitMode === 'crop' ? 'text-black' : 'text-zinc-400'}`} />
                    <div className="flex flex-col text-left">
                      <span className="leading-tight">Cropped</span>
                      <span className={`text-[8px] font-normal leading-tight ${fitMode === 'crop' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                        Fill Frame
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Custom Crop Controls */}
            {aspectRatio === 'custom' && (
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Custom Crop</span>
                <button
                  type="button"
                  onClick={centerCropBox}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition-all cursor-pointer border border-white/10"
                  title="Center the crop framing box"
                >
                  Center Box
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.05]" />

          {/* ── 2. Export Settings ── */}
          <ExportFormatSection
            downloadFormat={downloadFormat as any}
            setDownloadFormat={setDownloadFormat as any}
            downloadQuality={downloadQuality}
            setDownloadQuality={handleSetDownloadQuality}
            downloadAudioBitrate={downloadAudioBitrate as any}
            setDownloadAudioBitrate={setDownloadAudioBitrate as any}
            captionFormat={captionFormat}
            setCaptionFormat={setCaptionFormat}
            captionLang={captionLang}
            setCaptionLang={setCaptionLang}
            availableCaptions={[...(metadata?.subtitles || []), ...(metadata?.automatic_captions || [])]}
            availableQualities={qualityOptions}
            detectedMaxHeight={qualityOptions.length > 0 ? qualityOptions[0].height : undefined}
          />

          <div className="h-px bg-white/[0.05]" />

          {/* ── 3. File Name & Output ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-600 tabular-nums">3.</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">File Name & Output</h3>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">File Name</label>
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder={metadata?.title || 'ClipFlow_Output'}
                className="w-full bg-black/40 border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-medium transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Export Button ── */}
      <div className="border-t border-white/[0.06] p-4 space-y-2.5 shrink-0 bg-[#080808]">
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-3 py-2 rounded-lg text-[11px] flex items-center justify-between gap-2 border ${
              downloadStatus === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : downloadStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/25 text-red-300'
                  : 'bg-blue-500/10 border-blue-500/25 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {downloadStatus === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : downloadStatus === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              )}
              <span className="truncate">{statusMessage}</span>
            </div>
          </motion.div>
        )}

        <button
          onClick={handleExportDownload}
          disabled={isDownloading || !metadata}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isDownloading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
              <span>Downloading clip...</span>
            </>
          ) : (
            <>
              <HardDrive className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              <span>
                Download Clip
                {formatBytes(estimatedBytes) ? ` (${formatBytes(estimatedBytes)})` : ''}
              </span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
