/**
 * Client-Side FFmpeg Engine (FFmpeg.wasm)
 * 
 * Executes real FFmpeg inside the user's browser using WebAssembly.
 * Slices, crops, and muxes exact video and audio ranges with zero server load
 * and zero frame-breaking artifacts.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { resolveRelayUrl } from './clientMediaRangeFetcher';

export interface FFmpegClipOptions {
  videoUrl: string;
  audioUrl?: string | null;
  trimStart: number;
  trimEnd?: number;
  format?: 'mp4' | 'mp3' | 'wav' | 'm4a' | string;
  quality?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | 'custom' | string;
  cropBox?: { x: number; y: number; width: number; height: number };
  duration?: number;
  videoFileSize?: number;
  audioFileSize?: number;
  videoBitrate?: number;
  onProgress?: (stage: string, percent: number) => void;
}

export interface FFmpegClipResult {
  blob: Blob;
  sizeBytes: number;
}

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Initializes and caches the single-threaded FFmpeg.wasm instance.
 * Single-threaded mode works on all domains/browsers without COOP/COEP isolation headers.
 */
export async function getFFmpeg(onProgress?: (stage: string, percent: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  if (loadPromise) {
    return await loadPromise;
  }

  loadPromise = (async () => {
    if (onProgress) onProgress('⚡ Loading in-browser FFmpeg engine...', 5);

    const ffmpeg = new FFmpeg();
    ffmpegInstance = ffmpeg;

    // Use single-threaded @ffmpeg/core 0.12.10 (runs without SharedArrayBuffer / COOP headers)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      isLoaded = true;
      return ffmpeg;
    } catch (primaryErr) {
      console.warn('[ClientFFmpegEngine] Primary CDN load failed, trying backup CDN:', primaryErr);
      const fallbackURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      isLoaded = true;
      return ffmpeg;
    }
  })();

  return await loadPromise;
}

/**
 * Downloads a single chunk (max 1 MB to strictly respect YouTube CDN limits).
 */
async function fetchStreamChunk(
  directUrl: string,
  startByte: number,
  endByte: number
): Promise<Uint8Array> {
  const relayUrl = resolveRelayUrl(directUrl);
  const response = await fetch(relayUrl, {
    headers: {
      Range: `bytes=${startByte}-${endByte}`,
    },
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Media chunk fetch failed: HTTP ${response.status} ${response.statusText}`);
  }

  const ab = await response.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Downloads media bytes in <=1MB chunks via Cloudflare Edge Relay to prevent YouTube CDN 403 blocks.
 */
async function fetchMediaInChunks(
  directUrl: string,
  totalBytesToFetch: number,
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const CHUNK_SIZE = 1048576; // 1 MB: YouTube CDN maximum allowed chunk size
  const totalChunks = Math.max(1, Math.ceil(totalBytesToFetch / CHUNK_SIZE));
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(totalBytesToFetch - 1, (i + 1) * CHUNK_SIZE - 1);
    const chunk = await fetchStreamChunk(directUrl, start, end);
    if (!chunk || chunk.length === 0) {
      if (chunks.length > 0) break;
      throw new Error(`Media chunk ${i} returned 0 bytes`);
    }
    chunks.push(chunk);
    receivedBytes += chunk.length;
    if (onProgress) {
      onProgress(Math.min(99, Math.round((receivedBytes / totalBytesToFetch) * 100)));
    }
  }

  const combined = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return combined;
}

/**
 * Computes FFmpeg crop filter for target aspect ratio.
 */
function buildCropFilter(
  aspectRatio: string = '16:9',
  cropBox?: { x: number; y: number; width: number; height: number }
): string | null {
  // If 16:9 standard landscape and no custom crop requested, no cropping needed!
  if ((aspectRatio === '16:9' || !aspectRatio) && !cropBox) {
    return null;
  }

  // If custom cropBox is provided
  if (cropBox && cropBox.width > 0 && cropBox.height > 0) {
    // If coordinates are normalized ratios (0 to 1)
    if (cropBox.width <= 1.0 && cropBox.height <= 1.0) {
      if (cropBox.width >= 0.98 && cropBox.height >= 0.98 && (aspectRatio === '16:9' || !aspectRatio)) {
        return null;
      }
      return `crop=trunc(iw*${cropBox.width}/2)*2:trunc(ih*${cropBox.height}/2)*2:trunc(iw*${cropBox.x}):trunc(ih*${cropBox.y})`;
    }
    // Absolute pixel coordinates
    const w = Math.max(2, Math.round(cropBox.width / 2) * 2);
    const h = Math.max(2, Math.round(cropBox.height / 2) * 2);
    const x = Math.max(0, Math.round(cropBox.x));
    const y = Math.max(0, Math.round(cropBox.y));
    return `crop=${w}:${h}:${x}:${y}`;
  }

  if (aspectRatio === '9:16') {
    return `crop=trunc(min(iw,ih*9/16)/2)*2:trunc(ih/2)*2:trunc((iw-out_w)/2):0`;
  } else if (aspectRatio === '1:1') {
    return `crop=trunc(min(iw,ih)/2)*2:trunc(min(iw,ih)/2)*2:trunc((iw-out_w)/2):trunc((ih-out_h)/2)`;
  } else if (aspectRatio === '4:5') {
    return `crop=trunc(min(iw,ih*4/5)/2)*2:trunc(ih/2)*2:trunc((iw-out_w)/2):0`;
  }

  return null;
}

export class ClientFFmpegEngine {
  /**
   * Main entry point to slice and mux video + audio using in-browser FFmpeg.
   */
  static async processClip(options: FFmpegClipOptions): Promise<FFmpegClipResult> {
    const {
      videoUrl,
      audioUrl,
      trimStart = 0,
      trimEnd,
      format = 'mp4',
      aspectRatio = '16:9',
      cropBox,
      videoFileSize,
      audioFileSize,
      onProgress,
    } = options;

    const ffmpeg = await getFFmpeg(onProgress);

    // Track FFmpeg logs for debugging
    const ffmpegLogs: string[] = [];
    const logHandler = ({ message }: { message: string }) => {
      ffmpegLogs.push(message);
      console.log('[FFmpeg]', message);
    };
    ffmpeg.on('log', logHandler);

    const isAudioOnly = format === 'mp3' || format === 'wav' || format === 'm4a';
    const effectiveTrimEnd = typeof trimEnd === 'number' && trimEnd > trimStart ? trimEnd : trimStart + 15;
    const duration = Math.max(0.1, effectiveTrimEnd - trimStart);

    // ── 1. AUDIO-ONLY EXPORT ──────────────────────────────────────────────────
    if (isAudioOnly) {
      const sourceUrl = audioUrl || videoUrl;
      if (!sourceUrl) throw new Error('No audio stream URL available.');

      // 128 kbps audio = 16 KB/s. 1 MB contains ~65.5 seconds of audio.
      const audioBytesNeeded = Math.min(
        audioFileSize || Infinity,
        Math.max(1048576, Math.ceil((effectiveTrimEnd + 20) * 20_000))
      );

      if (onProgress) onProgress('🎵 Streaming audio via Edge Relay...', 20);
      const audioBytes = await fetchMediaInChunks(sourceUrl, audioBytesNeeded, (pct) => {
        if (onProgress) onProgress(`🎵 Downloading audio (${pct}%)...`, 20 + Math.round(pct * 0.4));
      });

      if (onProgress) onProgress('⚡ Slicing audio clip in FFmpeg...', 65);
      await ffmpeg.writeFile('input_a.m4a', audioBytes);

      const outExt = format === 'mp3' ? 'wav' : format;
      const outName = `output.${outExt}`;
      try { await ffmpeg.deleteFile(outName); } catch {}

      const args: string[] = [
        '-y',
        '-ss', trimStart.toFixed(3),
        '-i', 'input_a.m4a',
        '-t', duration.toFixed(3),
      ];

      if (outExt === 'm4a') {
        args.push('-c:a', 'copy', '-avoid_negative_ts', 'make_zero', outName);
      } else {
        args.push(outName);
      }

      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        const errDetails = ffmpegLogs.slice(-8).join('\n');
        throw new Error(`FFmpeg audio export failed (exit ${exitCode}): ${errDetails}`);
      }

      const outputBytes = await ffmpeg.readFile(outName) as Uint8Array;
      try {
        await ffmpeg.deleteFile('input_a.m4a');
        await ffmpeg.deleteFile(outName);
      } catch {}

      const mimeType = outExt === 'm4a' ? 'audio/mp4' : 'audio/wav';
      const blob = new Blob([outputBytes.buffer as ArrayBuffer], { type: mimeType });

      return { blob, sizeBytes: blob.size };
    }

    // ── 2. VIDEO + AUDIO EXPORT ───────────────────────────────────────────────
    if (!videoUrl) throw new Error('No video stream URL provided.');

    // 1080p video = ~300 KB/s. Each 1MB chunk holds ~3.5 seconds of video.
    // Download enough chunks to comfortably cover trimStart to trimEnd + 15s keyframe buffer.
    const videoBytesNeeded = Math.min(
      videoFileSize || Infinity,
      Math.max(4 * 1048576, Math.ceil((effectiveTrimEnd + 15) * 450_000))
    );

    // Audio = ~16 KB/s. 1 MB contains ~65.5 seconds of audio.
    const audioBytesNeeded = Math.min(
      audioFileSize || Infinity,
      Math.max(1048576, Math.ceil((effectiveTrimEnd + 20) * 20_000))
    );

    if (onProgress) onProgress('⬇️ Streaming media streams in parallel...', 15);

    let videoPct = 0;
    let audioPct = 0;
    const updateCombinedProgress = () => {
      const combined = Math.round(15 + (videoPct * 0.45) + (audioPct * 0.15));
      if (onProgress) onProgress(`⬇️ Downloading media: Video ${videoPct}% | Audio ${audioPct}%...`, combined);
    };

    // Download video and audio concurrently over HTTP/2
    const [videoBytes, audioBytes] = await Promise.all([
      fetchMediaInChunks(videoUrl, videoBytesNeeded, (pct) => {
        videoPct = pct;
        updateCombinedProgress();
      }),
      audioUrl ? fetchMediaInChunks(audioUrl, audioBytesNeeded, (pct) => {
        audioPct = pct;
        updateCombinedProgress();
      }) : Promise.resolve(null),
    ]);

    if (onProgress) onProgress('⚡ Slicing and muxing video + audio in FFmpeg...', 78);

    await ffmpeg.writeFile('input_v.mp4', videoBytes);
    if (audioBytes) {
      await ffmpeg.writeFile('input_a.m4a', audioBytes);
    }

    const cropFilter = buildCropFilter(aspectRatio, cropBox);
    const outName = 'output.mp4';
    try { await ffmpeg.deleteFile(outName); } catch {}

    let args: string[];

    if (audioBytes) {
      // Both Video and Audio inputs
      if (cropFilter) {
        args = [
          '-y',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_v.mp4',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_a.m4a',
          '-t', duration.toFixed(3),
          '-vf', cropFilter,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '18',
          '-c:a', 'copy',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          outName,
        ];
      } else {
        // Fast, 100% lossless stream copy
        args = [
          '-y',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_v.mp4',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_a.m4a',
          '-t', duration.toFixed(3),
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          outName,
        ];
      }
    } else {
      // Single combined input (video + audio in one stream)
      if (cropFilter) {
        args = [
          '-y',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_v.mp4',
          '-t', duration.toFixed(3),
          '-vf', cropFilter,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '18',
          '-c:a', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          outName,
        ];
      } else {
        args = [
          '-y',
          '-ss', trimStart.toFixed(3),
          '-i', 'input_v.mp4',
          '-t', duration.toFixed(3),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          outName,
        ];
      }
    }

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      console.warn('[ClientFFmpegEngine] Stream copy exited with code', exitCode, '- executing safe keyframe re-encode fallback');
      try { await ffmpeg.deleteFile(outName); } catch {}

      const fallbackArgs = [
        '-y',
        '-ss', trimStart.toFixed(3),
        '-i', 'input_v.mp4',
        ...(audioBytes ? ['-ss', trimStart.toFixed(3), '-i', 'input_a.m4a'] : []),
        '-t', duration.toFixed(3),
        ...(cropFilter ? ['-vf', cropFilter] : []),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '18',
        '-c:a', 'copy',
        ...(audioBytes ? ['-map', '0:v:0', '-map', '1:a:0'] : []),
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        outName,
      ];
      const fallbackExit = await ffmpeg.exec(fallbackArgs);
      if (fallbackExit !== 0) {
        const errDetails = ffmpegLogs.slice(-10).join('\n');
        throw new Error(`FFmpeg clipping failed (exit ${fallbackExit}):\n${errDetails}`);
      }
    }

    if (onProgress) onProgress('📦 Extracting finished clip from engine...', 95);
    const outputData = await ffmpeg.readFile(outName) as Uint8Array;

    // Clean up MEMFS files to keep browser memory lightweight
    try {
      await ffmpeg.deleteFile('input_v.mp4');
      if (audioBytes) await ffmpeg.deleteFile('input_a.m4a');
      await ffmpeg.deleteFile(outName);
    } catch {}

    const blob = new Blob([outputData.buffer as ArrayBuffer], { type: 'video/mp4' });
    return { blob, sizeBytes: blob.size };
  }
}
