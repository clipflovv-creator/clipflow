import React from 'react';
import { Scissors, Crop, Sliders, Camera, Download, Loader2 } from 'lucide-react';

export type MobileTab = 'ratio' | 'quality' | 'snap' | 'export' | null;

interface EditorMobileBottomDockProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  isTrimEnabled: boolean;
  onToggleTrim: () => void;
  isDownloading: boolean;
  downloadStatus: 'idle' | 'running' | 'success' | 'error';
  hasMetadata: boolean;
}

export const EditorMobileBottomDock: React.FC<EditorMobileBottomDockProps> = ({
  activeTab,
  onSelectTab,
  isTrimEnabled,
  onToggleTrim,
  isDownloading,
  hasMetadata,
}) => {
  if (!hasMetadata) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#09090c]/95 backdrop-blur-xl border-t border-white/10 pb-safe md:hidden select-none">
      <div className="h-[58px] px-3 flex items-center justify-around gap-1">
        {/* Trim Button */}
        <button
          type="button"
          onClick={onToggleTrim}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            isTrimEnabled
              ? 'text-white bg-white/15 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Scissors className={`w-4 h-4 ${isTrimEnabled ? 'text-white' : 'text-zinc-400'}`} />
            {isTrimEnabled && (
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1">Trim</span>
        </button>

        {/* Ratio & Crop */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'ratio' ? null : 'ratio')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeTab === 'ratio'
              ? 'text-white bg-white/15 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Crop className={`w-4 h-4 ${activeTab === 'ratio' ? 'text-white' : 'text-zinc-400'}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Ratio</span>
        </button>

        {/* Quality / Format */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'quality' ? null : 'quality')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeTab === 'quality'
              ? 'text-white bg-white/15 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sliders className={`w-4 h-4 ${activeTab === 'quality' ? 'text-white' : 'text-zinc-400'}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Quality</span>
        </button>

        {/* Snapshot / Frame */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'snap' ? null : 'snap')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeTab === 'snap'
              ? 'text-white bg-white/15 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Camera className={`w-4 h-4 ${activeTab === 'snap' ? 'text-white' : 'text-zinc-400'}`} />
          <span className="text-[10px] font-medium tracking-tight mt-1">Snap</span>
        </button>

        {/* Export CTA Button */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'export' ? null : 'export')}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
            activeTab === 'export' || isDownloading
              ? 'bg-white text-black font-bold shadow-lg shadow-white/10'
              : 'bg-white/10 text-white hover:bg-white/20 font-semibold'
          }`}
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-bold">{isDownloading ? 'Saving' : 'Export'}</span>
        </button>
      </div>
    </div>
  );
};
