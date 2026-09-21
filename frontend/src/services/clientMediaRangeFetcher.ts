/**
 * Client-Side Media Range Fetcher
 * 
 * Performs HTTP Range queries directly from the user's browser via an Edge Relay
 * (Cloudflare Worker or dev proxy) to stream only the needed byte chunks.
 */

import * as MP4Box from 'mp4box';

// Edge Relay URL (if deployed on Cloudflare Workers, set VITE_EDGE_RELAY_URL in frontend/.env)
// Example: https://yt-range-relay.yourname.workers.dev
const EDGE_RELAY_URL = (import.meta.env.VITE_EDGE_RELAY_URL as string) || '';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

/**
 * Wraps a direct media stream URL (e.g. Googlevideo) with CORS proxy / Edge Relay.
 */
export function resolveRelayUrl(directUrl: string): string {
  if (!directUrl) return '';

  // If already relative or hosted on same domain
  if (directUrl.startsWith('/') || directUrl.startsWith('blob:')) {
    return directUrl;
  }

  // 1. Cloudflare Worker Edge Relay (Zero Render Load & Unlimited Bandwidth)
  if (EDGE_RELAY_URL) {
    const base = EDGE_RELAY_URL.endsWith('/') ? EDGE_RELAY_URL : `${EDGE_RELAY_URL}/`;
    return `${base}?url=${encodeURIComponent(directUrl)}`;
  }

  // 2. Dev / Fallback: Backend streaming range proxy (Pipes directly without disk storage)
  return `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(directUrl)}`;
}

/**
 * Fetches an exact byte range from a stream URL.
 */
export async function fetchByteRange(
  url: string,
  startByte: number,
  endByte?: number,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<ArrayBuffer> {
  const proxiedUrl = resolveRelayUrl(url);
  const rangeHeader = typeof endByte === 'number' && endByte >= startByte
    ? `bytes=${startByte}-${endByte}`
    : `bytes=${startByte}-`;

  const response = await fetch(proxiedUrl, {
    headers: {
      Range: rangeHeader,
    },
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Range fetch failed with status ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    return await response.arrayBuffer();
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalExpected = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (endByte ? (endByte - startByte + 1) : 0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      if (onProgress && totalExpected > 0) {
        onProgress(receivedBytes, totalExpected);
      }
    }
  }

  // Concatenate chunks into single ArrayBuffer
  const combined = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined.buffer;
}

export interface StreamTrackSelection {
  videoFormat: any | null;
  audioFormat: any | null;
  combinedFormat: any | null;
}

/**
 * Helper to test if a format is a direct stream (MP4, WebM, HTTPS) rather than an HLS/DASH manifest playlist.
 */
export function isDirectStream(f: any): boolean {
  if (!f || !f.url) return false;
  const url = f.url.toLowerCase();
  if (
    url.includes('.m3u8') ||
    url.includes('/playlist/') ||
    url.includes('manifest/hls') ||
    url.includes('master.m3u8') ||
    url.includes('playlist.m3u8')
  ) {
    return false;
  }
  if (f.protocol && (f.protocol.includes('m3u8') || f.protocol.includes('hls'))) {
    return false;
  }
  return true;
}

/**
 * Finds the optimal video and audio stream formats for a requested target resolution.
 */
export function findBestTracks(metadata: any, targetQuality: string = '1080p'): StreamTrackSelection {
  if (!metadata) {
    return { videoFormat: null, audioFormat: null, combinedFormat: null };
  }

  const formats: any[] = metadata.formats || [];
  const cleanQ = targetQuality.toLowerCase().replace('p', '');
  const targetHeight = parseInt(cleanQ, 10) || 1080;

  // 1. Filter only direct streams (no HLS m3u8 playlists)
  const directFormats = formats.filter(isDirectStream);

  // 2. Separate direct Video-only formats (MP4, WebM, AV1)
  const videoOnly = directFormats.filter((f) => {
    return f.url && f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none');
  });

  // 3. Separate direct Audio-only formats (M4A, AAC, Opus)
  const audioOnly = directFormats.filter((f) => {
    return f.url && f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none');
  });

  // 4. Combined formats (contains both video and audio)
  const combined = directFormats.filter((f) => {
    return f.url && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';
  });

  // Find best matching video stream (prefer MP4 format with exact target height)
  let bestVideo = videoOnly.find((f) => f.height === targetHeight && f.ext === 'mp4');
  if (!bestVideo) {
    bestVideo = videoOnly.find((f) => f.height === targetHeight);
  }
  if (!bestVideo) {
    // Find closest height <= targetHeight, or highest available
    const sorted = [...videoOnly].sort((a, b) => (b.height || 0) - (a.height || 0));
    bestVideo = sorted.find((f) => (f.height || 0) <= targetHeight) || sorted[0] || null;
  }
  // Fallback to combined if no separate video
  if (!bestVideo) {
    bestVideo = combined.find((f) => f.height === targetHeight) || combined[0] || null;
  }

  // Find best matching audio stream (prefer m4a/aac or high bitrate opus)
  const sortedAudio = [...audioOnly].sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
  let bestAudio = sortedAudio.find((f) => f.ext === 'm4a') || sortedAudio[0] || null;

  // Robust fallback: Check metadata.audio_formats or any direct format with acodec
  if (!bestAudio) {
    const directAudioFormats = (metadata.audio_formats || []).filter(isDirectStream);
    const sortedAudioMeta = [...directAudioFormats].sort((a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    bestAudio = sortedAudioMeta.find((f: any) => f.ext === 'm4a') || sortedAudioMeta[0] || null;
  }
  if (!bestAudio) {
    const anyAudio = directFormats.filter((f) => f.url && f.acodec && f.acodec !== 'none');
    const sortedAnyAudio = [...anyAudio].sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    bestAudio = sortedAnyAudio[0] || null;
  }

  // Best combined format fallback
  const sortedCombined = [...combined].sort((a, b) => (b.height || 0) - (a.height || 0));
  const bestCombined = sortedCombined.find((f) => f.height === targetHeight) || sortedCombined[0] || null;

  return {
    videoFormat: bestVideo,
    audioFormat: bestAudio,
    combinedFormat: bestCombined,
  };
}

export interface AudioSampleChunk {
  data: Uint8Array;
  timestamp: number; // in microseconds (0-based)
  duration: number; // in microseconds
  sampleNumber: number;
}

export interface ExtractedAudioRange {
  chunks: AudioSampleChunk[];
  sampleRate: number;
  numberOfChannels: number;
  codec: string;
  durationSeconds: number;
}

/**
 * Extracts exact audio clip range samples using HTTP Range requests and MP4Box.
 * 
 * 1. Fetches only the initial header bytes (~64KB - 128KB) to parse track and sample tables.
 * 2. Determines the exact byte range [startByte, endByte] for samples overlapping [trimStart, trimEnd].
 * 3. Downloads ONLY that single slice (~200KB - 500KB) via Range request.
 * 4. Yields raw AAC frames ready for direct MP4 muxing with zero re-encoding and zero full-file download.
 */
export async function extractAudioRangeSamples(
  audioStreamUrl: string,
  trimStart: number,
  trimEnd: number,
  onProgress?: (message: string, percent?: number) => void
): Promise<ExtractedAudioRange | null> {
  if (!audioStreamUrl) return null;

  try {
    if (onProgress) onProgress('🎵 Inspecting audio stream header via Range request...', 10);

    const mp4boxfile = MP4Box.createFile();
    let audioTrackId: number | null = null;
    let sampleRate = 44100;
    let numberOfChannels = 2;
    let timescale = 44100;
    let isReady = false;

    mp4boxfile.onReady = (info: any) => {
      isReady = true;
      const audioTrack = info.audioTracks?.[0] || info.tracks?.find((t: any) => t.type === 'audio' || t.audio);
      if (audioTrack) {
        audioTrackId = audioTrack.id;
        if (audioTrack.audio?.sample_rate) sampleRate = audioTrack.audio.sample_rate;
        if (audioTrack.audio?.channel_count) numberOfChannels = audioTrack.audio.channel_count;
        if (audioTrack.timescale) timescale = audioTrack.timescale;
      }
    };

    // Step 1: Fetch initial header chunks (typically 64KB - 128KB)
    let currentStart = 0;
    const headerChunkSize = 65536; // 64 KB
    const maxHeaderBytes = 262144; // 256 KB max for header

    while (!isReady && currentStart < maxHeaderBytes) {
      const chunkEnd = currentStart + headerChunkSize - 1;
      const headerBuf: any = await fetchByteRange(audioStreamUrl, currentStart, chunkEnd);
      headerBuf.fileStart = currentStart;
      const nextPos = mp4boxfile.appendBuffer(headerBuf);
      if (isReady || mp4boxfile.moov) break;
      if (nextPos && nextPos > currentStart) {
        currentStart = nextPos;
      } else {
        currentStart += headerChunkSize;
      }
    }

    if (!mp4boxfile.moov) {
      console.warn('[extractAudioRangeSamples] Could not find moov box in initial header range.');
      return null;
    }

    // Locate the audio track
    let trak: any = null;
    if (audioTrackId !== null) {
      trak = mp4boxfile.getTrackById(audioTrackId);
    }
    if (!trak && mp4boxfile.moov.traks?.length) {
      trak = mp4boxfile.moov.traks.find((t: any) => {
        const hdlr = t.mdia?.hdlr?.handler;
        return hdlr === 'soun' || t.mdia?.minf?.stbl?.stsd?.entries?.some((e: any) => e.type === 'mp4a');
      }) || mp4boxfile.moov.traks[0];
    }

    if (!trak) {
      console.warn('[extractAudioRangeSamples] No audio track found in moov box.');
      return null;
    }

    // Extract track sample rate & channel count from stsd if not found in onReady
    const stsdEntry = trak.mdia?.minf?.stbl?.stsd?.entries?.[0];
    if (stsdEntry?.samplerate) sampleRate = stsdEntry.samplerate;
    if (stsdEntry?.channel_count) numberOfChannels = stsdEntry.channel_count;
    if (trak.mdia?.mdhd?.timescale) timescale = trak.mdia.mdhd.timescale;

    const samples: any[] = trak.samples || [];
    if (samples.length === 0) {
      console.warn('[extractAudioRangeSamples] Audio track contains 0 indexed samples in moov.');
      return null;
    }

    // Step 2: Identify samples falling within [trimStart, trimEnd]
    const effectiveTrimEnd = trimEnd > trimStart ? trimEnd : trimStart + 60;
    const matchingSamples = samples.filter((s: any) => {
      const sStartSec = s.cts / timescale;
      const sEndSec = (s.cts + s.duration) / timescale;
      return sEndSec >= trimStart && sStartSec <= effectiveTrimEnd;
    });

    if (matchingSamples.length === 0) {
      console.warn(`[extractAudioRangeSamples] No samples match time range [${trimStart}, ${effectiveTrimEnd}].`);
      return null;
    }

    const firstSample = matchingSamples[0];
    const lastSample = matchingSamples[matchingSamples.length - 1];

    const startByte = firstSample.offset;
    const endByte = lastSample.offset + lastSample.size - 1;
    const sliceByteCount = endByte - startByte + 1;

    if (onProgress) {
      onProgress(`🎵 Downloading requested audio clip slice (${Math.round(sliceByteCount / 1024)} KB)...`, 20);
    }

    // Step 3: Fetch ONLY the requested sample range bytes
    const sliceBuffer = await fetchByteRange(audioStreamUrl, startByte, endByte);
    const sliceUint8 = new Uint8Array(sliceBuffer);

    // Step 4: Extract and package individual sample chunks
    const chunks: AudioSampleChunk[] = [];
    const baseCts = firstSample.cts;
    const targetDurationSec = effectiveTrimEnd - trimStart;

    for (const s of matchingSamples) {
      const relTimeSec = (s.cts - baseCts) / timescale;
      if (relTimeSec > targetDurationSec + 0.05) break;

      const relOffset = s.offset - startByte;
      if (relOffset < 0 || relOffset + s.size > sliceUint8.length) continue;

      const sampleBytes = sliceUint8.subarray(relOffset, relOffset + s.size);
      const timestampUs = Math.max(0, Math.round(relTimeSec * 1_000_000));
      const durationUs = Math.max(1, Math.round((s.duration / timescale) * 1_000_000));

      chunks.push({
        data: sampleBytes,
        timestamp: timestampUs,
        duration: durationUs,
        sampleNumber: s.number,
      });
    }

    if (chunks.length === 0) {
      console.warn('[extractAudioRangeSamples] Failed to slice sample chunks from buffer.');
      return null;
    }

    return {
      chunks,
      sampleRate,
      numberOfChannels,
      codec: 'aac',
      durationSeconds: (chunks[chunks.length - 1].timestamp + chunks[chunks.length - 1].duration) / 1_000_000,
    };
  } catch (err: any) {
    console.warn('[extractAudioRangeSamples] Range-based audio extraction error:', err?.message || err);
    return null;
  }
}

