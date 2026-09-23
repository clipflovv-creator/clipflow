import { HardDrive, Menu, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EditorHeaderProps {
  metadata: any;
  isLoadingMeta: boolean;
  isProUser: boolean;
  onOpenCompanionModal: () => void;
  onOpenMobileMenu?: () => void;
}

export function EditorHeader({
  metadata,
  isLoadingMeta,
  isProUser,
  onOpenCompanionModal,
  onOpenMobileMenu,
}: EditorHeaderProps) {
  const navigate = useNavigate();

  // Platform detector helper
  const getPlatformBadge = () => {
    if (!metadata?.extractor && !metadata?.url && !metadata?.webpage_url) return null;
    const url = (metadata?.webpage_url || metadata?.url || metadata?.extractor || '').toLowerCase();
    if (url.includes('youtube') || url.includes('youtu.be')) {
      return { label: 'YouTube', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }
    if (url.includes('twitch')) {
      return { label: 'Twitch', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
    if (url.includes('instagram')) {
      return { label: 'Instagram', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' };
    }
    if (url.includes('twitter') || url.includes('x.com')) {
      return { label: 'X / Twitter', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
    return null;
  };

  const badge = getPlatformBadge();

  return (
    <>
      {/* ══ MOBILE NATIVE APP BAR (< md) ══ */}
      {/* Layout: [Back] [Menu] [Logo] [Title — grows] [Platform badge] */}
      <header className="h-[52px] flex md:hidden items-center px-2 border-b border-white/[0.08] bg-[#09090c]/95 backdrop-blur-xl shrink-0 gap-1.5 select-none z-30">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
          title="Back to Home"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Menu (3-bar) */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
            title="Open Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Logo */}
        <img src="/logo.ico" alt="ClipFlow" className="w-5 h-5 object-contain shrink-0" />

        {/* Title — grows to fill space */}
        <div className="flex-1 min-w-0">
          {isLoadingMeta && !metadata?.title ? (
            <div className="w-28 h-3.5 rounded-md yt-skeleton" />
          ) : metadata?.title ? (
            <p className="text-xs font-semibold text-zinc-200 truncate tracking-tight" title={metadata.title}>
              {metadata.title}
            </p>
          ) : (
            <span className="text-xs font-bold text-zinc-300">ClipFlow Studio</span>
          )}
        </div>

        {/* Platform badge */}
        {badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </header>

      {/* ══ DESKTOP APP BAR (>= md) ══ */}
      <header className="hidden md:flex h-[54px] items-center justify-between px-4 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isLoadingMeta && !metadata?.title && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-16 h-5 rounded-md yt-skeleton shrink-0" />
              <div className="w-48 sm:w-72 md:w-96 h-4 rounded-md yt-skeleton shrink-0" />
            </div>
          )}

          {metadata?.title && (
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
              <span>Download Engine</span>
            </button>
          )}
        </div>
      </header>
    </>
  );
}
