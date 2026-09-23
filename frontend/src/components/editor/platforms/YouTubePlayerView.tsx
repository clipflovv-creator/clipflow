import { useMemo } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayerProps } from './types';

export function YouTubePlayerView({
  youtubeId,
  youtubePlayerRef,
  isPadMode,
  sourceAspectRatio,
  isDraggingSplitter,
  volume,
  isMuted,
  trimRange,
  initialSessionTime,
  setIsPlaying,
  setIsVideoBuffering,
  setCurrentTime,
  handleMediaDurationUpdate,
  isSeekingRef,
  pendingSeekTimeRef,
  seekOriginTimeRef,
}: YouTubePlayerProps) {
  const youtubeOpts = useMemo(() => ({
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      cc_load_policy: 0,
      playsinline: 1,
      enablejsapi: 1,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  }), []);

  return (
    <div
      style={isPadMode ? { aspectRatio: `${sourceAspectRatio}`, width: '100%', margin: 'auto 0' } : undefined}
      className={`${isPadMode ? 'w-full' : 'w-full h-full'} relative flex items-center justify-center overflow-hidden select-none ${
        isDraggingSplitter ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      <YouTube
        videoId={youtubeId}
        className={`w-full h-full flex items-center justify-center ${
          isDraggingSplitter ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        iframeClassName={`w-full h-full block border-0 ${
          isDraggingSplitter ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        opts={youtubeOpts}
        onReady={(e) => {
          (youtubePlayerRef as any).current = e.target;
          try {
            if (typeof e.target.unloadModule === 'function') {
              e.target.unloadModule('captions');
              e.target.unloadModule('cc');
            }
          } catch (err) { }
          if (isMuted || volume === 0) {
            e.target.mute();
          } else {
            e.target.unMute();
            e.target.setVolume(Math.round(volume * 100));
          }
          const dur = e.target.getDuration();
          if (dur && dur > 0) {
            handleMediaDurationUpdate(dur);
          }
          if (initialSessionTime && initialSessionTime > 0) {
            e.target.seekTo(initialSessionTime, true);
            setCurrentTime(initialSessionTime);
          } else if (trimRange[0] > 0) {
            e.target.seekTo(trimRange[0], true);
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
        onStateChange={async (e) => {
          if (e.data === 1) {
            setIsPlaying(true);
            setIsVideoBuffering(false);
            if (isSeekingRef.current && pendingSeekTimeRef.current !== null) {
              try {
                const time = await e.target.getCurrentTime();
                if (Math.abs(time - pendingSeekTimeRef.current) < 1.5) {
                  (isSeekingRef as any).current = false;
                  (pendingSeekTimeRef as any).current = null;
                  (seekOriginTimeRef as any).current = null;
                  setCurrentTime(time);
                }
              } catch { }
            }
          } else if (e.data === 2) {
            setIsPlaying(false);
            setIsVideoBuffering(false);
            if (isSeekingRef.current) {
              (isSeekingRef as any).current = false;
              (pendingSeekTimeRef as any).current = null;
              (seekOriginTimeRef as any).current = null;
            }
          } else if (e.data === 3) {
            setIsVideoBuffering(true);
          } else if (e.data === 0) {
            setIsVideoBuffering(false);
            if (youtubePlayerRef.current) {
              youtubePlayerRef.current.seekTo(trimRange[0], true);
              try { youtubePlayerRef.current.playVideo(); } catch { }
              setIsPlaying(true);
            }
          }
        }}
      />
    </div>
  );
}
