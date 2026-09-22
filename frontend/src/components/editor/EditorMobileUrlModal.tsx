import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Clipboard, Loader2, Play } from 'lucide-react';

interface EditorMobileUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadVideo: (url: string) => void;
  isLoadingMeta: boolean;
  currentUrl?: string;
}

export const EditorMobileUrlModal: React.FC<EditorMobileUrlModalProps> = ({
  isOpen,
  onClose,
  onLoadVideo,
  isLoadingMeta,
  currentUrl = '',
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = urlInput.trim();
    if (!clean) return;
    onLoadVideo(clean);
    onClose();
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
        }
      }
    } catch {
      // Clipboard permissions denied or unavailable
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-[#0c0c10] border border-white/15 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Switch Video URL</h3>
                  <p className="text-[10px] text-zinc-400">YouTube, Twitch, Instagram, Twitter/X</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative flex items-center bg-black border border-white/15 rounded-xl px-3 py-2.5 focus-within:border-white transition-all">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste video link here..."
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none pr-7"
                  autoFocus
                />
                {urlInput ? (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    className="absolute right-2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="absolute right-2 text-zinc-400 hover:text-white"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Supported platform badges */}
              <div className="flex items-center justify-center gap-1.5 pt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-medium">YouTube</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">Twitch</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20 font-medium">Instagram</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">X / Twitter</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isLoadingMeta}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  {isLoadingMeta ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Load Video</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
