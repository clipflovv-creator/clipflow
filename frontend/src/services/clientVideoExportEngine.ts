/**
 * Client-Side Video & Audio Export Processing Engine
 * 
 * Performs 100% in-browser video trimming, audio extraction & encoding,
 * aspect ratio cropping (9:16, 1:1, 4:5), and MP4 muxing using in-browser
 * WebAssembly FFmpeg with ZERO server bandwidth and ZERO frame-breaking artifacts.
 */

import { findBestTracks } from './clientMediaRangeFetcher';
import { ClientFFmpegEngine } from './clientFFmpegEngine';
import { api } from './api';

export interface ClientExportOptions {
  metadata: any;
  trimStart: number;
  trimEnd?: number;
  format?: 'mp4' | 'mp3' | 'wav' | 'm4a' | 'captions' | string;
  quality?: string;
  audioQuality?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | 'custom' | string;
  cropBox?: { x: number; y: number; width: number; height: number };
  fitMode?: 'crop' | 'pad';
  cropPosition?: 'center' | 'left' | 'right';
  customFileName?: string;
  onProgress?: (phase: string, percent?: number) => void;
}

export interface ClientExportResult {
  blob: Blob;
  fileName: string;
  url: string;
  sizeBytes: number;
}

/**
 * Triggers a native browser file download from a Blob or URL.
 */
export function triggerBrowserDownload(data: Blob | string, fileName: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    if (typeof data !== 'string') {
      URL.revokeObjectURL(url);
    }
  }, 2000);
}

export class ClientVideoExportEngine {
  /**
   * Main entry point for exporting a clip directly on the user's device.
   * Utilizes client-side FFmpeg WebAssembly for lossless cuts, zero frame tears,
   * and synchronized audio.
   */
  static async exportClip(options: ClientExportOptions): Promise<ClientExportResult> {
    const {
      metadata,
      trimStart = 0,
      trimEnd,
      format = 'mp4',
      quality = '1080p',
      aspectRatio = '16:9',
      fitMode = 'pad',
      cropPosition = 'center',
      cropBox,
      customFileName,
      onProgress,
    } = options;

    const totalDuration = metadata?.duration || 60;
    const effectiveTrimEnd = typeof trimEnd === 'number' && trimEnd > trimStart ? trimEnd : totalDuration;

    const safeTitle = (customFileName || metadata?.title || 'ClipFlow_Clip')
      .replace(/[<>:"/\\|?*]+/g, '_')
      .trim();

    // Select the best direct video and audio tracks
    let currentMetadata = metadata;
    let tracks = findBestTracks(currentMetadata, quality);

    // If formats are missing (e.g. from an earlier lightweight load or fallback), fetch full metadata from backend
    if (!tracks.videoFormat && !tracks.combinedFormat) {
      const pageUrl = currentMetadata?.webpage_url || currentMetadata?.url;
      if (pageUrl && (pageUrl.includes('youtube.com') || pageUrl.includes('youtu.be') || pageUrl.includes('twitch.tv'))) {
        if (onProgress) onProgress('🔍 Retrieving high-resolution video streams...', 5);
        try {
          const res = await api.video.getMetadata(pageUrl);
          if (res.ok) {
            const freshMeta = await res.json();
            if (freshMeta?.formats && freshMeta.formats.length > 0) {
              currentMetadata = freshMeta;
              tracks = findBestTracks(currentMetadata, quality);
            }
          }
        } catch (fetchErr) {
          console.warn('[ClientVideoExportEngine] Stream metadata refresh failed:', fetchErr);
        }
      }
    }

    const videoStreamUrl = tracks.videoFormat?.url || tracks.combinedFormat?.url || currentMetadata?.direct_stream_url;
    let audioStreamUrl = tracks.audioFormat?.url || (tracks.combinedFormat ? tracks.combinedFormat.url : null);

    if (!videoStreamUrl) {
      throw new Error('Direct video stream format not found. Please reload the video or verify backend connectivity.');
    }

    // If audioStreamUrl points to the exact same file as videoStreamUrl,
    // or if the chosen video format already contains embedded audio, no separate audio stream is needed.
    const videoHasAudio = Boolean(
      tracks.videoFormat?.acodec && tracks.videoFormat.acodec !== 'none'
    );
    if (audioStreamUrl === videoStreamUrl || videoHasAudio) {
      audioStreamUrl = null;
    }

    if (onProgress) onProgress('🚀 Initializing in-browser FFmpeg engine...', 5);

    const isAudioOnly = format === 'mp3' || format === 'wav' || format === 'm4a';
    const effectiveFormat = isAudioOnly ? format : 'mp4';
    const finalExt = isAudioOnly ? (format === 'mp3' ? 'wav' : format) : 'mp4';
    const finalFileName = `${safeTitle}.${finalExt}`;

    // Delegate processing to in-browser FFmpeg engine
    const result = await ClientFFmpegEngine.processClip({
      videoUrl: videoStreamUrl,
      audioUrl: audioStreamUrl,
      trimStart,
      trimEnd: effectiveTrimEnd,
      format: effectiveFormat,
      quality,
      aspectRatio,
      fitMode,
      cropPosition,
      cropBox: (aspectRatio === 'custom' || fitMode === 'crop') ? cropBox : undefined,
      duration: totalDuration,
      videoFileSize: tracks.videoFormat?.filesize,
      audioFileSize: tracks.audioFormat?.filesize,
      videoBitrate: tracks.videoFormat?.tbr || tracks.videoFormat?.vbr,
      onProgress: (stage, percent) => {
        if (onProgress) onProgress(stage, percent);
      },
    });

    const downloadUrl = URL.createObjectURL(result.blob);

    if (onProgress) onProgress('✅ Complete! Downloading your clip...', 100);

    // Automatically trigger native browser download
    triggerBrowserDownload(result.blob, finalFileName);

    return {
      blob: result.blob,
      fileName: finalFileName,
      url: downloadUrl,
      sizeBytes: result.sizeBytes,
    };
  }
}
