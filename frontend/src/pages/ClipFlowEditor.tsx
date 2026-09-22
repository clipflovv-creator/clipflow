import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Film, Check, X, HardDrive, Download
} from 'lucide-react';
import type { YouTubePlayer } from 'react-youtube';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { CloudStorageModal } from '../components/CloudStorageModal';
import { AuthModal } from '../components/AuthModal';
import { EditorSidebar } from '../components/EditorSidebar';
import { type CropBox } from '../components/CropFrameOverlay';
import { useTwitchPreview } from '../components/Twitch/useTwitchPreview';
import { isTwitchLiveChannelUrl } from '../components/Twitch/useTwitchLiveChannel';
import { exportTwitchClipInBrowser } from '../services/browserTwitchExporter';
import { saveTwitchSession, getTwitchSession } from '../utils/twitchChunkStorage';
import {
  getEditorSession,
  saveEditorSession,
  type ProcessingMode,
  getStoredProcessingMode,
  setStoredProcessingMode,
} from '../utils/editorSession';
import { detectPlatform, extractYouTubeId } from '../utils/platforms';
import { ClientVideoExportEngine } from '../services/clientVideoExportEngine';

// Modular Editor Components
import {
  EditorHeader,
  EditorPlayerStage,
  EditorPlaybackControls,
  EditorTimeline,
  EditorExportPanel,
} from '../components/editor';
import { useEditorMetadata } from '../hooks/editor/useEditorMetadata';
import { useEditorPlayback } from '../hooks/editor/useEditorPlayback';

import { resolveRelayUrl, getAudioTrackScore } from '../services/clientMediaRangeFetcher.js';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

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

export default function ClipFlowEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawUrl = searchParams.get('url') || '';

  const initialSession = useMemo(() => {
    return getEditorSession(rawUrl || undefined);
  }, [rawUrl]);

  const initialTwitchSession = useMemo(() => {
    if (rawUrl && isTwitchLiveChannelUrl(rawUrl)) {
      return getTwitchSession(rawUrl);
    }
    return null;
  }, [rawUrl]);

  const [activeUrl, setActiveUrl] = useState(rawUrl || initialSession?.activeUrl || '');
  const youtubeId = extractYouTubeId(activeUrl);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [showUrlChange, setShowUrlChange] = useState(!rawUrl && !initialSession?.activeUrl);

  const { token, isAuthenticated, isPro } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCloudStorageModal, setShowCloudStorageModal] = useState(false);
  const [showCompanionModal, setShowCompanionModal] = useState(false);

  const engineParam = searchParams.get('engine');
  const modeParam = searchParams.get('mode');

  const initialProcessingMode: ProcessingMode = useMemo(() => {
    if (modeParam === 'pro' || engineParam === 'server') return 'pro';
    if (initialSession?.processingMode) return initialSession.processingMode;
    if (initialSession?.exportMode) return initialSession.exportMode;
    const stored = getStoredProcessingMode();
    if (stored) return stored;
    return 'pro';
  }, [modeParam, engineParam, initialSession?.processingMode, initialSession?.exportMode]);

  const [processingMode] = useState<ProcessingMode>(initialProcessingMode);
  const isProUser = processingMode === 'pro';
  const exportMode: 'free' | 'pro' = processingMode;

  useEffect(() => {
    setStoredProcessingMode(processingMode);
  }, [processingMode]);

  // Platform Detection
  const platformInfo = useMemo(() => {
    return detectPlatform(activeUrl || '');
  }, [activeUrl]);

  const isYouTube = platformInfo.isYouTube;

  const isTwitter = useMemo(() => {
    return Boolean(
      platformInfo.isTwitter ||
      activeUrl.includes('twitter.com') ||
      activeUrl.includes('x.com')
    );
  }, [platformInfo, activeUrl]);

  const isTwitch = useMemo(() => {
    const u = activeUrl.toLowerCase();
    return Boolean(
      platformInfo.isTwitch ||
      u.includes('twitch.tv')
    );
  }, [platformInfo, activeUrl]);

  const isInstagram = useMemo(() => {
    const u = activeUrl.toLowerCase();
    return Boolean(
      platformInfo.isInstagram ||
      u.includes('instagram.com')
    );
  }, [platformInfo, activeUrl]);

  // Platform Metadata Hook
  const {
    metadata,
    isLoadingMeta,
    errorMeta,
    setErrorMeta,
    qualityOptions,
    previewQualities,
    defaultPreviewStreamUrl,
    fetchVideo,
  } = useEditorMetadata(activeUrl, initialSession?.metadata, isTwitch);

  const lastFetchedUrlRef = useRef<string>('');

  // Player Element References
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoCanvasRef = useRef<HTMLDivElement>(null);

  // Timeline / Trim Range State
  const [actualDuration, setActualDuration] = useState<number>(() => {
    if (initialTwitchSession && initialTwitchSession.effectiveDuration > 0) return initialTwitchSession.effectiveDuration;
    return initialSession?.metadata?.duration || 0;
  });

  const isTrimEnabled = true;
  const [trimRange, setTrimRange] = useState<[number, number]>(() => {
    if (rawUrl && isTwitchLiveChannelUrl(rawUrl)) return [0, 60];
    if (initialTwitchSession && initialTwitchSession.trimRange) return initialTwitchSession.trimRange;
    return initialSession?.trimRange || [0, 60];
  });

  const effectiveDuration = actualDuration > 0 ? actualDuration : (metadata?.duration && metadata.duration > 0 ? metadata.duration : 0);

  const handleMediaDurationUpdate = (dur: number) => {
    if (!dur || dur <= 0 || !Number.isFinite(dur)) return;
    setActualDuration((prev) => {
      if (dur > prev || prev === 0) {
        return Math.round(dur);
      }
      return prev;
    });
  };

  // Unified Playback Hook
  const {
    isPlaying,
    isPlayingRef,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    volume,
    isMuted,
    isVideoBuffering,
    setIsVideoBuffering,
    isSeekingRef,
    pendingSeekTimeRef,
    seekOriginTimeRef,
    lastSeekTimeRef,
    togglePlay,
    seekToPosition,
    pauseAndSeek,
    seekRelative,
    handleVolumeChange,
    toggleMute,
  } = useEditorPlayback(
    youtubeId,
    youtubePlayerRef,
    videoElementRef,
    audioElementRef,
    effectiveDuration,
    trimRange,
    rawUrl && isTwitchLiveChannelUrl(rawUrl) ? 0 : (initialTwitchSession?.currentTime || initialSession?.currentTime || 0),
    initialTwitchSession?.volume ?? initialSession?.volume ?? 1,
    initialTwitchSession?.isMuted ?? initialSession?.isMuted ?? false
  );

  // Resizable Splitters
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(initialSession?.leftSidebarWidth || 230);
  const [isDraggingLSplitter, setIsDraggingLSplitter] = useState<boolean>(false);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(initialSession?.rightPanelWidth || 340);
  const [isDraggingVSplitter, setIsDraggingVSplitter] = useState<boolean>(false);
  const [videoHeight, setVideoHeight] = useState<number>(initialSession?.videoHeight || 440);
  const [isDraggingHSplitter, setIsDraggingHSplitter] = useState<boolean>(false);

  // Export Settings & Framing
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5' | 'custom'>(initialSession?.aspectRatio || '16:9');
  const [cropBox, setCropBox] = useState<CropBox>(initialSession?.cropBox || { x: 0, y: 0, width: 1, height: 1 });
  const [containerDims, setContainerDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: initialSession?.metadata?.width || 1920,
    height: initialSession?.metadata?.height || 1080,
  });

  useEffect(() => {
    if (!metadata) return;
    if (metadata.width && metadata.height && metadata.width > 0 && metadata.height > 0) {
      setVideoDimensions({ width: metadata.width, height: metadata.height });
    }
    if (metadata.title && !customFileName) {
      setCustomFileName(metadata.title);
    }
    const dur = metadata.duration && metadata.duration > 0 ? metadata.duration : 0;
    if (dur > 0) {
      setActualDuration((prev) => (dur > prev || prev === 0 ? Math.round(dur) : prev));
      setTrimRange((prev) => {
        if (prev[0] === 0 && (prev[1] === 60 || prev[1] === 0 || prev[1] < dur)) {
          return [0, Math.round(dur)];
        }
        return prev;
      });
    }
  }, [metadata]);

  const sourceAspectRatio = useMemo(() => {
    if (videoDimensions.width > 0 && videoDimensions.height > 0) {
      return videoDimensions.width / videoDimensions.height;
    }
    if (metadata?.width && metadata?.height && metadata.width > 0 && metadata.height > 0) {
      return metadata.width / metadata.height;
    }
    return 16 / 9;
  }, [videoDimensions.width, videoDimensions.height, metadata]);

  const [fitMode, setFitMode] = useState<'crop' | 'pad'>(initialSession?.fitMode || 'crop');
  const isPadMode = aspectRatio !== '16:9' && aspectRatio !== 'custom' && fitMode === 'pad';

  const currentContainerAspect = useMemo(() => {
    if (isPadMode) {
      if (aspectRatio === '9:16') return 9 / 16;
      if (aspectRatio === '1:1') return 1;
      if (aspectRatio === '4:5') return 4 / 5;
    }
    return sourceAspectRatio;
  }, [isPadMode, aspectRatio, sourceAspectRatio]);

  const [cropPosition, setCropPosition] = useState<'center' | 'left' | 'right'>(initialSession?.cropPosition || 'center');
  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mp3' | 'captions'>(initialSession?.downloadFormat || 'mp4');
  const [captionFormat, setCaptionFormat] = useState<'srt' | 'vtt' | 'txt'>(initialSession?.captionFormat || 'srt');
  const [captionLang, setCaptionLang] = useState<string>(initialSession?.captionLang || 'auto');
  const [downloadQuality, setDownloadQuality] = useState('1080p');
  const [downloadAudioBitrate, setDownloadAudioBitrate] = useState<'0' | '320k' | '256k' | '192k' | '128k'>((initialSession?.downloadAudioBitrate as any) || '0');
  const [customFileName, setCustomFileName] = useState(initialSession?.customFileName || '');

  // Download & Status
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Quality menu & selected quality state
  const [selectedPreviewQualityUrl, setSelectedPreviewQualityUrl] = useState<string>('');
  const [selectedQualityId, setSelectedQualityId] = useState<string>('');

  const currentTwitchPreviewQuality = selectedQualityId || downloadQuality || '1080p';
  const {
    twitchHlsUrl,
    isTwitchLiveChannel,
    qualities: twitchQualities,
  } = useTwitchPreview(isTwitch, activeUrl, metadata, isProUser, currentTwitchPreviewQuality);

  const isLiveChannelUrl = isTwitchLiveChannel;

  // Real multi-quality tiers for Twitch vs standard platforms
  const effectivePreviewQualities = useMemo(() => {
    if (isTwitch && twitchQualities && twitchQualities.length > 0) {
      return twitchQualities.map((q) => ({
        id: q.id,
        label: q.label,
        height: q.height,
        url: q.proxiedUrl || q.url,
        isAvailable: true,
        hasAudio: true,
      }));
    }
    return previewQualities;
  }, [isTwitch, twitchQualities, previewQualities]);

  const effectiveQualityOptions = useMemo(() => {
    if (isTwitch && twitchQualities && twitchQualities.length > 0) {
      return twitchQualities.filter(q => q.height > 0).map((q) => ({
        label: q.label,
        height: q.height,
        format_id: q.id,
        tbr: q.bandwidth,
        isNative: true,
      }));
    }
    return qualityOptions;
  }, [isTwitch, twitchQualities, qualityOptions]);

  // Thumbnail vs Frame Mode
  const [previewImageMode, setPreviewImageMode] = useState<'thumbnail' | 'frame'>('thumbnail');
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // ResizeObserver for video container
  useEffect(() => {
    const el = videoCanvasRef.current || videoContainerRef.current;
    if (!el) return;
    const updateDims = () => {
      if (el) setContainerDims({ width: el.clientWidth, height: el.clientHeight });
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, [metadata, videoHeight, sourceAspectRatio, currentContainerAspect]);

  const [useProxyFallback, setUseProxyFallback] = useState<boolean>(false);

  useEffect(() => {
    setSelectedQualityId('');
    setSelectedPreviewQualityUrl('');
    setIsVideoBuffering(false);
    setUseProxyFallback(false);
  }, [activeUrl]);

  const currentQualityLabel = useMemo(() => {
    const activeId = selectedQualityId || downloadQuality;
    if (activeId) {
      const match = effectivePreviewQualities.find(q => q.id === activeId || q.id === `${activeId}p` || q.label.toLowerCase().startsWith(activeId.toLowerCase()));
      if (match) return match.label;
      return activeId;
    }
    if (selectedPreviewQualityUrl) {
      const match = effectivePreviewQualities.find(q => q.url === selectedPreviewQualityUrl);
      if (match) return match.label;
    }
    if (defaultPreviewStreamUrl && effectivePreviewQualities.length > 0) {
      const exactMatch = effectivePreviewQualities.find(q => q.url === defaultPreviewStreamUrl && q.isAvailable);
      if (exactMatch) return exactMatch.label;
      return effectivePreviewQualities.find(q => q.id === '1080p')?.label || effectivePreviewQualities.find(q => q.id === '720p')?.label || effectivePreviewQualities[0].label;
    }
    return '1080p (Full HD)';
  }, [selectedQualityId, downloadQuality, selectedPreviewQualityUrl, effectivePreviewQualities, defaultPreviewStreamUrl]);

  const handleSelectPreviewQuality = (qualityItem: { id: string; url: string; label: string }) => {
    const wasPlaying = isPlaying;
    const curTime = videoElementRef.current ? videoElementRef.current.currentTime : currentTime;

    setSelectedQualityId(qualityItem.id);
    setSelectedPreviewQualityUrl(qualityItem.url);
    setDownloadQuality(qualityItem.id);

    setTimeout(() => {
      if (videoElementRef.current) {
        videoElementRef.current.currentTime = curTime;
        if (wasPlaying) {
          videoElementRef.current.play().catch(() => {});
        }
      }
    }, 60);
  };

  const handleSetDownloadQuality = (quality: string) => {
    setDownloadQuality(quality);
    const cleanNum = parseInt(quality.replace(/[^\d]/g, ''), 10);
    if (cleanNum) {
      const qId = `${cleanNum}p`;
      setSelectedQualityId(qId);
      const match = effectivePreviewQualities.find((q) => q.height === cleanNum);
      if (match) {
        handleSelectPreviewQuality(match);
      }
    }
  };

  const rawPreviewSrc = selectedPreviewQualityUrl || defaultPreviewStreamUrl || metadata?.direct_stream_url || metadata?.url || '';

  const activeVideoSrc = useMemo(() => {
    if (isTwitch) return selectedPreviewQualityUrl || twitchHlsUrl;
    if (!rawPreviewSrc) return '';
    if (isTwitter || isInstagram || useProxyFallback || rawPreviewSrc.includes('twimg.com') || rawPreviewSrc.includes('cdninstagram.com') || rawPreviewSrc.includes('instagram.com')) {
      return resolveRelayUrl(rawPreviewSrc);
    }
    return rawPreviewSrc;
  }, [rawPreviewSrc, isTwitter, isInstagram, useProxyFallback, isTwitch, twitchHlsUrl, selectedPreviewQualityUrl]);

  const activeVideoHasAudio = useMemo(() => {
    if (!metadata || !rawPreviewSrc) return true;
    const matchingFormat = (metadata.formats || []).find((f: any) => f.url === rawPreviewSrc);
    if (matchingFormat) {
      return Boolean(matchingFormat.acodec && matchingFormat.acodec !== 'none');
    }
    return true;
  }, [metadata, rawPreviewSrc]);

  const activeAudioSrc = useMemo(() => {
    if (activeVideoHasAudio || !metadata || youtubeId) return null;

    const defaultLang = metadata?.audio_language || metadata?.language;
    const directAudioCandidates = [
      ...(metadata.audio_formats || []),
      ...(metadata.formats || []).filter((f: any) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')),
      ...(metadata.formats || []).filter((f: any) => f.acodec && f.acodec !== 'none'),
    ].filter((f: any) => f.url);

    const sortedAudio = [...directAudioCandidates].sort(
      (a, b) => getAudioTrackScore(b, defaultLang) - getAudioTrackScore(a, defaultLang)
    );

    const audioTrack = sortedAudio[0];

    if (!audioTrack?.url) return null;

    let audioUrl = audioTrack.url;
    if (isTwitter || isInstagram || audioUrl.includes('twimg.com') || audioUrl.includes('cdninstagram.com') || audioUrl.includes('instagram.com') || useProxyFallback) {
      return `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(audioUrl)}`;
    }
    return audioUrl;
  }, [metadata, activeVideoHasAudio, youtubeId, isInstagram, isTwitter, useProxyFallback]);

  // Socket.io for cloud export progress
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Splitter Dragging Listeners
  useEffect(() => {
    if (!isDraggingLSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 160 && newWidth <= 420) {
        setLeftSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => setIsDraggingLSplitter(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingLSplitter]);

  useEffect(() => {
    if (!isDraggingVSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 260 && newWidth <= 640) {
        setRightPanelWidth(newWidth);
      }
    };
    const onMouseUp = () => setIsDraggingVSplitter(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingVSplitter]);

  useEffect(() => {
    if (!isDraggingHSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      if (videoContainerRef.current) {
        const rect = videoContainerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        if (newHeight >= 200 && newHeight <= 750) {
          setVideoHeight(newHeight);
        }
      }
    };
    const onMouseUp = () => setIsDraggingHSplitter(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingHSplitter]);

  // Session Auto-save
  useEffect(() => {
    if (!activeUrl) return;
    saveEditorSession({
      activeUrl,
      metadata,
      currentTime,
      trimRange,
      aspectRatio,
      cropBox,
      fitMode,
      cropPosition,
      downloadFormat,
      captionFormat,
      captionLang,
      downloadQuality,
      downloadAudioBitrate,
      customFileName,
      exportMode,
      selectedPreviewQualityUrl,
      videoHeight,
      rightPanelWidth,
      leftSidebarWidth,
      volume,
      isMuted,
    });

    if (isLiveChannelUrl) {
      saveTwitchSession(activeUrl, {
        currentTime,
        effectiveDuration,
        trimRange,
        isTrimEnabled,
        aspectRatio,
        fitMode,
        cropBox,
        volume,
        isMuted,
      });
    }
  }, [
    activeUrl, metadata, currentTime, trimRange, isTrimEnabled,
    aspectRatio, cropBox, fitMode, cropPosition, downloadFormat,
    captionFormat, captionLang, downloadQuality, downloadAudioBitrate,
    customFileName, exportMode, selectedPreviewQualityUrl, videoHeight,
    rightPanelWidth, leftSidebarWidth, volume, isMuted, isLiveChannelUrl, effectiveDuration
  ]);

  const handleLoadVideo = (url: string) => {
    const clean = url.trim();
    if (!clean) return;
    lastFetchedUrlRef.current = clean;
    setActiveUrl(clean);
    try { localStorage.setItem('clipflow_active_video_url', clean); } catch {}
    setSearchParams({ url: clean });
    setShowUrlChange(false);
    fetchVideo(clean, true);
  };

  // Sync active URL on mount / search params change
  useEffect(() => {
    if (rawUrl) {
      if (lastFetchedUrlRef.current === rawUrl) return;
      lastFetchedUrlRef.current = rawUrl;
      setActiveUrl(rawUrl);
      try { localStorage.setItem('clipflow_active_video_url', rawUrl); } catch {}
      fetchVideo(rawUrl);
    } else {
      try {
        const cachedUrl = localStorage.getItem('clipflow_active_video_url');
        if (cachedUrl) {
          if (lastFetchedUrlRef.current === cachedUrl) return;
          lastFetchedUrlRef.current = cachedUrl;
          setActiveUrl(cachedUrl);
          setSearchParams({ url: cachedUrl }, { replace: true });
          fetchVideo(cachedUrl);
        }
      } catch {}
    }
  }, [rawUrl, fetchVideo]);

  // Framing handlers
  const applyAspectRatio = (ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom') => {
    setAspectRatio(ratio);
    if (ratio === '16:9') {
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
    } else if (ratio === '9:16' || ratio === '1:1' || ratio === '4:5') {
      let targetRatio = 1;
      if (ratio === '9:16') targetRatio = 9 / 16;
      else if (ratio === '1:1') targetRatio = 1;
      else if (ratio === '4:5') targetRatio = 4 / 5;

      let w = 1;
      let h = 1;
      if (targetRatio < sourceAspectRatio) {
        h = 1;
        w = Math.min(1, targetRatio / sourceAspectRatio);
      } else {
        w = 1;
        h = Math.min(1, sourceAspectRatio / targetRatio);
      }
      setCropBox({
        x: Math.max(0, (1 - w) / 2),
        y: Math.max(0, (1 - h) / 2),
        width: w,
        height: h,
      });
    } else if (ratio === 'custom') {
      setCropBox((prev) => {
        if (prev.width === 1 && prev.height === 1) {
          return { x: 0.25, y: 0.1, width: 0.5, height: 0.8 };
        }
        return prev;
      });
    }
  };

  const centerCropBox = () => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(1 - prev.width, (1 - prev.width) / 2)),
      y: Math.max(0, Math.min(1 - prev.height, (1 - prev.height) / 2)),
    }));
    setCropPosition('center');
  };

  const handleCropBoxChange = (newBox: CropBox) => {
    setCropBox(newBox);
    const centerX = (1 - newBox.width) / 2;
    if (newBox.x <= 0.02) {
      setCropPosition('left');
    } else if (Math.abs(newBox.x - centerX) <= 0.03) {
      setCropPosition('center');
    } else if (newBox.x >= 1 - newBox.width - 0.02) {
      setCropPosition('right');
    }
  };

  const triggerNativeDownload = (blobOrUrl: Blob | string, filename: string) => {
    let url: string;
    let isObjectUrl = false;
    if (blobOrUrl instanceof Blob) {
      url = window.URL.createObjectURL(blobOrUrl);
      isObjectUrl = true;
    } else {
      url = blobOrUrl;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
      if (isObjectUrl) window.URL.revokeObjectURL(url);
    }, 5000);
  };

  // Thumbnail / Frame Snapshot Download (PNG Only)
  const handleDownloadImage = async () => {
    if (isDownloadingImage) return;
    setIsDownloadingImage(true);

    try {
      const cleanTitle = (metadata?.title || 'thumbnail').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (previewImageMode === 'thumbnail') {
        const thumbUrl = metadata?.thumbnail || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : '');
        if (!thumbUrl) throw new Error('No thumbnail available');

        let blob: Blob | null = null;
        try {
          const res = await fetch(thumbUrl, { mode: 'cors' });
          if (res.ok) blob = await res.blob();
        } catch {}

        if (!blob) {
          try {
            const proxyUrl = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(thumbUrl)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) blob = await res.blob();
          } catch {}
        }

        if (blob) {
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (pngBlob) {
              triggerNativeDownload(pngBlob, `${cleanTitle}_thumbnail.png`);
              setDownloadSuccess(true);
              setTimeout(() => setDownloadSuccess(false), 2000);
              return;
            }
          }
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => {
            img.onerror = reject;
            img.src = resolveRelayUrl(thumbUrl);
          };
          img.src = thumbUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1280;
        canvas.height = img.naturalHeight || 720;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (pngBlob) {
          triggerNativeDownload(pngBlob, `${cleanTitle}_thumbnail.png`);
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 2000);
          return;
        }
      } else {
        const targetTime = currentTime;
        const timeStr = `${Math.floor(targetTime / 60)}m${Math.floor(targetTime % 60)}s`;
        const isCropped = aspectRatio !== '16:9';
        const cropSuffix = isCropped ? `_${aspectRatio.replace(':', 'x')}` : '';
        const fileName = `${cleanTitle}_frame_${timeStr}${cropSuffix}.png`;

        // 1. Client-side canvas frame capture when HTML5 video is playing
        if (videoElementRef.current && videoElementRef.current.videoWidth > 0) {
          try {
            const v = videoElementRef.current;
            const canvas = document.createElement('canvas');
            let sx = 0, sy = 0, sw = v.videoWidth, sh = v.videoHeight;
            if (isCropped && cropBox) {
              sx = Math.round(cropBox.x * v.videoWidth);
              sy = Math.round(cropBox.y * v.videoHeight);
              sw = Math.round(cropBox.width * v.videoWidth);
              sh = Math.round(cropBox.height * v.videoHeight);
            }
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
              const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
              if (pngBlob) {
                triggerNativeDownload(pngBlob, fileName);
                setDownloadSuccess(true);
                setTimeout(() => setDownloadSuccess(false), 2000);
                return;
              }
            }
          } catch (canvasErr) {
            console.warn('[Client Canvas Frame Capture Warning, falling back to server]', canvasErr);
          }
        }

        // 2. High-resolution server-side frame extraction (YouTube or direct stream)
        const cropParam = isCropped
          ? `&crop_x=${cropBox.x}&crop_y=${cropBox.y}&crop_w=${cropBox.width}&crop_h=${cropBox.height}`
          : '';

        let backendUrl: string;
        if (isLiveChannelUrl) {
          const chunkOffset = Math.floor(targetTime / 5) * 5;
          const localTime = +(targetTime - chunkOffset).toFixed(3);
          backendUrl = `${BACKEND_URL}/api/twitch-live/live-frame?url=${encodeURIComponent(activeUrl)}&chunkOffset=${chunkOffset}&localTime=${localTime}&globalTime=${targetTime}&quality=${encodeURIComponent(downloadQuality)}&download=true&format=png&title=${encodeURIComponent(cleanTitle)}${cropParam}`;
        } else {
          const streamParam = rawPreviewSrc ? `&streamUrl=${encodeURIComponent(rawPreviewSrc)}` : '';
          backendUrl = `${BACKEND_URL}/api/video/frame?url=${encodeURIComponent(activeUrl)}&time=${targetTime}&quality=${encodeURIComponent(downloadQuality)}&download=true&fullRes=true&format=png&title=${encodeURIComponent(cleanTitle)}${cropParam}${streamParam}`;
        }

        const res = await fetch(backendUrl);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server failed to capture frame (HTTP ${res.status})`);
        }
        const blob = await res.blob();
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
        triggerNativeDownload(pngBlob, fileName);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      }
    } catch (e: any) {
      console.error('[Download Image Error]', e);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const saveToHistory = (item: any) => {
    try {
      const saved = localStorage.getItem('clipflow_history');
      const existing = saved ? JSON.parse(saved) : [];
      const newItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem('clipflow_history', JSON.stringify([newItem, ...existing.slice(0, 9)]));
    } catch (e) {}
  };

  // Main Export Handler
  const handleExportDownload = async () => {
    if (isDownloading) return;
    if (exportMode === 'pro' && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsDownloading(true);
    setDownloadStatus('running');
    setStatusMessage('Preparing clip export...');

    try {
      const effectiveTrimStart = isTrimEnabled ? trimRange[0] : 0;
      const effectiveTrimEnd = isTrimEnabled ? trimRange[1] : (effectiveDuration || 60);
      const effectiveFormat = downloadFormat === 'captions' ? captionFormat : downloadFormat;

      // 0. Dedicated Subtitle / Caption Export Pipeline (SRT, VTT, TXT)
      if (downloadFormat === 'captions') {
        setStatusMessage(`📝 Extracting and trimming ${captionFormat.toUpperCase()} subtitles...`);
        const res = await fetch(`${BACKEND_URL}/api/video/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: activeUrl,
            format: captionFormat,
            captionLang: captionLang || 'auto',
            trimStart: effectiveTrimStart,
            trimEnd: effectiveTrimEnd,
            customFileName: customFileName || metadata?.title || 'Subtitles',
            relativeTimecodes: true,
            mode: 'server',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch subtitles for this video');
        }

        const data = await res.json();
        const fileRes = await fetch(`${BACKEND_URL}${data.downloadUrl}`);
        if (!fileRes.ok) throw new Error('Failed to retrieve generated subtitle file from server');
        const blob = await fileRes.blob();

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = data.fileName || `${customFileName || metadata?.title || 'Subtitles'}.${captionFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        setDownloadStatus('success');
        setStatusMessage(`🎉 ${data.message || `Subtitles (${captionFormat.toUpperCase()}) downloaded!`}`);

        if (exportMode === 'pro' && isAuthenticated && isPro) {
          try {
            const clientJobId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
            fetch(`${BACKEND_URL}/api/drive/export`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                url: activeUrl,
                format: captionFormat,
                captionLang: captionLang || 'auto',
                trimStart: effectiveTrimStart,
                trimEnd: effectiveTrimEnd,
                customFileName: customFileName || metadata?.title || 'Subtitles',
                clientJobId,
              }),
            }).catch(() => {});
          } catch (_) {}
        }

        setTimeout(() => {
          setStatusMessage('');
          setDownloadStatus('idle');
        }, 3000);

        saveToHistory({
          title: customFileName || metadata?.title || 'Subtitles',
          url: activeUrl,
          thumbnail: metadata?.thumbnail || '',
          duration: isTrimEnabled
            ? `${formatTime(trimRange[0])} - ${formatTime(trimRange[1])} (${formatTime(trimRange[1] - trimRange[0])})`
            : `Full Video (${formatTime(metadata?.duration || 0)})`,
          quality: captionFormat.toUpperCase(),
          aspectRatio: 'Captions',
        });
        return;
      }

      // 1. Twitch Browser-Side Export Pipeline (with Quality Selection & Server Fallback)
      if (isTwitch && twitchHlsUrl) {
        setStatusMessage('⚡ Initializing browser video engine...');

        // Find exact variant URL matching downloadQuality (or audio_only for audio exports)
        let targetManifest = twitchHlsUrl;
        const isAudioExport = effectiveFormat === 'mp3' || (effectiveFormat as string) === 'wav' || (effectiveFormat as string) === 'aac';
        if (isAudioExport) {
          const audioTier = twitchQualities.find((q) => q.id === 'audio_only');
          if (audioTier) {
            targetManifest = audioTier.proxiedUrl || audioTier.url;
            console.log('[Twitch Export] Using audio_only stream variant for fast audio export:', targetManifest);
          }
        } else if (downloadQuality) {
          const cleanQ = downloadQuality.toLowerCase().replace(/[^\d]/g, '');
          const matchTier = twitchQualities.find((q) => q.id === downloadQuality || (cleanQ && q.height === Number(cleanQ)));
          if (matchTier) {
            targetManifest = matchTier.proxiedUrl || matchTier.url;
            console.log(`[Twitch Export] Using quality-matched stream variant (${downloadQuality}):`, targetManifest);
          }
        }

        try {
          await exportTwitchClipInBrowser({
            manifestUrl: targetManifest,
            trimStart: effectiveTrimStart,
            trimEnd: effectiveTrimEnd,
            customFileName: customFileName || metadata?.title || 'Twitch_Clip',
            format: effectiveFormat,
            quality: downloadQuality,
            aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
            fitMode: fitMode,
            cropPosition: cropPosition,
            cropBox: aspectRatio === 'custom' ? cropBox : undefined,
            audioBitrate: downloadAudioBitrate,
            onProgress: (msg) => setStatusMessage(msg),
          });
        } catch (browserTwitchErr: any) {
          console.warn('[Twitch Export] In-browser export failed, falling back to server export engine:', browserTwitchErr);
          setStatusMessage('⚡ In-browser render failed. Falling back to high-speed cloud renderer...');

          const res = await fetch(`${BACKEND_URL}/api/video/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: activeUrl,
              format: effectiveFormat,
              quality: downloadQuality,
              audioBitrate: downloadAudioBitrate,
              trimStart: effectiveTrimStart,
              trimEnd: effectiveTrimEnd,
              aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
              fitMode,
              cropPosition,
              cropBox: aspectRatio === 'custom' ? cropBox : undefined,
              customFileName: customFileName || metadata?.title || 'Twitch_Clip',
              mode: 'server',
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server export failed (${res.status})`);
          }

          const data = await res.json();
          if (data.downloadUrl) {
            const fileRes = await fetch(`${BACKEND_URL}${data.downloadUrl}`);
            if (!fileRes.ok) throw new Error('Failed to retrieve clip from server');
            const blob = await fileRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = data.fileName || `${customFileName || 'twitch_clip'}.${effectiveFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          }
        }

        setDownloadStatus('success');
        setStatusMessage('Clip generated & downloaded directly to your computer!');
        setTimeout(() => {
          setStatusMessage('');
          setDownloadStatus('idle');
        }, 2500);

        saveToHistory({
          title: customFileName || metadata?.title || 'Twitch Clip',
          url: activeUrl,
          platform: 'twitch',
          format: effectiveFormat,
          quality: downloadQuality,
          duration: Math.max(1, effectiveTrimEnd - effectiveTrimStart),
        });
        return;
      }

      // 2. Client-Side FFmpeg In-Browser Export (YouTube, Instagram, Twitter, etc.) with Automatic Cloud Fallback
      setStatusMessage('🚀 Initializing in-browser render engine...');

      try {
        const exportResult = await ClientVideoExportEngine.exportClip({
          metadata,
          trimStart: effectiveTrimStart,
          trimEnd: effectiveTrimEnd,
          format: effectiveFormat,
          quality: downloadQuality,
          audioQuality: downloadAudioBitrate,
          aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
          cropBox: aspectRatio === 'custom' ? cropBox : undefined,
          fitMode: fitMode,
          cropPosition: cropPosition,
          customFileName: customFileName || metadata?.title || 'ClipFlow_Video',
          onProgress: (phase) => setStatusMessage(phase),
        });

        console.log('[ClipFlow Studio EXPORT SUCCESS]', exportResult);
      } catch (browserExportErr: any) {
        console.warn('[ClipFlow Editor] In-browser export engine encountered error, falling back to server engine:', browserExportErr);
        setStatusMessage('⚡ In-browser render exceeded limit. Processing with cloud engine...');

        const res = await fetch(`${BACKEND_URL}/api/video/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: activeUrl,
            format: effectiveFormat,
            quality: downloadQuality,
            audioBitrate: downloadAudioBitrate,
            trimStart: effectiveTrimStart,
            trimEnd: effectiveTrimEnd,
            aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
            fitMode,
            cropPosition,
            cropBox: aspectRatio === 'custom' ? cropBox : undefined,
            customFileName: customFileName || metadata?.title || 'ClipFlow_Video',
            mode: 'server',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server export failed (${res.status})`);
        }

        const data = await res.json();
        if (data.downloadUrl) {
          const fileRes = await fetch(`${BACKEND_URL}${data.downloadUrl}`);
          if (!fileRes.ok) throw new Error('Failed to retrieve clip from server');
          const blob = await fileRes.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = data.fileName || `${customFileName || 'video_clip'}.${effectiveFormat}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
      }

      setDownloadStatus('success');
      setStatusMessage('🎉 Clip processed and downloaded successfully!');

      if (exportMode === 'pro' && isAuthenticated && isPro) {
        try {
          const clientJobId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          fetch(`${BACKEND_URL}/api/drive/export`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              url: activeUrl,
              format: effectiveFormat,
              quality: downloadQuality,
              trimStart: effectiveTrimStart,
              trimEnd: effectiveTrimEnd,
              customFileName: customFileName || metadata?.title || 'ClipFlow_Video',
              clientJobId,
            }),
          }).catch(() => {});
        } catch (_) {}
      }

      setTimeout(() => {
        setStatusMessage('');
        setDownloadStatus('idle');
      }, 3000);

      saveToHistory({
        title: customFileName || metadata?.title || 'Untitled Clip',
        url: activeUrl,
        thumbnail: metadata?.thumbnail || '',
        duration: isTrimEnabled
          ? `${formatTime(trimRange[0])} - ${formatTime(trimRange[1])} (${formatTime(trimRange[1] - trimRange[0])})`
          : `Full Video (${formatTime(metadata?.duration || 0)})`,
        quality: downloadQuality,
        aspectRatio: aspectRatio,
      });
    } catch (err: any) {
      console.error('[Download Error]', err);
      setDownloadStatus('error');
      setStatusMessage(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  // Size estimation
  const exportDuration = isTrimEnabled ? Math.max(0, trimRange[1] - trimRange[0]) : effectiveDuration;
  let estimatedBytes = 0;
  if (downloadFormat === 'captions') {
    estimatedBytes = 3500;
  } else if (downloadFormat === 'mp3') {
    let kbps = 192;
    if (downloadAudioBitrate === '320k') kbps = 320;
    else if (downloadAudioBitrate === '256k') kbps = 256;
    else if (downloadAudioBitrate === '192k') kbps = 192;
    else if (downloadAudioBitrate === '128k') kbps = 128;
    else if (downloadAudioBitrate === '0') kbps = 256;
    estimatedBytes = (kbps * 1000 / 8) * exportDuration;
  } else {
    const selectedQualityObj = effectiveQualityOptions.find(q => q.label === downloadQuality);
    const height = selectedQualityObj?.height || parseInt((downloadQuality || '').replace(/[^\d]/g, ''), 10) || 1080;
    let baseKbps = 3800;
    if (height >= 2160) baseKbps = 20000;
    else if (height >= 1440) baseKbps = 10000;
    else if (height >= 1080) baseKbps = 3800;
    else if (height >= 720) baseKbps = 2200;
    else if (height >= 480) baseKbps = 1000;
    else if (height >= 360) baseKbps = 550;
    else if (height >= 240) baseKbps = 300;
    else baseKbps = 150;

    const rawTbr = selectedQualityObj?.tbr;
    const effectiveKbps = (rawTbr && rawTbr > baseKbps) ? (rawTbr + 160) : baseKbps;
    estimatedBytes = (effectiveKbps * 1000 / 8) * exportDuration;
  }

  const isDraggingSplitter = isDraggingHSplitter || isDraggingVSplitter || isDraggingLSplitter;

  return (
    <div className={`flex h-screen overflow-hidden bg-black text-[#f8fafc] selection:bg-purple-500/30 ${
      isDraggingVSplitter ? 'select-none cursor-col-resize' : isDraggingHSplitter ? 'select-none cursor-row-resize' : ''
    }`}>
      {/* ══ PERSISTENT LEFT SIDEBAR ══ */}
      <EditorSidebar
        width={leftSidebarWidth}
        onWidthChange={setLeftSidebarWidth}
        showUrlChange={showUrlChange}
        newUrlInput={newUrlInput}
        setNewUrlInput={setNewUrlInput}
        onLoadVideo={handleLoadVideo}
        isLoadingMeta={isLoadingMeta}
        currentVideoUrl={activeUrl}
      />

      {/* ══ MAIN CONTENT AREA ══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <EditorHeader
          metadata={metadata}
          isLoadingMeta={isLoadingMeta}
          isProUser={isProUser}
          onOpenCompanionModal={() => setShowCompanionModal(true)}
        />

        {/* Body Row */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 flex flex-col overflow-y-auto min-w-0 p-4 gap-0">
            {isLoadingMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-400 rounded-full"
                />
                <p className="text-sm text-gray-400 font-medium">Extracting video streams...</p>
              </div>
            )}

            {errorMeta && !isLoadingMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8 min-h-[480px] bg-black rounded-2xl border border-white/[0.07] shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl">
                  <AlertCircle className="w-8 h-8 text-zinc-400 stroke-[1.5]" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h2 className="text-lg font-bold text-white tracking-tight">Something went wrong</h2>
                  <p className="text-sm text-zinc-400">
                    We couldn't load this video preview. Please verify the link or try another video.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setErrorMeta('');
                    setShowUrlChange(true);
                  }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold text-sm border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  Try Another URL
                </button>
              </div>
            )}

            {!metadata && !isLoadingMeta && !errorMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-6 min-h-[350px]">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Film className="w-7 h-7 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-white">No video loaded</h2>
                  <p className="text-sm text-gray-500 max-w-xs">Paste a video URL in the sidebar to get started.</p>
                </div>
                <button
                  onClick={() => setShowUrlChange(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Paste Video URL
                </button>
              </div>
            )}

            {metadata && !isLoadingMeta && !errorMeta && (
              <>
                <EditorPlayerStage
                  videoContainerRef={videoContainerRef}
                  videoCanvasRef={videoCanvasRef}
                  videoElementRef={videoElementRef}
                  audioElementRef={audioElementRef}
                  youtubePlayerRef={youtubePlayerRef}
                  videoHeight={videoHeight}
                  currentContainerAspect={currentContainerAspect}
                  sourceAspectRatio={sourceAspectRatio}
                  aspectRatio={aspectRatio}
                  fitMode={fitMode}
                  isPadMode={isPadMode}
                  cropBox={cropBox}
                  containerDims={containerDims}
                  handleCropBoxChange={handleCropBoxChange}
                  togglePlay={togglePlay}
                  isDraggingSplitter={isDraggingSplitter}
                  isVideoBuffering={isVideoBuffering}
                  isYouTube={isYouTube}
                  youtubeId={youtubeId}
                  isTwitch={isTwitch}
                  twitchHlsUrl={twitchHlsUrl}
                  isInstagram={isInstagram}
                  isTwitter={isTwitter}
                  activeVideoSrc={activeVideoSrc}
                  activeAudioSrc={activeAudioSrc}
                  rawPreviewSrc={rawPreviewSrc}
                  useProxyFallback={useProxyFallback}
                  setUseProxyFallback={setUseProxyFallback}
                  isPlaying={isPlaying}
                  volume={volume}
                  isMuted={isMuted}
                  currentTime={currentTime}
                  effectiveDuration={effectiveDuration}
                  trimRange={trimRange}
                  initialSessionTime={initialSession?.currentTime}
                  setIsPlaying={setIsPlaying}
                  setCurrentTime={setCurrentTime}
                  setIsVideoBuffering={setIsVideoBuffering}
                  handleMediaDurationUpdate={handleMediaDurationUpdate}
                  setVideoDimensions={setVideoDimensions}
                  seekToPosition={seekToPosition}
                  setTrimRange={setTrimRange}
                  isSeekingRef={isSeekingRef}
                  pendingSeekTimeRef={pendingSeekTimeRef}
                  seekOriginTimeRef={seekOriginTimeRef}
                  lastSeekTimeRef={lastSeekTimeRef}
                />

                <EditorPlaybackControls
                  currentTime={currentTime}
                  effectiveDuration={effectiveDuration}
                  isPlaying={isPlaying}
                  volume={volume}
                  isMuted={isMuted}
                  seekRelative={seekRelative}
                  seekToPosition={seekToPosition}
                  togglePlay={togglePlay}
                  handleVolumeChange={handleVolumeChange}
                  toggleMute={toggleMute}
                  isSeekingRef={isSeekingRef}
                  pendingSeekTimeRef={pendingSeekTimeRef}
                  lastSeekTimeRef={lastSeekTimeRef}
                  setCurrentTime={setCurrentTime}
                  isYouTube={isYouTube}
                  previewQualities={effectivePreviewQualities}
                  currentQualityLabel={currentQualityLabel}
                  selectedQualityId={selectedQualityId}
                  selectedPreviewQualityUrl={selectedPreviewQualityUrl}
                  defaultPreviewStreamUrl={defaultPreviewStreamUrl}
                  handleSelectPreviewQuality={handleSelectPreviewQuality}
                />

                {/* Horizontal Splitter */}
                <div
                  onMouseDown={() => setIsDraggingHSplitter(true)}
                  className="relative py-2.5 z-20 cursor-row-resize group select-none w-full flex items-center"
                  title="Drag up or down to adjust video and timeline height"
                >
                  <div className={`w-full h-[2px] transition-all ${
                    isDraggingHSplitter ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-white/10 group-hover:bg-white'
                  }`} />
                </div>

                <EditorTimeline
                  sliderWrapRef={sliderWrapRef}
                  isTrimEnabled={isTrimEnabled}
                  trimRange={trimRange}
                  setTrimRange={setTrimRange}
                  currentTime={currentTime}
                  effectiveDuration={effectiveDuration}
                  youtubeId={youtubeId}
                  thumbnail={metadata?.thumbnail || ''}
                  isSeekingRef={isSeekingRef}
                  pendingSeekTimeRef={pendingSeekTimeRef}
                  lastSeekTimeRef={lastSeekTimeRef}
                  setCurrentTime={setCurrentTime}
                  pauseAndSeek={pauseAndSeek}
                  setIsPlaying={setIsPlaying}
                  isPlayingRef={isPlayingRef}
                  videoElementRef={videoElementRef}
                  youtubePlayerRef={youtubePlayerRef}
                />
              </>
            )}
          </main>

          {/* Vertical Splitter */}
          <div
            onMouseDown={() => setIsDraggingVSplitter(true)}
            className={`w-2.5 hover:w-2.5 -mx-1 z-30 flex items-center justify-center cursor-col-resize group transition-colors select-none ${
              isDraggingVSplitter ? 'bg-white/20' : 'bg-transparent hover:bg-white/10'
            }`}
            title="Drag left or right to resize right panel"
          >
            <div className={`w-[2px] h-10 rounded-full transition-all ${
              isDraggingVSplitter ? 'bg-white h-16 shadow-md shadow-white/50' : 'bg-white/20 group-hover:bg-white group-hover:h-16'
            }`} />
          </div>

          <EditorExportPanel
            rightPanelWidth={rightPanelWidth}
            metadata={metadata}
            currentTime={currentTime}
            previewImageMode={previewImageMode}
            setPreviewImageMode={setPreviewImageMode}
            handleDownloadImage={handleDownloadImage}
            isDownloadingImage={isDownloadingImage}
            downloadSuccess={downloadSuccess}
            aspectRatio={aspectRatio}
            applyAspectRatio={applyAspectRatio}
            fitMode={fitMode}
            setFitMode={setFitMode}
            centerCropBox={centerCropBox}
            downloadFormat={downloadFormat}
            setDownloadFormat={setDownloadFormat}
            downloadQuality={downloadQuality}
            handleSetDownloadQuality={handleSetDownloadQuality}
            downloadAudioBitrate={downloadAudioBitrate}
            setDownloadAudioBitrate={setDownloadAudioBitrate}
            captionFormat={captionFormat}
            setCaptionFormat={setCaptionFormat}
            captionLang={captionLang}
            setCaptionLang={setCaptionLang}
            qualityOptions={effectiveQualityOptions}
            customFileName={customFileName}
            setCustomFileName={setCustomFileName}
            statusMessage={statusMessage}
            downloadStatus={downloadStatus}
            isDownloading={isDownloading}
            handleExportDownload={handleExportDownload}
            exportMode={exportMode}
            isPro={isPro}
            estimatedBytes={estimatedBytes}
          />
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <CloudStorageModal
        isOpen={showCloudStorageModal}
        onClose={() => setShowCloudStorageModal(false)}
      />

      {/* Desktop Companion Engine Modal */}
      <AnimatePresence>
        {showCompanionModal && (
          <div
            onClick={() => setShowCompanionModal(false)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#09090b] border border-white/15 rounded-xl shadow-2xl overflow-hidden text-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">ClipFlow Desktop Engine</h3>
                    <span className="text-[11px] text-zinc-400">Local Processing Companion</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowCompanionModal(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Download and run the lightweight ClipFlow Desktop Companion to enable blazing-fast, unlimited local clipping on your PC directly from your browser.
              </p>

              <div className="p-3 bg-black/60 rounded-lg border border-white/10 space-y-1.5 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Port 18942 background bridge</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Built-in local ffmpeg & yt-dlp acceleration</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No server bandwidth limits</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <a
                  href="/download/ClipFlow-Desktop-Companion.exe"
                  download
                  onClick={() => setShowCompanionModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download for Windows</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
