import type { QualityOption } from '../hooks/editor/useEditorMetadata';

export type MobileTab = 'ratio' | 'quality' | 'snap' | 'export' | null;

export interface EditorMobileBottomDockProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  isTrimEnabled: boolean;
  onToggleTrim: () => void;
  isDownloading: boolean;
  downloadStatus: 'idle' | 'running' | 'success' | 'error';
  hasMetadata: boolean;
  // Ratio inline strips
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  applyAspectRatio: (ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom') => void;
  fitMode: 'crop' | 'pad';
  setFitMode: (mode: 'crop' | 'pad') => void;
  centerCropBox: () => void;
  // Quality inline strips
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
  // Snap inline strip
  previewImageMode: 'thumbnail' | 'frame';
  setPreviewImageMode: (mode: 'thumbnail' | 'frame') => void;
  handleDownloadImage: () => Promise<void>;
  isDownloadingImage: boolean;
  downloadSuccess: boolean;
  currentTime: number;
  metadata: any;
}

export interface EditorMobileUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadVideo: (url: string) => void;
  isLoadingMeta: boolean;
  currentUrl?: string;
}
