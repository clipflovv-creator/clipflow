import { useEffect } from 'react';
import type { InstagramPlayerProps } from './types';

export function InstagramPlayerView({
  videoElementRef,
  audioElementRef,
  activeVideoSrc,
  activeAudioSrc,
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
}: InstagramPlayerProps) {
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
    <>
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
          if (audioElementRef.current && activeAudioSrc) {
            audioElementRef.current.currentTime = v.currentTime;
          }
        }}
        onCanPlay={() => setIsVideoBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.volume = volume;
          v.muted = isMuted;
          if (audioElementRef.current) {
            audioElementRef.current.volume = volume;
            audioElementRef.current.muted = isMuted;
          }
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
            if (audioElementRef.current && activeAudioSrc) {
              audioElementRef.current.currentTime = clipStart;
            }
          } else if (v.currentTime < clipStart - 0.5) {
            v.currentTime = clipStart;
            setCurrentTime(clipStart);
            if (audioElementRef.current && activeAudioSrc) {
              audioElementRef.current.currentTime = clipStart;
            }
          } else if (audioElementRef.current && activeAudioSrc && !audioElementRef.current.paused) {
            // Drift correction: keep companion audio locked within 250ms of video frames
            if (Math.abs(audioElementRef.current.currentTime - v.currentTime) > 0.25) {
              audioElementRef.current.currentTime = v.currentTime;
            }
          }
        }}
        onPlay={(e) => {
          const v = e.currentTarget;
          setIsPlaying(true);
          setIsVideoBuffering(false);
          if (audioElementRef.current && activeAudioSrc) {
            audioElementRef.current.currentTime = v.currentTime;
            audioElementRef.current.play().catch(() => {});
          }
        }}
        onPlaying={(e) => {
          const v = e.currentTarget;
          setIsPlaying(true);
          setIsVideoBuffering(false);
          if (audioElementRef.current && activeAudioSrc && audioElementRef.current.paused) {
            audioElementRef.current.currentTime = v.currentTime;
            audioElementRef.current.play().catch(() => {});
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsVideoBuffering(false);
          if (audioElementRef.current && activeAudioSrc) {
            audioElementRef.current.pause();
          }
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
          if (audioElementRef.current && activeAudioSrc) {
            audioElementRef.current.currentTime = trimRange[0];
            audioElementRef.current.play().catch(() => {});
          }
        }}
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Companion Audio Player for DASH Video-Only Instagram streams */}
      {activeAudioSrc && (
        <audio
          ref={audioElementRef}
          src={activeAudioSrc}
          preload="auto"
          muted={isMuted}
          onError={(e) => {
            console.warn('[ClipFlow Instagram Companion Audio Error]', e);
          }}
        />
      )}
    </>
  );
}
