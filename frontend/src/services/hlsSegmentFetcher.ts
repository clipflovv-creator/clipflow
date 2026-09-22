/**
 * hlsSegmentFetcher.ts
 *
 * Lightweight browser-side HLS manifest parser and selective segment fetcher.
 * Fetches ONLY the HLS .ts segments required for the user's selected [trimStart, trimEnd] range,
 * eliminating full-VOD downloads and keeping bandwidth strictly minimal.
 */

export interface HlsSegment {
  index: number;
  uri: string;
  resolvedUrl: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface ManifestParseResult {
  isMaster: boolean;
  mediaPlaylistUrl: string;
  initSegmentUrl?: string;
  segments: HlsSegment[];
  totalDuration: number;
  targetDuration: number;
}

export interface SegmentFetchResult {
  buffer: Uint8Array;
  relativeTrimStart: number;
  targetDuration: number;
  totalSegments: number;
  downloadedBytes: number;
  containerType: 'mp4' | 'ts';
}

export interface SegmentFetchProgress {
  phase: 'manifest' | 'segments';
  segmentsLoaded: number;
  segmentsTotal: number;
  percent: number;
  message: string;
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

/**
 * Resolves a relative or absolute URL against a base URL.
 */
function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).toString();
  } catch {
    return relativeOrAbsolute;
  }
}

/**
 * Parses an M3U8 manifest text. If it's a master playlist, selects the best variant URL.
 * If it's a media playlist, extracts all #EXTINF segment entries with cumulative timestamps.
 */
export async function parseHlsManifest(
  manifestUrl: string,
  quality?: string
): Promise<ManifestParseResult> {
  let targetManifestUrl = manifestUrl;
  if (
    (targetManifestUrl.includes('cloudfront.net') || targetManifestUrl.includes('ttvnw.net')) &&
    !targetManifestUrl.includes('/api/video/')
  ) {
    targetManifestUrl = `${BACKEND_URL}/api/video/hls-proxy?url=${encodeURIComponent(targetManifestUrl)}`;
  }
  const res = await fetch(targetManifestUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch HLS manifest (${res.status}): ${manifestUrl}`);
  }

  const text = await res.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isMaster = lines.some(l => l.startsWith('#EXT-X-STREAM-INF:'));

  if (isMaster) {
    // Select best variant URL matching requested quality
    let targetVariantUrl = '';
    const variants: { url: string; height: number; bandwidth: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const nextUrlLine = lines[i + 1];
        if (nextUrlLine && !nextUrlLine.startsWith('#')) {
          variants.push({
            url: resolveUrl(nextUrlLine, manifestUrl),
            height: resMatch ? parseInt(resMatch[1], 10) : 0,
            bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
          });
        }
      }
    }

    variants.sort((a, b) => b.bandwidth - a.bandwidth);

    if (quality && quality !== 'best' && quality !== 'source') {
      const targetHeight = parseInt(quality.replace(/[^\d]/g, ''), 10);
      if (!isNaN(targetHeight)) {
        const match = variants.find(v => v.height <= targetHeight);
        if (match) targetVariantUrl = match.url;
      }
    }

    if (!targetVariantUrl && variants.length > 0) {
      targetVariantUrl = variants[0].url;
    }

    if (!targetVariantUrl) {
      throw new Error('Could not resolve variant media playlist from master playlist');
    }

    // Recursively parse the selected media playlist
    return await parseHlsManifest(targetVariantUrl, quality);
  }

  // Parse media playlist segments & initialization map (fMP4 / CMAF)
  const segments: HlsSegment[] = [];
  let initSegmentUrl: string | undefined;
  let currentTime = 0;
  let targetDuration = 4;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      const td = parseFloat(line.split(':')[1]);
      if (!isNaN(td)) targetDuration = td;
    }

    // Detect initialization segment in fragmented MP4 HLS manifests
    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = line.match(/URI="([^"]+)"/i) || line.match(/URI=([^,\s]+)/i);
      if (uriMatch && uriMatch[1]) {
        initSegmentUrl = resolveUrl(uriMatch[1], manifestUrl);
      }
    }

    if (line.startsWith('#EXTINF:')) {
      const durMatch = line.match(/#EXTINF:([\d.]+)/);
      const duration = durMatch ? parseFloat(durMatch[1]) : targetDuration;

      // The next non-tag line is the segment URI
      let nextUriLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith('#')) {
          nextUriLine = lines[j];
          i = j;
          break;
        }
      }

      if (nextUriLine) {
        const resolvedUrl = resolveUrl(nextUriLine, manifestUrl);
        const startTime = currentTime;
        const endTime = currentTime + duration;
        currentTime = endTime;

        segments.push({
          index: segments.length,
          uri: nextUriLine,
          resolvedUrl,
          duration,
          startTime,
          endTime,
        });
      }
    }
  }

  return {
    isMaster: false,
    mediaPlaylistUrl: manifestUrl,
    initSegmentUrl,
    segments,
    totalDuration: currentTime,
    targetDuration,
  };
}

/**
 * Fetches ONLY the required HLS segments for the given [trimStart, trimEnd] time range.
 * Includes 1 safety segment before the start boundary for I-frame keyframe precision.
 */
export async function fetchRequiredHlsSegments(
  manifestUrl: string,
  trimStart: number,
  trimEnd: number,
  quality?: string,
  onProgress?: (progress: SegmentFetchProgress) => void
): Promise<SegmentFetchResult> {
  if (onProgress) {
    onProgress({
      phase: 'manifest',
      segmentsLoaded: 0,
      segmentsTotal: 0,
      percent: 5,
      message: 'Analyzing video stream timeline...',
    });
  }

  const { segments, totalDuration, initSegmentUrl, mediaPlaylistUrl } = await parseHlsManifest(manifestUrl, quality);

  if (segments.length === 0) {
    throw new Error('No video segments found in HLS stream manifest');
  }

  const safeTrimStart = Math.max(0, trimStart);
  const safeTrimEnd = trimEnd > safeTrimStart ? Math.min(totalDuration || trimEnd, trimEnd) : safeTrimStart + 60;
  const targetDuration = safeTrimEnd - safeTrimStart;

  // Find all segments overlapping [safeTrimStart, safeTrimEnd]
  let startIndex = segments.findIndex(s => s.endTime > safeTrimStart);
  if (startIndex === -1) startIndex = 0;

  let endIndex = segments.findIndex(s => s.startTime >= safeTrimEnd);
  if (endIndex === -1) endIndex = segments.length - 1;

  // Add 1 safety segment before startIndex to ensure keyframe (I-frame) header is present
  if (startIndex > 0) {
    startIndex = startIndex - 1;
  }
  // Add 1 safety segment after endIndex if available
  if (endIndex < segments.length - 1) {
    endIndex = endIndex + 1;
  }

  const requiredSegments = segments.slice(startIndex, endIndex + 1);
  const totalSegments = requiredSegments.length;

  if (totalSegments === 0) {
    throw new Error(`No matching HLS segments found for range ${safeTrimStart}s - ${safeTrimEnd}s`);
  }

  const sliceStartTime = requiredSegments[0].startTime;
  const relativeTrimStart = Math.max(0, safeTrimStart - sliceStartTime);

  console.log('%c[HLS Segment Fetcher 📦]', 'color: #38bdf8; font-weight: bold;', {
    requestedTrim: `${safeTrimStart.toFixed(2)}s -> ${safeTrimEnd.toFixed(2)}s (${targetDuration.toFixed(2)}s)`,
    totalManifestSegments: segments.length,
    selectedSegments: `${requiredSegments.length} segments (${requiredSegments[0].index} -> ${requiredSegments[requiredSegments.length - 1].index})`,
    initSegmentUrl: initSegmentUrl || 'None',
    sliceStartTime: `${sliceStartTime.toFixed(2)}s`,
    relativeTrimStart: `${relativeTrimStart.toFixed(2)}s`,
  });

  // Step 1: Fetch initialization segment if present (fMP4 / CMAF)
  let initBuffer: ArrayBuffer | null = null;
  let resolvedInitUrl = initSegmentUrl;

  // Fallback: If no #EXT-X-MAP was in the manifest but segments are .mp4/.m4s, try standard init.mp4
  if (!resolvedInitUrl && (requiredSegments[0].uri.includes('.mp4') || requiredSegments[0].uri.includes('.m4s'))) {
    resolvedInitUrl = resolveUrl('index-init.mp4', mediaPlaylistUrl);
  }

  if (resolvedInitUrl) {
    try {
      let fetchUrl = resolvedInitUrl;
      if (
        (fetchUrl.includes('cloudfront.net') || fetchUrl.includes('ttvnw.net')) &&
        !fetchUrl.includes('/api/video/')
      ) {
        fetchUrl = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(fetchUrl)}`;
      }
      const initRes = await fetch(fetchUrl);
      if (initRes.ok) {
        initBuffer = await initRes.arrayBuffer();
        console.log(`[HLS Segment Fetcher 📦] Downloaded fMP4 init header (${initBuffer.byteLength} bytes)`);
      }
    } catch (initErr) {
      console.warn('[HLS Segment Fetcher ⚠️] Optional init header fetch failed, proceeding with segments:', initErr);
    }
  }

  // Concurrent fetcher with controlled concurrency (e.g. 4 streams)
  const CONCURRENCY = 4;
  const segmentBuffers: ArrayBuffer[] = new Array(totalSegments);
  let loadedCount = 0;
  let totalBytes = initBuffer ? initBuffer.byteLength : 0;

  const fetchSegment = async (item: HlsSegment, sliceIndex: number) => {
    let fetchUrl = item.resolvedUrl;
    if (
      (fetchUrl.includes('cloudfront.net') || fetchUrl.includes('ttvnw.net')) &&
      !fetchUrl.includes('/api/video/')
    ) {
      fetchUrl = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(fetchUrl)}`;
    }
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to download video segment ${item.index} (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    segmentBuffers[sliceIndex] = buf;
    loadedCount++;
    totalBytes += buf.byteLength;

    if (onProgress) {
      const percent = Math.min(45, Math.round(5 + (loadedCount / totalSegments) * 40));
      const mbLoaded = (totalBytes / (1024 * 1024)).toFixed(1);
      onProgress({
        phase: 'segments',
        segmentsLoaded: loadedCount,
        segmentsTotal: totalSegments,
        percent,
        message: `Downloading required video media (${loadedCount}/${totalSegments} segments, ${mbLoaded} MB)...`,
      });
    }
  };

  // Queue runner
  const queue = requiredSegments.map((seg, idx) => ({ seg, idx }));
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) {
        await fetchSegment(next.seg, next.idx);
      }
    }
  });

  await Promise.all(workers);

  // Concatenate initialization segment + all media segments into a single contiguous Uint8Array
  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  if (initBuffer) {
    combined.set(new Uint8Array(initBuffer), offset);
    offset += initBuffer.byteLength;
  }

  for (const buf of segmentBuffers) {
    if (buf) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
  }

  // Detect container type from first bytes (fMP4 box vs MPEG-TS sync byte 0x47)
  const isMp4 = initBuffer !== null ||
    (combined.length >= 8 &&
      (
        (combined[4] === 0x66 && combined[5] === 0x74 && combined[6] === 0x79 && combined[7] === 0x70) || // ftyp
        (combined[4] === 0x6d && combined[5] === 0x6f && combined[6] === 0x6f && combined[7] === 0x76) || // moov
        (combined[4] === 0x6d && combined[5] === 0x6f && combined[6] === 0x6f && combined[7] === 0x66) || // moof
        (combined[4] === 0x73 && combined[5] === 0x74 && combined[6] === 0x79 && combined[7] === 0x70)    // styp
      ));

  const containerType: 'mp4' | 'ts' = isMp4 ? 'mp4' : 'ts';

  console.log(`[HLS Segment Fetcher ✅] Assembled ${totalSegments} segments (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total, container: ${containerType})`);

  return {
    buffer: combined,
    relativeTrimStart,
    targetDuration,
    totalSegments,
    downloadedBytes: totalBytes,
    containerType,
  };
}
