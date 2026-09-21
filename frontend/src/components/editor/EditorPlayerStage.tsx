import { Loader2 } from 'lucide-react';
import type { YouTubePlayer } from 'react-youtube';
import { CropFrameOverlay, type CropBox } from '../CropFrameOverlay';
import {
  YouTubePlayerView,
  TwitchPlayerView,
  InstagramPlayerView,
  TwitterPlayerView,
} from './platforms';

interface EditorPlayerStageProps {
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  videoCanvasRef: React.RefObject<HTMLDivElement | null>;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  audioElementRef: React.RefObject<HTMLAudioElement | null>;
  youtubePlayerRef: React.RefObject<YouTubePlayer | null>;
  videoHeight: number;
  currentContainerAspect: number;
  sourceAspectRatio: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  fitMode: 'crop' | 'pad';
  isPadMode: boolean;
  cropBox: CropBox;
  containerDims: { width: number; height: number };
  handleCropBoxChange: (box: CropBox) => void;
  togglePlay: () => void;
  isDraggingSplitter: boolean;
  isVideoBuffering: boolean;
  isYouTube: boolean;
  youtubeId: string | null;
  isTwitch: boolean;
  twitchHlsUrl: string;
  isInstagram: boolean;
  isTwitter: boolean;
  activeVideoSrc: string;
  activeAudioSrc: string | null;
  rawPreviewSrc: string;
  useProxyFallback: boolean;
  setUseProxyFallback: (fallback: boolean) => void;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  effectiveDuration: number;
  trimRange: [number, number];
  isLiveStream?: boolean;
  initialSessionTime?: number;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setIsVideoBuffering: (buffering: boolean) => void;
  handleMediaDurationUpdate: (dur: number) => void;
  setVideoDimensions: (dims: { width: number; height: number }) => void;
  seekToPosition: (pos: number) => void;
  setTrimRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  isSeekingRef: React.RefObject<boolean>;
  pendingSeekTimeRef: React.RefObject<number | null>;
  seekOriginTimeRef: React.RefObject<number | null>;
  lastSeekTimeRef: React.RefObject<number>;
}

export function EditorPlayerStage(props: EditorPlayerStageProps) {
  const {
    videoContainerRef,
    videoCanvasRef,
    videoHeight,
    currentContainerAspect,
    sourceAspectRatio,
    aspectRatio,
    fitMode,
    isPadMode,
    cropBox,
    containerDims,
    handleCropBoxChange,
    togglePlay,
    isDraggingSplitter,
    isVideoBuffering,
    isYouTube,
    youtubeId,
    isTwitch,
    isInstagram,
  } = props;

  return (
    <div
      ref={videoContainerRef as any}
      style={{ height: `${videoHeight}px` }}
      className="w-full flex flex-col items-center justify-center bg-black/70 rounded-2xl border border-white/[0.07] overflow-hidden relative p-3 shadow-inner shrink-0 transition-[height] duration-75 select-none"
    >
      <div
        onClick={(e) => {
          if (aspectRatio === '16:9' || isPadMode) {
            if (!youtubeId || e.target === e.currentTarget || e.target === videoCanvasRef.current) {
              togglePlay();
            }
          }
        }}
        className={`relative w-full h-full flex items-center justify-center overflow-hidden group select-none ${
          (aspectRatio === '16:9' || isPadMode) ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div
          ref={videoCanvasRef as any}
          style={{
            aspectRatio: `${currentContainerAspect}`,
          }}
          className={`relative h-full max-h-full max-w-full w-auto bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-2xl transition-[aspect-ratio] duration-200 select-none ${
            isPadMode ? 'border-2 border-white/25 shadow-[0_0_25px_rgba(0,0,0,0.8)]' : 'border border-white/10'
          }`}
        >
          <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-black">
            {isYouTube && youtubeId ? (
              <YouTubePlayerView
                youtubeId={youtubeId}
                youtubePlayerRef={props.youtubePlayerRef}
                isPadMode={isPadMode}
                sourceAspectRatio={sourceAspectRatio}
                isDraggingSplitter={isDraggingSplitter}
                isPlaying={props.isPlaying}
                volume={props.volume}
                isMuted={props.isMuted}
                currentTime={props.currentTime}
                effectiveDuration={props.effectiveDuration}
                trimRange={props.trimRange}
                initialSessionTime={props.initialSessionTime}
                setIsPlaying={props.setIsPlaying}
                setCurrentTime={props.setCurrentTime}
                setIsVideoBuffering={props.setIsVideoBuffering}
                handleMediaDurationUpdate={props.handleMediaDurationUpdate}
                setVideoDimensions={props.setVideoDimensions}
                isSeekingRef={props.isSeekingRef}
                pendingSeekTimeRef={props.pendingSeekTimeRef}
                seekOriginTimeRef={props.seekOriginTimeRef}
                lastSeekTimeRef={props.lastSeekTimeRef}
              />
            ) : isTwitch ? (
              <TwitchPlayerView
                videoElementRef={props.videoElementRef}
                twitchHlsUrl={props.twitchHlsUrl}
                isPlaying={props.isPlaying}
                volume={props.volume}
                isMuted={props.isMuted}
                currentTime={props.currentTime}
                effectiveDuration={props.effectiveDuration}
                trimRange={props.trimRange}
                isLiveStream={props.isLiveStream}
                setIsPlaying={props.setIsPlaying}
                setCurrentTime={props.setCurrentTime}
                setIsVideoBuffering={props.setIsVideoBuffering}
                handleMediaDurationUpdate={props.handleMediaDurationUpdate}
                setVideoDimensions={props.setVideoDimensions}
                seekToPosition={props.seekToPosition}
                setTrimRange={props.setTrimRange}
                isSeekingRef={props.isSeekingRef}
                pendingSeekTimeRef={props.pendingSeekTimeRef}
                seekOriginTimeRef={props.seekOriginTimeRef}
                lastSeekTimeRef={props.lastSeekTimeRef}
              />
            ) : isInstagram ? (
              <InstagramPlayerView
                videoElementRef={props.videoElementRef}
                audioElementRef={props.audioElementRef}
                activeVideoSrc={props.activeVideoSrc}
                activeAudioSrc={props.activeAudioSrc}
                rawPreviewSrc={props.rawPreviewSrc}
                useProxyFallback={props.useProxyFallback}
                setUseProxyFallback={props.setUseProxyFallback}
                isPlaying={props.isPlaying}
                volume={props.volume}
                isMuted={props.isMuted}
                currentTime={props.currentTime}
                effectiveDuration={props.effectiveDuration}
                trimRange={props.trimRange}
                setIsPlaying={props.setIsPlaying}
                setCurrentTime={props.setCurrentTime}
                setIsVideoBuffering={props.setIsVideoBuffering}
                handleMediaDurationUpdate={props.handleMediaDurationUpdate}
                setVideoDimensions={props.setVideoDimensions}
                isSeekingRef={props.isSeekingRef}
                pendingSeekTimeRef={props.pendingSeekTimeRef}
                seekOriginTimeRef={props.seekOriginTimeRef}
                lastSeekTimeRef={props.lastSeekTimeRef}
              />
            ) : (
              <TwitterPlayerView
                videoElementRef={props.videoElementRef}
                activeVideoSrc={props.activeVideoSrc}
                rawPreviewSrc={props.rawPreviewSrc}
                useProxyFallback={props.useProxyFallback}
                setUseProxyFallback={props.setUseProxyFallback}
                isPlaying={props.isPlaying}
                volume={props.volume}
                isMuted={props.isMuted}
                currentTime={props.currentTime}
                effectiveDuration={props.effectiveDuration}
                trimRange={props.trimRange}
                setIsPlaying={props.setIsPlaying}
                setCurrentTime={props.setCurrentTime}
                setIsVideoBuffering={props.setIsVideoBuffering}
                handleMediaDurationUpdate={props.handleMediaDurationUpdate}
                setVideoDimensions={props.setVideoDimensions}
                isSeekingRef={props.isSeekingRef}
                pendingSeekTimeRef={props.pendingSeekTimeRef}
                seekOriginTimeRef={props.seekOriginTimeRef}
                lastSeekTimeRef={props.lastSeekTimeRef}
              />
            )}

            {/* Video Buffering Overlay */}
            {isVideoBuffering && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}

            {/* Interactive Dynamic Crop Framing Box Overlay */}
            {aspectRatio !== '16:9' && (aspectRatio === 'custom' || fitMode === 'crop') && (
              <CropFrameOverlay
                cropBox={cropBox}
                onChange={handleCropBoxChange}
                containerWidth={containerDims.width || 800}
                containerHeight={containerDims.height || 450}
                aspectRatio={aspectRatio}
                sourceAspectRatio={sourceAspectRatio}
              />
            )}

            {/* Framing Badge in Fit Mode */}
            {isPadMode && (
              <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none select-none">
                <span className="bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white border border-white/20 shadow-lg flex items-center gap-1.5">
                  <span>{aspectRatio}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-300 font-mono text-[9px]">FIT</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
