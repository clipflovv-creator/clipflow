import type { RefObject } from 'react';
import type { YouTubePlayer } from 'react-youtube';

export interface BasePlayerProps {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  effectiveDuration: number;
  trimRange: [number, number];
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setIsVideoBuffering: (buffering: boolean) => void;
  handleMediaDurationUpdate: (duration: number) => void;
  setVideoDimensions: (dims: { width: number; height: number }) => void;
  isSeekingRef: RefObject<boolean>;
  pendingSeekTimeRef: RefObject<number | null>;
  seekOriginTimeRef: RefObject<number | null>;
  lastSeekTimeRef: RefObject<number>;
}

export interface YouTubePlayerProps extends BasePlayerProps {
  youtubeId: string;
  youtubePlayerRef: RefObject<YouTubePlayer | null>;
  isPadMode: boolean;
  sourceAspectRatio: number;
  isDraggingSplitter: boolean;
  initialSessionTime?: number;
}

export interface TwitchPlayerProps extends BasePlayerProps {
  videoElementRef: RefObject<HTMLVideoElement | null>;
  twitchHlsUrl: string;
  isLiveStream?: boolean;
  seekToPosition: (pos: number) => void;
  setTrimRange: React.Dispatch<React.SetStateAction<[number, number]>>;
}

export interface InstagramPlayerProps extends BasePlayerProps {
  videoElementRef: RefObject<HTMLVideoElement | null>;
  audioElementRef: RefObject<HTMLAudioElement | null>;
  activeVideoSrc: string;
  activeAudioSrc: string | null;
  rawPreviewSrc: string;
  useProxyFallback: boolean;
  setUseProxyFallback: (fallback: boolean) => void;
}

export interface TwitterPlayerProps extends BasePlayerProps {
  videoElementRef: RefObject<HTMLVideoElement | null>;
  activeVideoSrc: string;
  rawPreviewSrc: string;
  useProxyFallback: boolean;
  setUseProxyFallback: (fallback: boolean) => void;
}
