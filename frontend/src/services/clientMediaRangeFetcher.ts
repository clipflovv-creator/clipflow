/**
 * Client-Side Media Range Fetcher
 * 
 * Performs HTTP Range queries directly from the user's browser via an Edge Relay
 * (Cloudflare Worker or dev proxy) to stream only the needed byte chunks.
 */

import * as MP4Box from 'mp4box';
import { api } from './api';

// Edge Relay URL (if deployed on Cloudflare Workers, set VITE_EDGE_RELAY_URL in frontend/.env)
// Example: https://yt-range-relay.yourname.workers.dev
const EDGE_RELAY_URL = (import.meta.env.VITE_EDGE_RELAY_URL as string) || 'https://yt-range-relay.clipflovv.workers.dev';

/**
 * Unwraps any nested proxy prefixes (e.g. localhost or Render proxy-stream endpoints)
 * to return the true direct upstream media URL (e.g. Googlevideo).
 */
export function unwrapStreamUrl(directUrl: string): string {
  if (!directUrl) return '';
  let url = directUrl.trim();
  if (url.includes('/api/video/proxy-stream?url=') || url.includes('/api/video/stream-range?url=')) {
    const parts = url.split(/\/(?:proxy-stream|stream-range)\?url=/);
    if (parts[1]) {
      try {
        url = decodeURIComponent(parts[1]);
      } catch {}
    }
  }
  return url;
}

let edgeRelayDisabled = false;

export function disableEdgeRelay(): void {
  edgeRelayDisabled = true;
}

export function isEdgeRelayDisabled(): boolean {
  return edgeRelayDisabled;
}

/**
 * Wraps a direct media stream URL (e.g. Googlevideo) with CORS proxy / Edge Relay.
 */
export function resolveRelayUrl(directUrl: string): string {
  if (!directUrl) return '';

  const cleanUrl = unwrapStreamUrl(directUrl);

  // If already relative or hosted on same domain or blob
  if (cleanUrl.startsWith('/') || cleanUrl.startsWith('blob:')) {
    return cleanUrl;
  }

  // If URL points to localhost or private network, or relay was disabled due to failure:
  const isLocalHost = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');
  if (isLocalHost || edgeRelayDisabled) {
    return api.video.getProxyStreamUrl(cleanUrl);
  }

  // 1. Cloudflare Worker Edge Relay (Zero Render Load & Unlimited Bandwidth)
  if (EDGE_RELAY_URL) {
    const base = EDGE_RELAY_URL.endsWith('/') ? EDGE_RELAY_URL : `${EDGE_RELAY_URL}/`;
    return `${base}?url=${encodeURIComponent(cleanUrl)}`;
  }

  // 2. Dev / Fallback: Backend streaming range proxy (Pipes directly without disk storage)
  return api.video.getProxyStreamUrl(cleanUrl);
}

/**
 * Fetches an exact byte range from a stream URL with automatic fallback.
 */
export async function fetchByteRange(
  url: string,
  startByte: number,
  endByte?: number,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<ArrayBuffer> {
  const cleanUrl = unwrapStreamUrl(url);
  const proxiedUrl = resolveRelayUrl(cleanUrl);
  const rangeHeader = typeof endByte === 'number' && endByte >= startByte
    ? `bytes=${startByte}-${endByte}`
    : `bytes=${startByte}-`;

  let response: Response;
  try {
    response = await fetch(proxiedUrl, {
      headers: {
        Range: rangeHeader,
      },
    });

    // If Cloudflare Edge Relay returned an error (e.g. 403, 500, 502), transparently disable and fall back
    if (!response.ok && response.status !== 206 && proxiedUrl.includes('workers.dev')) {
      console.warn(`[MediaRangeFetcher] Edge relay returned status ${response.status}. Disabling relay & falling back to backend proxy...`);
      edgeRelayDisabled = true;
      const fallbackUrl = api.video.getProxyStreamUrl(cleanUrl);
      response = await fetch(fallbackUrl, {
        headers: { Range: rangeHeader },
      });
    }
  } catch (netErr) {
    // Network failure on relay: disable and fallback to backend proxy
    if (proxiedUrl.includes('workers.dev')) {
      console.warn('[MediaRangeFetcher] Edge relay network error, disabling relay & falling back to backend proxy:', netErr);
      edgeRelayDisabled = true;
      const fallbackUrl = api.video.getProxyStreamUrl(cleanUrl);
      response = await fetch(fallbackUrl, {
        headers: { Range: rangeHeader },
      });
    } else {
      throw netErr;
    }
  }

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
  requestedQuality?: string;
  actualQuality?: string;
  qualityNote?: string;
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
  const protocol = (f.protocol || '').toLowerCase();
  if (protocol.includes('m3u8') || protocol.includes('hls')) {
    return false;
  }
  return true;
}

/**
 * Computes a preference score for an audio format.
 * Prioritizes original/default language audio, penalizes dubs,
 * prefers standard AAC/M4A, and uses bitrate strictly as a tiebreaker.
 */
export function getAudioTrackScore(f: any, defaultLang?: string): number {
  if (!f) return -9999;
  let score = 0;
  const note = (f.format_note || '').toLowerCase();
  const lang = (f.language || '').toLowerCase();
  const pref = typeof f.language_preference === 'number' ? f.language_preference : 0;

  // 1. Original / Default flags from yt-dlp
  if (note.includes('original')) score += 1000;
  if (note.includes('default') || f.is_default) score += 500;
  if (pref >= 10) score += 800;

  // 2. Penalty for dubbed tracks
  if (note.includes('dubbed') || note.includes('dub')) score -= 1500;
  if (pref < 0) score -= 500;

  // 3. Language match if defaultLang is available
  if (defaultLang && lang) {
    const cleanDef = defaultLang.toLowerCase();
    if (lang === cleanDef || lang.split('-')[0] === cleanDef.split('-')[0]) {
      score += 400;
    }
  }

  // 4. Prefer standard AAC/M4A for zero-glitch browser & player compatibility
  const isAacM4a = f.ext === 'm4a' || (f.acodec && (f.acodec.startsWith('mp4a') || f.acodec.includes('aac')));
  if (isAacM4a) score += 100;

  // 5. Bitrate tiebreaker (scaled so minor kbps differences never override original audio)
  score += Math.min(50, (f.abr || f.tbr || 0) / 10);

  return score;
}

/**
 * Finds the optimal video and audio stream formats for a requested target resolution.
 * Prioritizes standard universal MP4 (H.264 / AVC1) and M4A (AAC) formats.
 */
export function findBestTracks(metadata: any, targetQuality: string = '1080p'): StreamTrackSelection {
  if (!metadata) {
    return { videoFormat: null, audioFormat: null, combinedFormat: null };
  }

  const formats: any[] = (metadata.formats && metadata.formats.length > 0)
    ? metadata.formats
    : (metadata.video_formats || []);
  const cleanQ = targetQuality.toLowerCase().replace('p', '');
  const isOriginal = cleanQ === 'original' || cleanQ === 'source' || cleanQ === 'best' || cleanQ === 'max';
  const targetHeight = isOriginal ? 99999 : (parseInt(cleanQ, 10) || 1080);

  const getFormatHeight = (f: any): number => {
    if (typeof f?.height === 'number' && f.height > 0) return f.height;
    if (typeof f?.width === 'number' && f.width > 0 && typeof f?.height === 'number' && f.height > 0) {
      return Math.min(f.width, f.height);
    }
    if (f?.resolution) {
      const m = f.resolution.match(/(\d+)x(\d+)/);
      if (m) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        return (w > 0 && h > 0) ? Math.min(w, h) : (h || w);
      }
    }
    if (typeof f?.format_note === 'string') {
      const m = f.format_note.match(/(\d+)p/i);
      if (m) return parseInt(m[1], 10);
    }
    return 0;
  };

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

  // Check if format is H.264 (preferred for broadest compatibility)
  const getFormatTier = (f: any): number => {
    const h = getFormatHeight(f);
    const w = typeof f?.width === 'number' ? f.width : 0;
    // Map by width and height to accurately classify widescreen / cinema letterbox formats:
    // e.g. 3840x2026 is 2160p (4K UHD)
    // e.g. 2560x1350 is 1440p (QHD / 2K)
    // e.g. 1920x1012 is 1080p (FHD)
    // e.g. 1280x676 is 720p (HD)
    // e.g. 854x450 is 480p (SD)
    // e.g. 640x338 is 360p
    if (w >= 3600 || h >= 1900) return 2160;
    if (w >= 2400 || h >= 1300) return 1440;
    if (w >= 1800 || h >= 950) return 1080;
    if (w >= 1200 || h >= 650) return 720;
    if (w >= 800 || h >= 430) return 480;
    if (w >= 600 || h >= 320) return 360;
    if (w >= 400 || h >= 220) return 240;
    if (w >= 240 || h >= 130) return 144;
    return h;
  };

  // Check if format is H.264 (preferred for broadest compatibility)
  const isAvcMp4 = (f: any) => {
    if (!f || !f.vcodec || f.vcodec === 'none') return false;
    const vc = f.vcodec.toLowerCase();
    return vc.startsWith('avc') || vc.startsWith('h264') || (f.ext === 'mp4' && !vc.startsWith('vp') && !vc.startsWith('av01'));
  };

  const rankFormats = (list: any[]) => {
    return [...list].sort((a, b) => {
      // 1. Prefer MP4 container
      const aMp4 = a.ext === 'mp4' ? 1 : 0;
      const bMp4 = b.ext === 'mp4' ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;

      // 2. Prefer H.264 if available at this tier, then VP9 (vp09), then AV1 (av01)
      const codecScore = (f: any) => {
        if (isAvcMp4(f)) return 3;
        if (f.vcodec?.toLowerCase().startsWith('vp')) return 2;
        if (f.vcodec?.toLowerCase().startsWith('av01')) return 1;
        return 0;
      };
      const cDiff = codecScore(b) - codecScore(a);
      if (cDiff !== 0) return cDiff;

      // 3. Higher bitrate
      return (b.tbr || b.vbr || 0) - (a.tbr || a.vbr || 0);
    });
  };

  let bestVideo: any = null;

  if (isOriginal) {
    const allSorted = [...videoOnly, ...combined].sort((a, b) => getFormatTier(b) - getFormatTier(a));
    const highestTier = allSorted.length > 0 ? getFormatTier(allSorted[0]) : 0;
    const atHighest = allSorted.filter((f) => getFormatTier(f) === highestTier);
    bestVideo = rankFormats(atHighest)[0] || null;
  } else {
    // 1st priority: Exact tier match in videoOnly formats (supports 4K 2160p, 1440p, 1080p, etc.)
    const atTargetTier = videoOnly.filter((f) => getFormatTier(f) === targetHeight);
    if (atTargetTier.length > 0) {
      bestVideo = rankFormats(atTargetTier)[0];
    } else {
      // Check combined formats at exact requested tier
      const combinedAtTier = combined.filter((f) => getFormatTier(f) === targetHeight);
      if (combinedAtTier.length > 0) {
        bestVideo = rankFormats(combinedAtTier)[0];
      }
    }

    // 2nd priority: Highest available tier <= targetHeight
    if (!bestVideo) {
      const allSorted = [...videoOnly, ...combined].sort((a, b) => getFormatTier(b) - getFormatTier(a));
      const candidates = allSorted.filter((f) => getFormatTier(f) <= targetHeight);
      if (candidates.length > 0) {
        const highestAvailTier = getFormatTier(candidates[0]);
        const atAvail = candidates.filter((f) => getFormatTier(f) === highestAvailTier);
        bestVideo = rankFormats(atAvail)[0];
      } else if (allSorted.length > 0) {
        bestVideo = rankFormats(allSorted)[0];
      }
    }
  }

  // Find best matching audio stream (strongly prioritize original/default audio over dubs & prefer M4A / AAC)
  const defaultLang = metadata?.audio_language || metadata?.language;
  const sortAudio = (list: any[]) =>
    [...list].sort((a, b) => getAudioTrackScore(b, defaultLang) - getAudioTrackScore(a, defaultLang));

  let bestAudio = sortAudio(audioOnly)[0] || null;

  // Robust fallback: Check metadata.audio_formats or any direct format with acodec
  if (!bestAudio) {
    const directAudioFormats = (metadata.audio_formats || []).filter(isDirectStream);
    bestAudio = sortAudio(directAudioFormats)[0] || null;
  }
  if (!bestAudio) {
    const anyAudio = directFormats.filter((f) => f.url && f.acodec && f.acodec !== 'none');
    bestAudio = sortAudio(anyAudio)[0] || null;
  }

  // Best combined format fallback
  const sortedCombined = [...combined].sort((a, b) => getFormatTier(b) - getFormatTier(a));
  const bestCombined = sortedCombined.find((f) => getFormatTier(f) === targetHeight && isAvcMp4(f)) ||
                       sortedCombined.find((f) => getFormatTier(f) === targetHeight) ||
                       sortedCombined.find((f) => getFormatTier(f) <= targetHeight) ||
                       sortedCombined[0] || null;

  const actualTier = bestVideo
    ? getFormatTier(bestVideo)
    : (bestCombined ? getFormatTier(bestCombined) : 0);
  const actualHeight = bestVideo
    ? getFormatHeight(bestVideo)
    : (bestCombined ? getFormatHeight(bestCombined) : 0);
  const actualQuality = actualTier > 0 ? `${actualTier}p` : (actualHeight > 0 ? `${actualHeight}p` : targetQuality);

  let qualityNote: string | undefined = undefined;
  if (!isOriginal && targetHeight < 90000 && actualTier > 0) {
    if (targetHeight > actualTier) {
      qualityNote = `${targetQuality} is not available on this video source — using highest available native ${actualQuality} stream directly from CDN.`;
    }
  }

  return {
    videoFormat: bestVideo,
    audioFormat: bestAudio,
    combinedFormat: bestCombined,
    requestedQuality: targetQuality,
    actualQuality,
    qualityNote,
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
    if (onProgress) onProgress('Preparing audio...', 10);

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

    if (onProgress) {
      onProgress('Downloading audio...', 20);
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

export interface SidxSegment {
  index: number;
  startByte: number;
  endByte: number;
  size: number;
  startTime: number;
  endTime: number;
  duration: number;
  startsWithSAP: number;
}

export interface ParsedSidxResult {
  initHeaderLength: number;
  sidxBoxSize: number;
  timescale: number;
  segments: SidxSegment[];
}

/**
 * Parses the ISO Base Media File Format Segment Index (`sidx`) box in pure JS.
 * Used by YouTube DASH to index self-contained subsegment byte ranges and timestamps.
 */
export function parseSidxBox(buffer: Uint8Array): ParsedSidxResult | null {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let sidxOffset = -1;
  for (let i = 4; i < buffer.length - 4; i++) {
    if (
      buffer[i] === 0x73 && // 's'
      buffer[i + 1] === 0x69 && // 'i'
      buffer[i + 2] === 0x64 && // 'd'
      buffer[i + 3] === 0x78    // 'x'
    ) {
      sidxOffset = i;
      break;
    }
  }

  if (sidxOffset === -1) return null;

  const sidxBoxStart = sidxOffset - 4;
  if (sidxBoxStart < 0 || sidxBoxStart + 12 > buffer.length) return null;
  const sidxSize = dataView.getUint32(sidxBoxStart, false);
  if (sidxSize <= 0) return null;

  const version = dataView.getUint8(sidxBoxStart + 8);
  let readPos = sidxBoxStart + 12;

  readPos += 4; // referenceId
  const timescale = dataView.getUint32(readPos, false);
  readPos += 4;
  if (!timescale || timescale <= 0) return null;

  let earliestPresentationTime = 0;
  let firstOffset = 0;
  if (version === 0) {
    if (readPos + 8 > buffer.length) return null;
    earliestPresentationTime = dataView.getUint32(readPos, false);
    readPos += 4;
    firstOffset = dataView.getUint32(readPos, false);
    readPos += 4;
  } else {
    if (readPos + 16 > buffer.length) return null;
    const hiTime = dataView.getUint32(readPos, false);
    const loTime = dataView.getUint32(readPos + 4, false);
    earliestPresentationTime = hiTime * 4294967296 + loTime;
    readPos += 8;

    const hiOff = dataView.getUint32(readPos, false);
    const loOff = dataView.getUint32(readPos + 4, false);
    firstOffset = hiOff * 4294967296 + loOff;
    readPos += 8;
  }

  readPos += 2; // reserved
  if (readPos + 2 > buffer.length) return null;
  const referenceCount = dataView.getUint16(readPos, false);
  readPos += 2;
  if (referenceCount <= 0 || referenceCount > 20000) return null;

  const firstSegmentByte = sidxBoxStart + sidxSize + firstOffset;
  let currentByte = firstSegmentByte;
  let currentTime = earliestPresentationTime / timescale;

  const segments: SidxSegment[] = [];
  for (let i = 0; i < referenceCount; i++) {
    if (readPos + 12 > buffer.length) break;

    const firstWord = dataView.getUint32(readPos, false);
    readPos += 4;
    const subsegmentDuration = dataView.getUint32(readPos, false);
    readPos += 4;
    const thirdWord = dataView.getUint32(readPos, false);
    readPos += 4;

    const referenceSize = firstWord & 0x7fffffff;
    const startsWithSAP = (thirdWord >> 31) & 1;
    const durationSec = subsegmentDuration / timescale;

    segments.push({
      index: i,
      startByte: currentByte,
      endByte: currentByte + referenceSize - 1,
      size: referenceSize,
      startTime: currentTime,
      endTime: currentTime + durationSec,
      duration: durationSec,
      startsWithSAP,
    });

    currentByte += referenceSize;
    currentTime += durationSec;
  }

  return {
    initHeaderLength: sidxBoxStart,
    sidxBoxSize: sidxSize,
    timescale,
    segments,
  };
}

export interface SmartSliceResult {
  data: Uint8Array;
  relativeStart: number;
  sliceStartTime: number;
  sliceEndTime: number;
  isSidxIndexed: boolean;
}

/**
 * Downloads ONLY the required media segments for a target [trimStart, trimEnd] time range
 * using the YouTube DASH sidx index.
 * 
 * Prepends the track initialization header (ftyp + moov) to the selected segments,
 * producing a valid, lightweight fragmented MP4 slice that starts on a clean IDR keyframe.
 * 
 * Reduces network download from hundreds of megabytes down to just ~3MB to 8MB.
 */
export async function fetchSidxSlice(
  streamUrl: string,
  trimStart: number,
  trimEnd: number,
  onProgress?: (percent: number) => void
): Promise<SmartSliceResult | null> {
  try {
    // 1. Fetch initial 16 KB header to check for sidx
    let headerBytes = new Uint8Array(await fetchByteRange(streamUrl, 0, 16383));

    // Dynamic header inspection: check if sidx box needs a larger range (up to 128 KB for 1-3 hr videos)
    let sidxBoxStart = -1;
    let sidxSize = 0;
    const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
    for (let i = 0; i <= headerBytes.length - 8; i++) {
      if (
        headerBytes[i + 4] === 0x73 &&
        headerBytes[i + 5] === 0x69 &&
        headerBytes[i + 6] === 0x64 &&
        headerBytes[i + 7] === 0x78
      ) {
        sidxBoxStart = i;
        sidxSize = view.getUint32(i, false);
        break;
      }
    }

    if (sidxBoxStart >= 0 && sidxSize > 0 && (sidxBoxStart + sidxSize) > headerBytes.length) {
      const fullHeaderSize = Math.min(131072, sidxBoxStart + sidxSize + 32);
      headerBytes = new Uint8Array(await fetchByteRange(streamUrl, 0, fullHeaderSize - 1));
    }

    const parsed = parseSidxBox(headerBytes);
    if (!parsed || parsed.segments.length === 0) {
      return null;
    }

    // 2. Find matching segments covering [trimStart, trimEnd]
    const matching = parsed.segments.filter(
      (s) => s.endTime > trimStart && s.startTime < trimEnd
    );

    if (matching.length === 0) {
      return null;
    }

    const startSegment = matching[0];
    const endSegment = matching[matching.length - 1];

    const rangeStart = startSegment.startByte;
    const rangeEnd = endSegment.endByte;
    const totalRangeBytes = rangeEnd - rangeStart + 1;

    // 3. Download the exact target segment bytes in <=1MB chunks
    const CHUNK_SIZE = 1048576;
    const totalChunks = Math.max(1, Math.ceil(totalRangeBytes / CHUNK_SIZE));
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = rangeStart + i * CHUNK_SIZE;
      const chunkEnd = Math.min(rangeEnd, rangeStart + (i + 1) * CHUNK_SIZE - 1);
      const sliceBuf = await fetchByteRange(streamUrl, chunkStart, chunkEnd);
      const chunk = new Uint8Array(sliceBuf);
      if (chunk.length > 0) {
        chunks.push(chunk);
        receivedBytes += chunk.length;
        if (onProgress) {
          onProgress(Math.min(99, Math.round((receivedBytes / totalRangeBytes) * 100)));
        }
      }
    }

    // 4. Assemble: [ftyp + moov] + [target segments media data]
    const initHeader = headerBytes.subarray(0, parsed.initHeaderLength);
    const combined = new Uint8Array(initHeader.length + receivedBytes);
    combined.set(initHeader, 0);

    let offset = initHeader.length;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.length;
    }

    if (onProgress) onProgress(100);

    const relativeStart = Math.max(0, trimStart - startSegment.startTime);
    return {
      data: combined,
      relativeStart,
      sliceStartTime: startSegment.startTime,
      sliceEndTime: endSegment.endTime,
      isSidxIndexed: true,
    };
  } catch (e) {
    console.warn('[fetchSidxSlice] Sidx ranged extraction fallback:', e);
    return null;
  }
}


