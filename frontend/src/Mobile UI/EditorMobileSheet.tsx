import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { MobileTab } from './types';

interface EditorMobileSheetProps {
  activeTab: MobileTab;
  onClose: () => void;
  // Export only
  downloadFormat: 'mp4' | 'mp3' | 'captions';
  captionFormat: 'srt' | 'vtt' | 'txt';
  downloadQuality: string;
  downloadAudioBitrate: string;
  customFileName: string;
  setCustomFileName: (name: string) => void;
  statusMessage: string;
  downloadStatus: 'idle' | 'running' | 'success' | 'error';
  downloadProgress?: number;
  isDownloading: boolean;
  handleExportDownload: () => Promise<void>;
  exportDuration: number;
  estimatedBytes: number;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EditorMobileSheet: React.FC<EditorMobileSheetProps> = ({
  activeTab,
  onClose,
  downloadFormat,
  captionFormat,
  downloadQuality,
  downloadAudioBitrate,
  customFileName,
  setCustomFileName,
  statusMessage,
  downloadStatus,
  downloadProgress = 0,
  isDownloading,
  handleExportDownload,
  exportDuration,
  estimatedBytes,
}) => {
  return (
    <AnimatePresence>
      {activeTab === 'export' && (
        <div className="fixed inset-0 z-50 md:hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Slide-up Sheet */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-0 inset-x-0 bg-[#0d0d12] border-t border-white/15 rounded-t-[26px] max-h-[85vh] flex flex-col shadow-2xl pb-safe overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white">Export Video / Audio</h3>
              </div>
              <button
                type="button" onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-5 space-y-5">

              {/* File name */}
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

              {/* Status indicator & Progress Bar */}
              {(isDownloading || downloadStatus === 'running' || statusMessage) && (
                <div className={`p-3 rounded-xl border flex flex-col gap-2 text-xs transition-all ${
                  downloadStatus === 'running' || isDownloading
                    ? 'bg-zinc-900/90 border-white/10 text-zinc-200'
                    : downloadStatus === 'error'
                      ? 'bg-red-500/10 border-red-500/20 text-red-300'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {downloadStatus === 'running' || isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                      ) : downloadStatus === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate leading-tight font-medium text-[11px]">
                        {statusMessage || 'Exporting clip...'}
                      </span>
                    </div>
                    {(isDownloading || downloadStatus === 'running') && (
                      <span className="font-mono text-xs font-bold text-sky-400 tabular-nums shrink-0">
                        {Math.round(downloadProgress)}%
                      </span>
                    )}
                  </div>

                  {(isDownloading || downloadStatus === 'running') && (
                    <div className="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                      />
                    </div>
                  )}
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
                    <span>Exporting ({Math.round(downloadProgress)}%)…</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Start Export Download</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
