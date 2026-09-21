import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';

interface EditorHeaderProps {
  metadata: any;
  isLoadingMeta: boolean;
  isProUser: boolean;
  onOpenCompanionModal: () => void;
}

export function EditorHeader({
  metadata,
  isLoadingMeta,
  isProUser,
  onOpenCompanionModal,
}: EditorHeaderProps) {
  return (
    <header className="h-[54px] flex items-center justify-between px-4 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl shrink-0 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {isLoadingMeta && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-400 rounded-full shrink-0"
          />
        )}

        {metadata && (
          <div className="flex items-center gap-2 min-w-0">
            {metadata.uploader && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 shrink-0 max-w-[150px] truncate"
                title={metadata.uploader}
              >
                {metadata.uploader}
              </span>
            )}
            <h1 className="text-sm font-semibold text-gray-200 truncate" title={metadata.title}>
              {metadata.title}
            </h1>
          </div>
        )}
        {!metadata && !isLoadingMeta && (
          <span className="text-sm text-gray-500">ClipFlow Studio</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isProUser && (
          <button
            onClick={onOpenCompanionModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 hover:border-white/30 transition-all shadow-sm active:scale-95 group cursor-pointer"
            title="Download ClipFlow Desktop Engine for local clipping"
          >
            <HardDrive className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white" />
            <span className="hidden sm:inline">Download Engine</span>
            <span className="sm:hidden">Engine</span>
          </button>
        )}
      </div>
    </header>
  );
}
