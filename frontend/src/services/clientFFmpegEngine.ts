/**
 * Client-Side FFmpeg Engine (FFmpeg.wasm)
 * 
 * Executes real FFmpeg inside the user's browser using WebAssembly.
 * Slices, crops, and muxes exact video and audio ranges with zero server load
 * and zero frame-breaking artifacts.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { resolveRelayUrl, fetchSidxSlice } from './clientMediaRangeFetcher';

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
 * Downloads a single chunk for YouTube CDN.
 */
async function fetchStreamChunk(
  directUrl: string,
  startByte: number,
  endByte: number
): Promise<{ chunk: Uint8Array; isEof: boolean }> {
  const relayUrl = resolveRelayUrl(directUrl);
  const response = await fetch(relayUrl, {
    headers: {
      Range: `bytes=${startByte}-${endByte}`,
    },
  });

  // 416 means startByte is beyond the end of the file (EOF reached)
  if (response.status === 416) {
    return { chunk: new Uint8Array(0), isEof: true };
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Media chunk fetch failed: HTTP ${response.status} ${response.statusText}`);
  }

  const ab = await response.arrayBuffer();
  const chunk = new Uint8Array(ab);

  const contentRange = response.headers.get('content-range') || '';
  const totalMatch = contentRange.match(/\/(\d+)$/);
  const totalFileSize = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const isEof = (totalFileSize > 0 && (startByte + chunk.length) >= totalFileSize) ||
                (chunk.length < (endByte - startByte + 1));

  return { chunk, isEof };
}

/**
 * Direct full-stream download via Edge Relay.
 * Used for Instagram, Twitter, and other non-YouTube platforms where files are standalone
 * and byte-range slicing causes 416 errors.
 */
async function fetchDirectMediaStream(
  directUrl: string,
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const relayUrl = resolveRelayUrl(directUrl);
  const response = await fetch(relayUrl);

  if (!response.ok) {
    throw new Error(`Media direct download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body) {
    const ab = await response.arrayBuffer();
    if (onProgress) onProgress(100);
    return new Uint8Array(ab);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      if (onProgress) {
        if (totalBytes > 0) {
          onProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)));
        } else {
          // Smooth estimation for chunked transfer encoding (approx 3MB typical stream)
          const estimated = Math.min(95, Math.round(15 + (receivedBytes / (3 * 1024 * 1024)) * 80));
          onProgress(estimated);
        }
      }
    }
  }

  const combined = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }

  if (onProgress) onProgress(100);
  return combined;
}

/**
 * Downloads media bytes in <=1MB chunks via Cloudflare Edge Relay for YouTube CDN.
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
    const { chunk, isEof } = await fetchStreamChunk(directUrl, start, end);
    if (chunk.length > 0) {
      chunks.push(chunk);
      receivedBytes += chunk.length;
      if (onProgress) {
        onProgress(Math.min(99, Math.round((receivedBytes / totalBytesToFetch) * 100)));
      }
    }
    if (isEof) {
      break;
    }
  }

  if (receivedBytes === 0) {
    throw new Error('Media download returned 0 bytes.');
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
 * Downloads a media stream using the optimal strategy:
 * 1. For YouTube: Attempts high-efficiency sidx ranged segment extraction.
 *    Downloads only ~3MB to 8MB of target subsegments even on 2-hour videos.
 * 2. Fallback: <=1MB chunked range requests from byte 0.
 * 3. For Instagram / Twitter: Direct full-stream fetch to prevent 416 Range errors.
 */
async function fetchSmartMediaStream(
  url: string,
  trimStart: number,
  trimEnd: number,
  estimatedBitrate: number,
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; relativeStart: number; isSidx: boolean }> {
  const isYouTube = url.includes('googlevideo.com') || url.includes('youtube.com');

  if (isYouTube) {
    // 1. High-efficiency sidx ranged extraction
    try {
      const sidxSlice = await fetchSidxSlice(url, trimStart, trimEnd, onProgress);
      if (sidxSlice && sidxSlice.data.length > 0) {
        return {
          bytes: sidxSlice.data,
          relativeStart: sidxSlice.relativeStart,
          isSidx: true,
        };
      }
    } catch (e) {
      console.warn('[fetchSmartMediaStream] sidx extraction failed, falling back to chunked fetch:', e);
    }

    // 2. Fallback: clamped chunked range from byte 0
    const bytesNeeded = Math.min(
      200 * 1048576,
      Math.max(4 * 1048576, Math.ceil((trimEnd + 15) * estimatedBitrate))
    );
    const bytes = await fetchMediaInChunks(url, bytesNeeded, onProgress);
    return {
      bytes,
      relativeStart: trimStart,
      isSidx: false,
    };
  }

  // Direct fast streaming for Instagram, Twitter, and other non-YouTube platforms
  const bytes = await fetchDirectMediaStream(url, onProgress);
  return {
    bytes,
    relativeStart: trimStart,
    isSidx: false,
  };
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

      if (onProgress) onProgress('🎵 Streaming audio via Edge Relay...', 20);
      const audioSlice = await fetchSmartMediaStream(sourceUrl, trimStart, effectiveTrimEnd, 20_000, (pct) => {
        if (onProgress) onProgress(`🎵 Downloading audio (${pct}%)...`, 20 + Math.round(pct * 0.45));
      });

      if (onProgress) onProgress('⚡ Slicing audio clip in FFmpeg...', 70);
      await ffmpeg.writeFile('input_a.m4a', audioSlice.bytes);

      const outExt = format === 'mp3' ? 'wav' : format;
      const outName = `output.${outExt}`;
      try { await ffmpeg.deleteFile(outName); } catch {}

      const aStart = audioSlice.relativeStart;
      const args: string[] = [
        '-y',
        '-ss', aStart.toFixed(3),
        '-i', 'input_a.m4a',
        '-t', duration.toFixed(3),
        '-c:a', outExt === 'wav' ? 'pcm_s16le' : 'aac',
        ...(outExt === 'wav' ? [] : ['-b:a', '192k']),
        '-avoid_negative_ts', 'make_zero',
        outName,
      ];

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

    if (onProgress) onProgress('⬇️ Streaming media streams in parallel...', 15);

    let videoPct = 0;
    let audioPct = 0;
    const updateCombinedProgress = () => {
      const combined = Math.round(15 + (videoPct * 0.45) + (audioPct * 0.15));
      if (onProgress) onProgress(`⬇️ Downloading media: Video ${videoPct}% | Audio ${audioPct}%...`, combined);
    };

    // Download video and audio concurrently using intelligent sidx ranged slices
    const [videoSlice, audioSlice] = await Promise.all([
      fetchSmartMediaStream(videoUrl, trimStart, effectiveTrimEnd, 450_000, (pct) => {
        videoPct = pct;
        updateCombinedProgress();
      }),
      audioUrl ? fetchSmartMediaStream(audioUrl, trimStart, effectiveTrimEnd, 20_000, (pct) => {
        audioPct = pct;
        updateCombinedProgress();
      }) : Promise.resolve(null),
    ]);

    if (onProgress) onProgress('⚡ Slicing and muxing video + audio in FFmpeg...', 78);

    await ffmpeg.writeFile('input_v.mp4', videoSlice.bytes);
    if (audioSlice) {
      await ffmpeg.writeFile('input_a.m4a', audioSlice.bytes);
    }

    const cropFilter = buildCropFilter(aspectRatio, cropBox);
    const outName = 'output.mp4';
    try { await ffmpeg.deleteFile(outName); } catch {}

    const vRelativeStart = videoSlice.relativeStart;
    const aRelativeStart = audioSlice ? audioSlice.relativeStart : vRelativeStart;

    // Frame-accurate transcode with universal H.264 (yuv420p) and synchronized AAC audio
    const args: string[] = [
      '-y',
      '-ss', vRelativeStart.toFixed(3),
      '-i', 'input_v.mp4',
      ...(audioSlice ? ['-ss', aRelativeStart.toFixed(3), '-i', 'input_a.m4a'] : []),
      '-t', duration.toFixed(3),
      ...(cropFilter ? ['-vf', cropFilter] : []),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      ...(audioSlice ? ['-map', '0:v:0', '-map', '1:a:0'] : []),
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      outName,
    ];

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      console.warn('[ClientFFmpegEngine] Initial export exited with code', exitCode, '- executing safe fallback');
      try { await ffmpeg.deleteFile(outName); } catch {}

      const fallbackArgs = [
        '-y',
        '-ss', vRelativeStart.toFixed(3),
        '-i', 'input_v.mp4',
        ...(audioSlice ? ['-ss', aRelativeStart.toFixed(3), '-i', 'input_a.m4a'] : []),
        '-t', duration.toFixed(3),
        ...(cropFilter ? ['-vf', cropFilter] : []),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-avoid_negative_ts', 'make_zero',
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
      if (audioSlice) await ffmpeg.deleteFile('input_a.m4a');
      await ffmpeg.deleteFile(outName);
    } catch {}

    const blob = new Blob([outputData.buffer as ArrayBuffer], { type: 'video/mp4' });
    return { blob, sizeBytes: blob.size };
  }
}
