import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { TwitchPlayerProps } from './types';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

export function TwitchPlayerView({
  videoElementRef,
  twitchHlsUrl,
  isPlaying,
  volume,
  isMuted,
  currentTime,
  effectiveDuration,
  trimRange,
  isLiveStream,
  setIsPlaying,
  setCurrentTime,
  setIsVideoBuffering,
  handleMediaDurationUpdate,
  setVideoDimensions,
  seekToPosition,
  setTrimRange,
  isSeekingRef,
  pendingSeekTimeRef,
}: TwitchPlayerProps) {
  const hlsRef = useRef<Hls | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const video = videoElementRef.current;
    if (!video || !twitchHlsUrl) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const DefaultLoader = Hls.DefaultConfig.loader;
      class ProxyHlsLoader extends DefaultLoader {
        override load(context: any, config: any, callbacks: any) {
          if (context && context.url && typeof context.url === 'string') {
            const rawUrl = context.url;
            if (
              (rawUrl.includes('cloudfront.net') || rawUrl.includes('ttvnw.net')) &&
              !rawUrl.includes('/api/video/')
            ) {
              if (rawUrl.includes('.m3u8')) {
                context.url = `${BACKEND_URL}/api/video/hls-proxy?url=${encodeURIComponent(rawUrl)}`;
              } else {
                context.url = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
              }
            }
          }
          super.load(context, config, callbacks);
        }
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: Infinity,
        maxBufferLength: 120,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        startPosition: 0,
        liveSyncDurationCount: 0,
        liveMaxLatencyDurationCount: Infinity,
        liveDurationInfinity: false,
        loader: ProxyHlsLoader as any,
      });

      console.log('%c[ClipFlow 📺 TWITCH HLS ATTACH]', 'color: #a855f7; font-weight: bold;', {
        twitchHlsUrl,
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.log('%c[ClipFlow 📺 TWITCH HLS MANIFEST PARSED]', 'color: #22c55e; font-weight: bold;', {
          levels: data.levels?.length,
          firstLevel: data.firstLevel,
        });
        setIsVideoBuffering(false);
        if (!currentTime || currentTime === 0) {
          video.currentTime = 0;
          setCurrentTime(0);
        } else if (currentTime > 0) {
          video.currentTime = currentTime;
        }
        if (isPlayingRef.current) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (data.details.totalduration && data.details.totalduration > 0) {
          handleMediaDurationUpdate(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(twitchHlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = twitchHlsUrl;
    }
  }, [twitchHlsUrl]);

  return (
    <>
      <video
        ref={videoElementRef}
        src={Hls.isSupported() ? undefined : twitchHlsUrl}
        preload="auto"
        playsInline
        muted={isMuted}
        onLoadStart={() => setIsVideoBuffering(true)}
        onWaiting={() => setIsVideoBuffering(true)}
        onSeeking={() => {
          (isSeekingRef as any).current = true;
          setIsVideoBuffering(true);
        }}
        onSeeked={(e) => {
          const v = e.currentTarget;
          setIsVideoBuffering(false);
          setCurrentTime(v.currentTime);
          (pendingSeekTimeRef as any).current = null;
          (isSeekingRef as any).current = false;
        }}
        onCanPlay={() => setIsVideoBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.volume = volume;
          v.muted = isMuted;
          if (v.videoWidth > 0 && v.videoHeight > 0) {
            setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
          }
          setIsVideoBuffering(false);
          if (v.duration && v.duration > 0 && Number.isFinite(v.duration)) {
            handleMediaDurationUpdate(v.duration);
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (isSeekingRef.current) return;
          setCurrentTime(v.currentTime);
          const clipStart = trimRange[0];
          const clipEnd = trimRange[1] > clipStart ? trimRange[1] : (effectiveDuration || clipStart + 60);
          if (v.currentTime >= clipEnd) {
            v.currentTime = clipStart;
            setCurrentTime(clipStart);
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          setIsVideoBuffering(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsVideoBuffering(false);
        }}
        className="w-full h-full object-contain pointer-events-none"
      />

      {isLiveStream && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const targetTime = effectiveDuration > 10 ? effectiveDuration - 5 : Math.max(0, effectiveDuration);
            seekToPosition(targetTime);
            setTrimRange(prev => [prev[0], Math.max(prev[1], effectiveDuration)]);
            if (videoElementRef.current) {
              videoElementRef.current.currentTime = targetTime;
              if (videoElementRef.current.paused) {
                videoElementRef.current.play().catch(() => {});
                setIsPlaying(true);
              }
            }
          }}
          className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 hover:bg-red-500 active:scale-95 transition-all text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg shadow-red-600/30 border border-red-500/50 select-none cursor-pointer"
          title="Click to jump preview to the latest live broadcast"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
          <span>LIVE BROADCAST</span>
        </button>
      )}
    </>
  );
}
