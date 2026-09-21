import { useState, useEffect, useRef, useCallback } from 'react';
import type { YouTubePlayer } from 'react-youtube';

export function useEditorPlayback(
  youtubeId: string | null,
  youtubePlayerRef: React.RefObject<YouTubePlayer | null>,
  videoElementRef: React.RefObject<HTMLVideoElement | null>,
  audioElementRef: React.RefObject<HTMLAudioElement | null>,
  effectiveDuration: number,
  trimRange: [number, number],
  initialTime: number = 0,
  initialVolume: number = 1,
  initialMuted: boolean = false
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);

  const isPlayingRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const seekOriginTimeRef = useRef<number | null>(null);

  const [volume, setVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('clipflow_volume');
      if (v !== null) return parseFloat(v);
    } catch {}
    return initialVolume;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const m = localStorage.getItem('clipflow_muted');
      if (m !== null) return m === 'true';
    } catch {}
    return initialMuted;
  });

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    } else if (clamped === 0 && !isMuted) {
      setIsMuted(true);
    }
    try {
      localStorage.setItem('clipflow_volume', String(clamped));
      if (clamped > 0) localStorage.setItem('clipflow_muted', 'false');
      else localStorage.setItem('clipflow_muted', 'true');
    } catch {}

    if (youtubeId && youtubePlayerRef.current) {
      try {
        if (clamped === 0) {
          youtubePlayerRef.current.mute();
        } else {
          youtubePlayerRef.current.unMute();
          youtubePlayerRef.current.setVolume(Math.round(clamped * 100));
        }
      } catch (e) {}
    } else {
      if (videoElementRef.current) {
        videoElementRef.current.volume = clamped;
        videoElementRef.current.muted = clamped === 0;
      }
      if (audioElementRef.current) {
        audioElementRef.current.volume = clamped;
        audioElementRef.current.muted = clamped === 0;
      }
    }
  }, [youtubeId, isMuted, youtubePlayerRef, videoElementRef, audioElementRef]);

  const toggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    try {
      localStorage.setItem('clipflow_muted', String(nextMute));
    } catch {}
    if (youtubeId && youtubePlayerRef.current) {
      try {
        if (nextMute) {
          youtubePlayerRef.current.mute();
        } else {
          youtubePlayerRef.current.unMute();
          const targetVol = volume === 0 ? 0.5 : volume;
          if (volume === 0) {
            setVolume(0.5);
            try { localStorage.setItem('clipflow_volume', '0.5'); } catch {}
          }
          youtubePlayerRef.current.setVolume(Math.round(targetVol * 100));
        }
      } catch (e) {}
    } else {
      const targetVol = (!nextMute && volume === 0) ? 0.5 : volume;
      if (!nextMute && volume === 0) {
        setVolume(0.5);
        try { localStorage.setItem('clipflow_volume', '0.5'); } catch {}
      }
      if (videoElementRef.current) {
        videoElementRef.current.muted = nextMute;
        videoElementRef.current.volume = targetVol;
      }
      if (audioElementRef.current) {
        audioElementRef.current.muted = nextMute;
        audioElementRef.current.volume = targetVol;
      }
    }
  }, [isMuted, youtubeId, volume, youtubePlayerRef, videoElementRef, audioElementRef]);

  const seekToPosition = useCallback((newTime: number) => {
    const targetTime = Math.max(0, Math.min(newTime, effectiveDuration > 0 ? effectiveDuration : newTime));
    seekOriginTimeRef.current = currentTime;
    pendingSeekTimeRef.current = targetTime;
    isSeekingRef.current = true;
    lastSeekTimeRef.current = Date.now();
    setCurrentTime(targetTime);

    if (youtubeId && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(targetTime, true);
        if (isPlaying) {
          try { youtubePlayerRef.current.playVideo(); } catch {}
        }
      } catch (e) {
        console.warn('[ClipFlow Seek Error]', e);
      }
      if (!isPlaying) {
        setTimeout(() => {
          if (!isPlaying) {
            isSeekingRef.current = false;
            pendingSeekTimeRef.current = null;
            seekOriginTimeRef.current = null;
          }
        }, 300);
      }
    } else if (videoElementRef.current) {
      const v = videoElementRef.current;
      try {
        v.currentTime = targetTime;
      } catch (e) {
        console.warn('[ClipFlow Seek Error]', e);
      }
    }
  }, [effectiveDuration, currentTime, youtubeId, isPlaying, youtubePlayerRef, videoElementRef]);

  const pauseAndSeek = useCallback((targetPos: number) => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (videoElementRef.current && !videoElementRef.current.paused) {
      try { videoElementRef.current.pause(); } catch (e) {}
    }
    if (youtubeId && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.pauseVideo(); } catch (e) {}
    }
    seekToPosition(targetPos);
  }, [youtubeId, seekToPosition, videoElementRef, youtubePlayerRef]);

  const playClipFromStart = useCallback((startPos?: number) => {
    const target = startPos !== undefined ? startPos : trimRange[0];
    seekOriginTimeRef.current = currentTime;
    pendingSeekTimeRef.current = target;
    isSeekingRef.current = true;
    lastSeekTimeRef.current = Date.now();
    setCurrentTime(target);
    setIsPlaying(true);
    isPlayingRef.current = true;

    if (youtubeId && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.seekTo(target, true);
        youtubePlayerRef.current.playVideo();
      } catch (e) {}
    } else if (videoElementRef.current) {
      const v = videoElementRef.current;
      try {
        v.currentTime = target;
        v.play().catch(() => {});
      } catch (e) {}
    }
  }, [currentTime, trimRange, youtubeId, youtubePlayerRef, videoElementRef]);

  const togglePlay = useCallback(() => {
    const clipStart = trimRange[0];
    const clipEnd = trimRange[1] > clipStart ? trimRange[1] : (effectiveDuration || clipStart + 60);

    if (youtubeId && youtubePlayerRef.current) {
      if (isPlaying) {
        try { youtubePlayerRef.current.pauseVideo(); } catch (e) {}
        setIsPlaying(false);
      } else {
        if (currentTime >= clipEnd - 0.1) {
          youtubePlayerRef.current.seekTo(clipStart, true);
          setCurrentTime(clipStart);
        }
        try { youtubePlayerRef.current.playVideo(); } catch (e) {}
        setIsPlaying(true);
      }
    } else {
      const activeVideo = videoElementRef.current;
      if (activeVideo) {
        if (isPlaying) {
          activeVideo.pause();
          setIsPlaying(false);
        } else {
          if (activeVideo.currentTime >= clipEnd - 0.1) {
            activeVideo.currentTime = clipStart;
            setCurrentTime(clipStart);
          }
          activeVideo.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    }
  }, [isPlaying, currentTime, trimRange, effectiveDuration, youtubeId, youtubePlayerRef, videoElementRef]);

  const seekRelative = useCallback((seconds: number) => {
    const maxTime = effectiveDuration > 0 ? effectiveDuration : (trimRange[1] || 99999);
    const newTime = Math.max(0, Math.min(currentTime + seconds, maxTime));
    seekToPosition(newTime);
  }, [effectiveDuration, trimRange, currentTime, seekToPosition]);

  // Sync current time loop
  useEffect(() => {
    let animationFrameId: number;
    let intervalId: any;

    const updateTime = () => {
      if (videoElementRef.current && isPlaying) {
        if (isSeekingRef.current) {
          if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateTime);
          }
          return;
        }
        try {
          const v = videoElementRef.current;
          setCurrentTime(v.currentTime);
          const clipStart = trimRange[0];
          const clipEnd = trimRange[1] > clipStart ? trimRange[1] : (effectiveDuration || clipStart + 60);
          if (v.currentTime >= clipEnd) {
            v.currentTime = clipStart;
            setCurrentTime(clipStart);
          }
        } catch (e) {}
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    if (youtubeId && youtubePlayerRef.current && isPlaying) {
      intervalId = setInterval(async () => {
        try {
          if (youtubePlayerRef.current) {
            const time = await youtubePlayerRef.current.getCurrentTime();

            if (isSeekingRef.current) {
              const target = pendingSeekTimeRef.current;
              const elapsed = Date.now() - (lastSeekTimeRef.current || 0);

              const origin = seekOriginTimeRef.current ?? target;
              const isSmallSeek = origin !== null && target !== null && Math.abs(target - origin) <= 1.5;
              const isCloseToTarget = target !== null && (Math.abs(time - target) < 1.2 || (time >= target && time <= target + 2.5));
              const isSmallSeekSettled = isSmallSeek && elapsed > 250;
              const isTimedOut = elapsed > 1500;

              if (isCloseToTarget || isSmallSeekSettled || isTimedOut) {
                isSeekingRef.current = false;
                pendingSeekTimeRef.current = null;
                seekOriginTimeRef.current = null;
                setCurrentTime(time);
              } else {
                return;
              }
            } else {
              setCurrentTime(time);
            }

            const clipStart = trimRange[0];
            const clipEnd = trimRange[1] > clipStart ? trimRange[1] : (effectiveDuration || clipStart + 60);
            if (!isSeekingRef.current) {
              if (time >= clipEnd) {
                youtubePlayerRef.current.seekTo(clipStart, true);
                setCurrentTime(clipStart);
              }
            }
          }
        } catch (e) {}
      }, 100);
    } else if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, trimRange, effectiveDuration, youtubeId, youtubePlayerRef, videoElementRef]);

  return {
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
    playClipFromStart,
    seekRelative,
    handleVolumeChange,
    toggleMute,
  };
}
