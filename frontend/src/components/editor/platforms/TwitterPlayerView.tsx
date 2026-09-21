import { useEffect } from 'react';
import type { TwitterPlayerProps } from './types';

export function TwitterPlayerView({
  videoElementRef,
  activeVideoSrc,
  rawPreviewSrc,
  volume,
  isMuted,
  effectiveDuration,
  trimRange,
  useProxyFallback,
  setUseProxyFallback,
  setIsPlaying,
  setCurrentTime,
  setIsVideoBuffering,
  handleMediaDurationUpdate,
  setVideoDimensions,
  isSeekingRef,
  pendingSeekTimeRef,
}: TwitterPlayerProps) {
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;
    if (activeVideoSrc) {
      video.src = activeVideoSrc;
    } else {
      video.removeAttribute('src');
      video.load();
    }
  }, [activeVideoSrc]);

  return (
    <video
      ref={videoElementRef}
      src={activeVideoSrc || undefined}
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
      onError={() => {
        setIsVideoBuffering(false);
        if (!useProxyFallback && rawPreviewSrc) {
          setUseProxyFallback(true);
        }
      }}
      onEnded={() => {
        setIsVideoBuffering(false);
        if (videoElementRef.current) {
          videoElementRef.current.currentTime = trimRange[0];
          videoElementRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }}
      className="w-full h-full object-contain pointer-events-none"
    />
  );
}
