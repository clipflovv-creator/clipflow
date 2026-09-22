import React from 'react';
import { Check, Info, Sparkles } from 'lucide-react';

export interface QualityOption {
  label: string;
  height: number;
  format_id?: string;
  tbr?: number;
  isNative?: boolean;
}

export type DownloadFormat = 'mp4' | 'mp3' | 'captions' | 'wav' | 'm4a' | 'aac';
export type AudioBitrate = '0' | '320k' | '256k' | '192k' | '128k';
export type CaptionFormat = 'srt' | 'vtt' | 'txt';

export const STANDARD_QUALITY_OPTIONS: QualityOption[] = [
  { label: '2160p', height: 2160 },
  { label: '1440p', height: 1440 },
  { label: '1080p', height: 1080 },
  { label: '720p', height: 720 },
  { label: '480p', height: 480 },
  { label: '360p', height: 360 },
  { label: '240p', height: 240 },
];

interface ExportFormatSectionProps {
  downloadFormat: DownloadFormat;
  setDownloadFormat: (format: DownloadFormat) => void;
  downloadQuality: string;
  setDownloadQuality: (quality: string) => void;
  downloadAudioBitrate: AudioBitrate;
  setDownloadAudioBitrate: (bitrate: AudioBitrate) => void;
  captionFormat: CaptionFormat;
  setCaptionFormat: (format: CaptionFormat) => void;
  captionLang?: string;
  setCaptionLang?: (lang: string) => void;
  availableCaptions?: string[];
  availableQualities?: QualityOption[];
  detectedMaxHeight?: number;
}

function getLanguageDisplayName(code: string): string {
  try {
    const clean = code.split('-')[0].toLowerCase();
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(clean);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

export const ExportFormatSection: React.FC<ExportFormatSectionProps> = ({
  downloadFormat,
  setDownloadFormat,
  downloadQuality,
  setDownloadQuality,
  downloadAudioBitrate,
  setDownloadAudioBitrate,
  captionFormat,
  setCaptionFormat,
  captionLang = 'auto',
  setCaptionLang,
  availableCaptions = [],
  availableQualities = [],
  detectedMaxHeight,
}) => {
  // Determine highest native resolution detected on source video
  const maxNativeHeight = React.useMemo(() => {
    if (detectedMaxHeight && detectedMaxHeight > 0) return detectedMaxHeight;
    const nativeFromList = availableQualities
      .filter((q) => q.isNative !== false)
      .map((q) => q.height)
      .filter((h) => typeof h === 'number' && h > 0);
    if (nativeFromList.length > 0) return Math.max(...nativeFromList);
    return 1080;
  }, [detectedMaxHeight, availableQualities]);

  const isOptionNative = (height: number): boolean => {
    if (!availableQualities || availableQualities.length === 0) {
      return height <= maxNativeHeight;
    }
    return availableQualities.some(
      (q) => (q.isNative !== false) && (Math.abs(q.height - height) <= 80 || (height >= 2160 && q.height >= 2000))
    );
  };

  const qualityList: QualityOption[] = STANDARD_QUALITY_OPTIONS.map((opt) => {
    const matched = availableQualities.find((q) => Math.abs(q.height - opt.height) <= 80);
    const native = isOptionNative(opt.height);
    return {
      ...opt,
      format_id: matched?.format_id || 'best',
      tbr: matched?.tbr,
      isNative: native,
    };
  });

  const selectedHeight = React.useMemo(() => {
    const clean = parseInt((downloadQuality || '').replace(/[^\d]/g, ''), 10);
    return clean || 1080;
  }, [downloadQuality]);

  const isSelectedQualityNative = isOptionNative(selectedHeight);

  // Find nearest native quality that is available
  const nearestNativeQuality = React.useMemo(() => {
    const nativeOpts = qualityList.filter((q) => q.isNative);
    if (nativeOpts.length === 0) return `${maxNativeHeight}p`;
    const lowerOrEqual = nativeOpts.filter((q) => q.height <= selectedHeight);
    if (lowerOrEqual.length > 0) {
      const sorted = [...lowerOrEqual].sort((a, b) => b.height - a.height);
      return sorted[0].label;
    }
    const sortedAll = [...nativeOpts].sort((a, b) => b.height - a.height);
    return sortedAll[0]?.label || `${maxNativeHeight}p`;
  }, [qualityList, selectedHeight, maxNativeHeight]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-600 tabular-nums">2.</span>
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Export Format & Quality</h3>
      </div>

      {/* Format Selector Tabs */}
      <div className="flex gap-1.5 p-1 bg-black rounded-xl border border-white/10">
        {[
          { id: 'mp4', label: 'MP4 Video' },
          { id: 'mp3', label: 'MP3 Audio' },
          { id: 'captions', label: 'Subtitles' },
        ].map((f) => {
          const isSelected = downloadFormat === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setDownloadFormat(f.id as DownloadFormat)}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-white text-black font-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 1. Video Quality Selection ── */}
      {downloadFormat === 'mp4' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Video Resolution</p>
            <span className="text-[10px] font-semibold text-zinc-500">
              Source Max: <span className="text-zinc-300 font-bold">{maxNativeHeight}p</span>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {qualityList.map((q) => {
              const displayLabel = `${q.height}p`;

              // Match by label or by height number
              const isSelected =
                downloadQuality === q.label ||
                downloadQuality.toLowerCase().startsWith(`${q.height}`) ||
                (q.height >= 2160 && downloadQuality.toLowerCase().includes('2160')) ||
                (q.height === 1440 && downloadQuality.toLowerCase().includes('1440')) ||
                (q.height === 1080 && downloadQuality.toLowerCase().includes('1080'));

              let badge = '';
              if (q.height >= 2160) badge = '4K';
              else if (q.height === 1440) badge = '2K';
              else if (q.height === 1080) badge = 'HD';

              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDownloadQuality(q.label)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all relative flex flex-col items-center justify-center gap-0.5 group cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black font-black border-white shadow-md'
                      : q.isNative
                        ? 'bg-zinc-950/80 border-white/10 hover:border-white/30 text-zinc-300 hover:text-white'
                        : 'bg-zinc-950/40 border-white/5 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-black/20 flex items-center justify-center">
                      <Check className="w-2 h-2 text-black" />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold tracking-tight">{displayLabel}</span>
                    {badge && (
                      <span
                        className={`text-[8px] px-1 py-0.2 rounded font-extrabold tracking-wider ${
                          isSelected
                            ? 'bg-black text-white'
                            : q.isNative
                              ? 'bg-white/15 text-white'
                              : 'bg-white/5 text-zinc-500'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[8.5px] leading-tight ${
                      isSelected
                        ? 'text-zinc-600 font-semibold'
                        : q.isNative
                          ? 'text-emerald-400 font-medium'
                          : 'text-zinc-500'
                    }`}
                  >
                    {q.isNative ? 'Native' : `Near ${nearestNativeQuality}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quality Note: When selected quality exceeds source video resolution */}
          {!isSelectedQualityNative && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <Info className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-0.5 text-left">
                <p className="text-[11px] font-bold text-amber-200">
                  Source Quality Note ({downloadQuality})
                </p>
                <p className="text-[10px] text-amber-300/90 leading-relaxed">
                  This video source maxes out at <span className="font-semibold text-white">{maxNativeHeight}p</span>. 
                  Selecting <span className="font-semibold text-white">{downloadQuality}</span> will automatically download the highest available native <span className="font-semibold text-emerald-400">{nearestNativeQuality}</span> stream directly from the CDN with zero distortion.
                </p>
              </div>
            </div>
          )}

          {/* Quality Note: When 4K / 2K is natively available */}
          {isSelectedQualityNative && selectedHeight >= 1440 && (
            <div className="flex items-start gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" />
              <p className="text-[10px] text-emerald-300/90 leading-relaxed text-left">
                ✨ <strong>{downloadQuality} Ultra-HD stream detected!</strong> Full resolution stream will be fetched directly from the CDN.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Audio Bitrate & Quality Selection ── */}
      {downloadFormat === 'mp3' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bitrate</p>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: '0', label: 'Best VBR' },
              { id: '320k', label: '320 kbps' },
              { id: '256k', label: '256 kbps' },
              { id: '192k', label: '192 kbps' },
              { id: '128k', label: '128 kbps' },
            ].map((b) => {
              const isSelected = downloadAudioBitrate === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setDownloadAudioBitrate(b.id as AudioBitrate)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all relative ${
                    isSelected
                      ? 'bg-white text-black font-black border-white shadow-md'
                      : 'bg-zinc-950/80 border-white/10 hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">{b.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Subtitles Selection ── */}
      {downloadFormat === 'captions' && (
        <div className="space-y-3 p-3 rounded-xl bg-black border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Subtitle Format</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['srt', 'vtt', 'txt'] as const).map((s) => {
                const isSelected = captionFormat === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCaptionFormat(s)}
                    className={`py-2 rounded-lg text-center border transition-all ${
                      isSelected
                        ? 'bg-white text-black font-black border-white'
                        : 'bg-zinc-950/80 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs uppercase">{s}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 px-3 py-2.5 rounded-lg bg-zinc-950/80 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language</span>
              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {captionLang === 'auto' || !captionLang ? 'Auto Detect' : captionLang.toUpperCase()}
              </span>
            </div>
            <select
              value={captionLang || 'auto'}
              onChange={(e) => setCaptionLang && setCaptionLang(e.target.value)}
              className="w-full bg-black border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/40 cursor-pointer"
            >
              <option value="auto">✨ Automatic (Original Video Audio / Any)</option>
              <option value="en">English (en)</option>
              {Array.from(new Set([
                ...(availableCaptions || []),
                'ta', 'hi', 'te', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar', 'zh', 'it'
              ]))
                .filter((c) => c !== 'en' && c !== 'auto' && !c.includes('en-'))
                .map((code) => (
                  <option key={code} value={code}>
                    {getLanguageDisplayName(code)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportFormatSection;
