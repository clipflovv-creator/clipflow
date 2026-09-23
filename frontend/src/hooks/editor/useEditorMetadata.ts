import { useState, useRef, useMemo, useCallback } from 'react';
import { getCachedMetadata, setCachedMetadata } from '../../utils/metadataCache';
import { isTwitchLiveChannelUrl } from '../../components/Twitch/useTwitchLiveChannel';
import { extractYouTubeId } from '../../utils/platforms';
import { api } from '../../services/api';

export interface QualityOption {
  label: string;
  height: number;
  format_id: string;
  tbr?: number;
  isNative?: boolean;
}

export interface PreviewQualityTier {
  id: string;
  label: string;
  height: number;
  url: string;
  isAvailable: boolean;
  hasAudio: boolean;
}

const ALL_STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240];

export function buildQualityOptions(data: any): QualityOption[] {
  const rawFormats = data?.video_formats || data?.formats || [];
  const rawHeights: number[] = Array.from<number>(
    new Set(
      rawFormats
        .map((f: any) => {
          let h = f.height || 0;
          let w = f.width || 0;
          if ((!h || !w) && f.resolution) {
            const match = f.resolution.match(/(\d+)x(\d+)/);
            if (match) {
              w = parseInt(match[1], 10);
              h = parseInt(match[2], 10);
            }
          }
          return (w > 0 && h > 0) ? Math.min(w, h) : (h || w);
        })
        .filter((h: number) => h > 0 && typeof h === 'number')
    )
  ).sort((a: any, b: any) => b - a);

  // Union of standard heights (2160, 1440, 1080, 720...) and any detected video heights
  const allHeights = Array.from(new Set([...ALL_STANDARD_HEIGHTS, ...rawHeights])).sort((a, b) => b - a);

  return allHeights.map((h) => {
    // Check if this height is natively available in the video (+/- 80px tolerance for ultrawide letterboxing)
    const matching = rawFormats.filter((f: any) => {
      let fh = f.height;
      if (!fh && f.resolution) {
        const match = (f.resolution || '').match(/\d+x(\d+)/);
        if (match) fh = parseInt(match[1], 10);
      }
      return fh === h || Math.abs((fh || 0) - h) <= 80;
    });

    const isNative = matching.length > 0;
    const best = matching.reduce((a: any, b: any) => ((b?.tbr || 0) > (a?.tbr || 0) ? b : a), matching[0]);

    return {
      label: `${h}p`,
      height: h,
      format_id: best?.format_id || 'best',
      tbr: best?.tbr,
      isNative,
    };
  });
}

export function useEditorMetadata(
  _activeUrl: string,
  initialMetadata: any,
  isTwitch: boolean
) {
  const [metadata, setMetadata] = useState<any>(initialMetadata || null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [errorMeta, setErrorMeta] = useState('');
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>(() => {
    if (initialMetadata) {
      return buildQualityOptions(initialMetadata);
    }
    return [];
  });

  const inFlightFetchMetaRef = useRef<Map<string, Promise<any>>>(new Map());

  const fetchVideo = useCallback(async (targetUrl: string, forceRefresh: boolean = false) => {
    const cleanTargetUrl = targetUrl?.trim();
    if (!cleanTargetUrl) return;
    setErrorMeta('');

    // 1. For Twitch live channels: inject synthetic metadata immediately
    const isTwitchLiveNow = isTwitchLiveChannelUrl(cleanTargetUrl);
    if (isTwitchLiveNow) {
      const channelMatch = cleanTargetUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
      const channelName = channelMatch ? channelMatch[1] : 'twitch';
      const syntheticMeta = {
        id: channelName,
        title: `${channelName} — Live Stream`,
        uploader: channelName,
        channel: channelName,
        channel_url: `https://www.twitch.tv/${channelName}`,
        thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelName.toLowerCase()}-640x360.jpg`,
        duration: 0,
        duration_string: 'LIVE',
        is_live: true,
        live_status: 'is_live',
        formats: [
          { format_id: '1080p', height: 1080, width: 1920, resolution: '1920x1080', isNative: true },
          { format_id: '720p', height: 720, width: 1280, resolution: '1280x720', isNative: true },
          { format_id: '480p', height: 480, width: 854, resolution: '854x480', isNative: true },
          { format_id: '360p', height: 360, width: 640, resolution: '640x360', isNative: true },
        ],
        webpage_url: cleanTargetUrl,
        _synthetic: true,
      };
      setMetadata(syntheticMeta);
      setQualityOptions(buildQualityOptions(syntheticMeta));
      setIsLoadingMeta(false);
    }

    // 2. Check metadata cache for instant display (only if it has real playable stream formats)
    if (!forceRefresh && !isTwitchLiveNow) {
      const cached = getCachedMetadata(cleanTargetUrl);
      if (cached && !cached._synthetic && Array.isArray(cached.formats) && cached.formats.length > 0) {
        setMetadata(cached);
        setQualityOptions(buildQualityOptions(cached));
        setIsLoadingMeta(false);
        return;
      }
    }

    if (!isTwitchLiveNow) {
      setIsLoadingMeta(true);
    }

    try {
      let fetchPromise: Promise<any>;
      if (inFlightFetchMetaRef.current.has(cleanTargetUrl) && !forceRefresh) {
        fetchPromise = inFlightFetchMetaRef.current.get(cleanTargetUrl)!;
      } else {
        const p = (async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          try {
            const res = await api.video.getMetadata(cleanTargetUrl, controller.signal);
            clearTimeout(timeoutId);
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error || `Failed to fetch metadata (status: ${res.status})`);
            }
            return await res.json();
          } catch (err: any) {
            clearTimeout(timeoutId);
            // Fallback for YouTube preview info only (mark as synthetic so it is never cached as real streams)
            const ytId = extractYouTubeId(cleanTargetUrl);
            if (ytId) {
              try {
                const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
                if (oembedRes.ok) {
                  const oembed = await oembedRes.json();
                  return {
                    id: ytId,
                    title: oembed.title || 'YouTube Video',
                    thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
                    uploader: oembed.author_name || 'YouTube Creator',
                    duration: 0,
                    duration_string: '00:00',
                    formats: [],
                    _synthetic: true,
                  };
                }
              } catch (_) {}
            }
            throw err;
          }
        })();

        inFlightFetchMetaRef.current.set(cleanTargetUrl, p);
        fetchPromise = p.finally(() => {
          inFlightFetchMetaRef.current.delete(cleanTargetUrl);
        });
      }

      const data = await fetchPromise;
      if (data) {
        setMetadata(data);
        if (!data._synthetic && Array.isArray(data.formats) && data.formats.length > 0) {
          setCachedMetadata(cleanTargetUrl, data);
        }
        setQualityOptions(buildQualityOptions(data));
      }
    } catch (err: any) {
      if (!isTwitchLiveNow) {
        console.error('[ClipFlow Editor] Error loading video metadata:', err);
        setErrorMeta('error');
      }
    } finally {
      setIsLoadingMeta(false);
    }
  }, []);

  // Compute preview quality tiers and default preview stream URL
  const { previewQualities, defaultPreviewStreamUrl } = useMemo(() => {
    if (!metadata) return { previewQualities: [] as PreviewQualityTier[], defaultPreviewStreamUrl: '' };

    const videoFormats = (metadata.formats || []).filter((f: any) => {
      if (f.vcodec === 'none') return false;
      return Boolean(f.url);
    });

    const combinedFormats = videoFormats.filter((f: any) => f.acodec && f.acodec !== 'none');
    const heightToUrlMap = new Map<number, string>();
    const heightHasAudioMap = new Map<number, boolean>();
    let maxDetectedHeight = 0;

    videoFormats.forEach((f: any) => {
      let h = f.height || 0;
      let w = f.width || 0;
      if ((!h || !w) && f.resolution) {
        const match = f.resolution.match(/(\d+)x(\d+)/);
        if (match) {
          w = parseInt(match[1], 10);
          h = parseInt(match[2], 10);
        }
      }
      const standardH = (w > 0 && h > 0) ? Math.min(w, h) : (h || w);
      if (standardH > 0) {
        if (standardH > maxDetectedHeight) maxDetectedHeight = standardH;
        const hasAudio = Boolean(f.acodec && f.acodec !== 'none');
        if (f.url && (!heightToUrlMap.has(standardH) || (!heightHasAudioMap.get(standardH) && hasAudio))) {
          heightToUrlMap.set(standardH, f.url);
          heightHasAudioMap.set(standardH, hasAudio);
        }
      }
    });

    if (maxDetectedHeight === 0) maxDetectedHeight = 1080;

    const bestFallbackUrl =
      metadata.direct_stream_url ||
      (combinedFormats.length > 0
        ? combinedFormats[combinedFormats.length - 1]?.url
        : (videoFormats.length > 0 ? videoFormats[videoFormats.length - 1]?.url : '')) ||
      metadata.url ||
      '';

    let defaultStream = '';
    const combined1080 = combinedFormats.find((f: any) => (f.height === 1080 || f.width === 1080 || f.resolution?.includes('1080')));
    const combined720 = combinedFormats.find((f: any) => (f.height === 720 || f.width === 720 || f.resolution?.includes('720')));
    const combinedAny = combinedFormats.length > 0 ? combinedFormats[combinedFormats.length - 1] : null;

    if (combined1080?.url) defaultStream = combined1080.url;
    else if (combined720?.url) defaultStream = combined720.url;
    else if (combinedAny?.url) defaultStream = combinedAny.url;
    else if (heightToUrlMap.has(1080)) defaultStream = heightToUrlMap.get(1080)!;
    else if (heightToUrlMap.has(720)) defaultStream = heightToUrlMap.get(720)!;
    else defaultStream = bestFallbackUrl;

    const standardTiers = [
      { height: 2160, label: '4K (2160p)', id: '2160p' },
      { height: 1440, label: '2K (1440p)', id: '1440p' },
      { height: 1080, label: '1080p (Full HD)', id: '1080p' },
      { height: 720, label: '720p (HD)', id: '720p' },
      { height: 480, label: '480p (SD)', id: '480p' },
      { height: 360, label: '360p', id: '360p' },
      { height: 240, label: '240p', id: '240p' },
    ];

    const getBestUrlForTier = (targetH: number): string => {
      if (heightToUrlMap.has(targetH)) return heightToUrlMap.get(targetH)!;
      if (targetH >= maxDetectedHeight && maxDetectedHeight > 0) {
        return heightToUrlMap.get(maxDetectedHeight) || bestFallbackUrl;
      }
      const availableHeights = Array.from(heightToUrlMap.keys()).sort((a, b) => b - a);
      const match = availableHeights.find(h => h <= targetH) || availableHeights[availableHeights.length - 1];
      if (match && heightToUrlMap.has(match)) return heightToUrlMap.get(match)!;
      return bestFallbackUrl;
    };

    const tiers: PreviewQualityTier[] = standardTiers.map((t) => ({
      id: t.id,
      label: t.label,
      height: t.height,
      url: getBestUrlForTier(t.height),
      isAvailable: isTwitch ? [1080, 720, 480, 360].includes(t.height) : heightToUrlMap.has(t.height),
      hasAudio: heightHasAudioMap.get(t.height) ?? false,
    }));

    return {
      previewQualities: tiers,
      defaultPreviewStreamUrl: defaultStream || bestFallbackUrl,
    };
  }, [metadata, isTwitch]);

  return {
    metadata,
    setMetadata,
    isLoadingMeta,
    setIsLoadingMeta,
    errorMeta,
    setErrorMeta,
    qualityOptions,
    setQualityOptions,
    previewQualities,
    defaultPreviewStreamUrl,
    fetchVideo,
  };
}
