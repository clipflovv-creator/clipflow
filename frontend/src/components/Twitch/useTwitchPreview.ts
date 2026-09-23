import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';

export interface TwitchQualityOption {
  id: string;
  label: string;
  height: number;
  width?: number;
  bandwidth: number;
  fps?: number;
  url: string;
  proxiedUrl?: string;
}

export interface TwitchStreamInfo {
  twitchHlsUrl: string;
  sourceType: 'dvr' | 'live' | 'vod' | 'clip' | '';
  vodId?: string;
  channel?: string;
  masterPlaylistUrl?: string;
  qualities: TwitchQualityOption[];
  isLoadingStream: boolean;
  streamError: string;
  refreshStream: () => void;
  forceRefreshStream: () => void;
  // Kept for backwards-compatibility with existing editor callers
  isTwitchLiveChannel: boolean;
  twitchLiveSegmentUrl: string;
  refreshLiveSegment: () => void;
}

export function useTwitchPreview(
  isTwitch: boolean,
  activeUrl: string,
  metadata: any,
  _isPro: boolean = false,
  quality?: string
): TwitchStreamInfo {
  const [twitchHlsUrl, setTwitchHlsUrl] = useState<string>('');
  const [sourceType, setSourceType] = useState<'dvr' | 'live' | 'vod' | 'clip' | ''>('');
  const [vodId, setVodId] = useState<string | undefined>(undefined);
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [masterPlaylistUrl, setMasterPlaylistUrl] = useState<string | undefined>(undefined);
  const [qualities, setQualities] = useState<TwitchQualityOption[]>([]);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if exact match for live channel (e.g. twitch.tv/channel_name)
  const isTwitchLiveChannel = Boolean(
    isTwitch &&
    /twitch\.tv\/([a-zA-Z0-9_]+)\/?$/i.test(activeUrl) &&
    !activeUrl.includes('/videos') &&
    !activeUrl.includes('/clip')
  );

  const fetchTwitchStream = useCallback(async (forceRefresh = false) => {
    if (!isTwitch || !activeUrl) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const targetUrl = metadata?.webpage_url || activeUrl;
    setIsLoadingStream(true);
    setStreamError('');

    try {
      const res = await api.twitch.getStreamInfo(targetUrl, {
        quality,
        forceRefresh,
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.streamUrl) {
        setTwitchHlsUrl(data.streamUrl);
        setSourceType(data.sourceType || (isTwitchLiveChannel ? 'dvr' : 'vod'));
        setVodId(data.vodId);
        setChannel(data.channel);
        setMasterPlaylistUrl(data.masterPlaylistUrl);
        setQualities(data.qualities || []);
        setIsLoadingStream(false);
      } else {
        throw new Error('Stream URL missing from stream-info response');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('%c[Twitch HLS Preview ❌ ERROR FETCHING STREAM INFO]', 'color: #ef4444; font-weight: bold;', err);
      setStreamError(err.message || 'Failed to resolve Twitch stream');
      setIsLoadingStream(false);
    }
  }, [isTwitch, activeUrl, metadata?.webpage_url, isTwitchLiveChannel, quality]);

  useEffect(() => {
    if (!isTwitch) {
      setTwitchHlsUrl('');
      setSourceType('');
      setVodId(undefined);
      setChannel(undefined);
      setMasterPlaylistUrl(undefined);
      setQualities([]);
      setIsLoadingStream(false);
      setStreamError('');
      return;
    }

    fetchTwitchStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isTwitch, activeUrl, fetchTwitchStream]);

  return {
    twitchHlsUrl,
    sourceType,
    vodId,
    channel,
    masterPlaylistUrl,
    qualities,
    isLoadingStream,
    streamError,
    refreshStream: () => fetchTwitchStream(false),
    forceRefreshStream: () => fetchTwitchStream(true),
    isTwitchLiveChannel,
    twitchLiveSegmentUrl: twitchHlsUrl,
    refreshLiveSegment: () => fetchTwitchStream(false),
  };
}
