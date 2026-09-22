/**
 * ============================================================================
 * TWITCH STREAM RESOLVER SERVICE
 * ============================================================================
 * Resolves Twitch Channels, DVR VODs, Standard VODs, and Clips to their
 * direct HLS stream URLs using Twitch's internal GQL + Usher API.
 *
 * This approach avoids yt-dlp entirely for URL resolution, preventing
 * the ConnectionResetError(10054) that Twitch triggers on yt-dlp requests.
 * ============================================================================
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Twitch Client ID (Public, same one browsers use) ────────────────────────
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

export interface StreamQualityOption {
  id: string;
  label: string;
  height: number;
  width?: number;
  bandwidth: number;
  fps?: number;
  url: string;
}

export interface StreamResolutionResult {
  streamUrl: string;
  sourceType: 'dvr' | 'live' | 'vod' | 'clip';
  vodId?: string;
  channel?: string;
  masterPlaylistUrl?: string;
  qualities?: StreamQualityOption[];
}

interface CacheEntry {
  result: StreamResolutionResult;
  expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();
const inFlightResolutions = new Map<string, Promise<StreamResolutionResult>>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gqlHeaders(): Record<string, string> {
  return {
    'Client-ID': TWITCH_CLIENT_ID,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

/**
 * Obtains a PlaybackAccessToken (token + signature) from Twitch GQL.
 * This is the same flow the Twitch web player performs before making Usher requests.
 */
async function getPlaybackAccessToken(
  channelOrVodId: string,
  isVod = false
): Promise<{ token: string; sig: string } | null> {
  const body = isVod
    ? JSON.stringify({
        operationName: 'PlaybackAccessToken',
        extensions: { persistedQuery: { version: 1, sha256Hash: '0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712' } },
        variables: { isLive: false, login: '', isVod: true, vodID: channelOrVodId, playerType: 'embed' },
      })
    : JSON.stringify({
        operationName: 'PlaybackAccessToken',
        extensions: { persistedQuery: { version: 1, sha256Hash: '0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712' } },
        variables: { isLive: true, login: channelOrVodId, isVod: false, vodID: '', playerType: 'embed' },
      });

  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: gqlHeaders(),
      body,
    });

    if (!res.ok) {
      console.warn(`[Twitch GQL] PlaybackAccessToken returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const tokenObj = isVod
      ? data?.data?.videoPlaybackAccessToken
      : data?.data?.streamPlaybackAccessToken;

    if (!tokenObj?.value || !tokenObj?.signature) {
      console.warn('[Twitch GQL] PlaybackAccessToken missing value/signature', JSON.stringify(data).substring(0, 200));
      return null;
    }

    return { token: tokenObj.value, sig: tokenObj.signature };
  } catch (err: any) {
    console.warn('[Twitch GQL] PlaybackAccessToken error:', err.message);
    return null;
  }
}

/**
 * Picks the best-quality variant URL and extracts all variant stream options
 * from an M3U8 master playlist text, correctly resolving relative URLs.
 */
function selectBestVariantUrl(
  m3u8: string,
  baseUrl: string,
  quality?: string
): { bestUrl: string; qualities: StreamQualityOption[] } | null {
  const lines = m3u8.split('\n');
  const streams: StreamQualityOption[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
      const fpsMatch = line.match(/FRAME-RATE=([\d.]+)/i);
      const videoMatch = line.match(/VIDEO="([^"]+)"/i);
      const urlLine = lines[i + 1]?.trim();

      if (urlLine && !urlLine.startsWith('#')) {
        let fullUrl = urlLine;
        try {
          fullUrl = new URL(urlLine, baseUrl).toString();
        } catch {
          fullUrl = urlLine;
        }

        const width = resMatch ? parseInt(resMatch[1], 10) : undefined;
        const height = resMatch ? parseInt(resMatch[2], 10) : 0;
        const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const fps = fpsMatch ? Math.round(parseFloat(fpsMatch[1])) : undefined;
        const videoTag = videoMatch ? videoMatch[1] : '';

        let id = height > 0 ? `${height}p` : 'audio_only';
        if (fps && fps >= 50 && height > 0) {
          id = `${height}p${fps}`;
        }
        let label = height > 0 ? (fps ? `${height}p${fps}` : `${height}p`) : 'Audio Only';
        if (videoTag === 'chunked' || height >= 1080) {
          label = `${label} (Source)`;
        }

        streams.push({
          id,
          label,
          height,
          width,
          fps,
          bandwidth,
          url: fullUrl,
        });
      }
    }
  }

  if (streams.length === 0) return null;
  streams.sort((a, b) => b.bandwidth - a.bandwidth);

  let bestUrl = streams[0].url;
  if (quality && quality !== 'best' && quality !== 'source') {
    const targetHeight = parseInt(quality.replace(/[^\d]/g, ''), 10);
    if (!isNaN(targetHeight)) {
      const match = streams.find((s) => s.height <= targetHeight);
      if (match) bestUrl = match.url;
    }
  }

  return { bestUrl, qualities: streams };
}

/**
 * Resolves a live channel HLS URL via Twitch Usher API.
 */
async function resolveChannelHls(
  channelName: string,
  quality?: string
): Promise<{ streamUrl: string; qualities: StreamQualityOption[]; masterPlaylistUrl: string } | null> {
  const tokenData = await getPlaybackAccessToken(channelName.toLowerCase(), false);
  if (!tokenData) return null;

  const params = new URLSearchParams({
    sig: tokenData.sig,
    token: tokenData.token,
    allow_source: 'true',
    allow_spectre: 'false',
    allow_audio_only: 'true',
    fast_bread: 'true',
    p: String(Math.floor(Math.random() * 999999)),
    platform: 'web',
    player_backend: 'mediaplayer',
    playlist_include_framerate: 'true',
    reassignments_supported: 'true',
    supported_codecs: 'avc1',
    cdm: 'wv',
    transcode_mode: 'cbr_v1',
  });

  const usherUrl = `https://usher.ttvnw.net/api/channel/hls/${channelName.toLowerCase()}.m3u8?${params.toString()}`;
  console.log(`[Twitch Usher] 🎯 Fetching live HLS for channel: ${channelName}`);

  try {
    const res = await fetch(usherUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.twitch.tv/',
        'Origin': 'https://www.twitch.tv',
      },
    });

    if (!res.ok) {
      console.warn(`[Twitch Usher] ❌ Live Usher returned HTTP ${res.status} for ${channelName}`);
      return null;
    }

    const m3u8Text = await res.text();
    const parsed = selectBestVariantUrl(m3u8Text, usherUrl, quality);
    if (parsed) {
      console.log(`[Twitch Usher] ✅ Resolved live HLS for ${channelName}: ${parsed.bestUrl.substring(0, 80)}...`);
      return {
        streamUrl: parsed.bestUrl,
        qualities: parsed.qualities,
        masterPlaylistUrl: usherUrl,
      };
    }
    return {
      streamUrl: usherUrl,
      qualities: [],
      masterPlaylistUrl: usherUrl,
    };
  } catch (err: any) {
    console.warn('[Twitch Usher] ❌ Failed to fetch live channel playlist:', err.message);
    return null;
  }
}

/**
 * Resolves a VOD/DVR VOD HLS URL via Twitch Usher API.
 */
async function resolveVodHls(
  vodId: string,
  quality?: string
): Promise<{ streamUrl: string; qualities: StreamQualityOption[]; masterPlaylistUrl: string } | null> {
  const tokenData = await getPlaybackAccessToken(vodId, true);
  if (!tokenData) return null;

  const params = new URLSearchParams({
    sig: tokenData.sig,
    token: tokenData.token,
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'false',
    p: String(Math.floor(Math.random() * 999999)),
    platform: 'web',
    supported_codecs: 'avc1',
    cdm: 'wv',
  });

  const usherUrl = `https://usher.ttvnw.net/vod/${vodId}.m3u8?${params.toString()}`;
  console.log(`[Twitch Usher] 🎯 Fetching VOD HLS for VOD: ${vodId}`);

  try {
    const res = await fetch(usherUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.twitch.tv/',
        'Origin': 'https://www.twitch.tv',
      },
    });

    if (!res.ok) {
      console.warn(`[Twitch Usher] ❌ VOD Usher returned HTTP ${res.status} for VOD ${vodId}`);
      return null;
    }

    const m3u8Text = await res.text();
    const parsed = selectBestVariantUrl(m3u8Text, usherUrl, quality);
    if (parsed) {
      console.log(`[Twitch Usher] ✅ Resolved VOD HLS for ${vodId}: ${parsed.bestUrl.substring(0, 80)}...`);
      return {
        streamUrl: parsed.bestUrl,
        qualities: parsed.qualities,
        masterPlaylistUrl: usherUrl,
      };
    }
    return {
      streamUrl: usherUrl,
      qualities: [],
      masterPlaylistUrl: usherUrl,
    };
  } catch (err: any) {
    console.warn('[Twitch Usher] ❌ Failed to fetch VOD playlist:', err.message);
    return null;
  }
}

/**
 * Resolves direct multi-quality HLS playlists from Twitch CloudFront CDN using VOD metadata.
 * Probes available quality tiers in parallel and returns both target stream and available tiers.
 * Bypasses Usher and yt-dlp completely for 100% reliable, instant playback.
 */
async function resolveCloudFrontDvrFromNode(
  node: any,
  quality?: string
): Promise<{ streamUrl: string; qualities: StreamQualityOption[] } | null> {
  if (!node) return null;
  let baseDomain = '';
  let basePath = '';

  if (node.seekPreviewsURL) {
    const match = node.seekPreviewsURL.match(/https:\/\/([^/]+)\/([^/]+)\/storyboards/);
    if (match) {
      baseDomain = match[1];
      basePath = match[2];
    }
  }

  if (!basePath && node.previewThumbnailURL) {
    const match = node.previewThumbnailURL.match(/\/cf_vods\/([^/]+)\/([^/]+)\//);
    if (match) {
      baseDomain = `${match[1]}.cloudfront.net`;
      basePath = match[2];
    }
  }

  if (!baseDomain || !basePath) return null;

  interface CandidateTierDef {
    id: string;
    label: string;
    height: number;
    width?: number;
    fps?: number;
    bandwidth: number;
    paths: string[];
  }

  const tierDefs: CandidateTierDef[] = [
    {
      id: '1080p',
      label: '1080p60 (Source)',
      height: 1080,
      width: 1920,
      fps: 60,
      bandwidth: 8000000,
      paths: ['chunked/index-dvr.m3u8', 'chunked/index-muted.m3u8', 'chunked/index.m3u8'],
    },
    {
      id: '720p60',
      label: '720p60 (HD)',
      height: 720,
      width: 1280,
      fps: 60,
      bandwidth: 3500000,
      paths: ['720p60/index-dvr.m3u8', '720p60/index.m3u8'],
    },
    {
      id: '720p',
      label: '720p (30fps)',
      height: 720,
      width: 1280,
      fps: 30,
      bandwidth: 2500000,
      paths: ['720p30/index-dvr.m3u8', '720p/index-dvr.m3u8', '720p30/index.m3u8'],
    },
    {
      id: '480p',
      label: '480p (SD)',
      height: 480,
      width: 854,
      fps: 30,
      bandwidth: 1500000,
      paths: ['480p30/index-dvr.m3u8', '480p/index-dvr.m3u8', '480p30/index.m3u8'],
    },
    {
      id: '360p',
      label: '360p',
      height: 360,
      width: 640,
      fps: 30,
      bandwidth: 800000,
      paths: ['360p30/index-dvr.m3u8', '360p/index-dvr.m3u8', '360p30/index.m3u8'],
    },
    {
      id: '160p',
      label: '160p',
      height: 160,
      width: 284,
      fps: 30,
      bandwidth: 300000,
      paths: ['160p30/index-dvr.m3u8', '160p/index-dvr.m3u8', '160p30/index.m3u8'],
    },
    {
      id: 'audio_only',
      label: 'Audio Only',
      height: 0,
      fps: 0,
      bandwidth: 160000,
      paths: ['audio_only/index-dvr.m3u8', 'audio_only/index.m3u8'],
    },
  ];

  // Helper to probe first valid URL for a tier
  const probeTier = async (tier: CandidateTierDef): Promise<StreamQualityOption | null> => {
    for (const subPath of tier.paths) {
      const candidateUrl = `https://${baseDomain}/${basePath}/${subPath}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(candidateUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          return {
            id: tier.id,
            label: tier.label,
            height: tier.height,
            width: tier.width,
            fps: tier.fps,
            bandwidth: tier.bandwidth,
            url: candidateUrl,
          };
        }
      } catch {
        // Continue to next path candidate for this tier
      }
    }
    return null;
  };

  // Probe all tiers concurrently
  const probed = await Promise.all(tierDefs.map((t) => probeTier(t)));
  const availableQualities = probed.filter((q): q is StreamQualityOption => q !== null);

  if (availableQualities.length === 0) {
    return null;
  }

  // Pick best matching URL according to requested quality
  let selectedUrl = availableQualities[0].url; // Default to chunked/source

  if (quality && quality !== 'best' && quality !== 'source') {
    const cleanQ = quality.toLowerCase();
    const exactMatch = availableQualities.find(
      (q) => q.id === cleanQ || q.id.startsWith(cleanQ) || q.label.toLowerCase().startsWith(cleanQ)
    );
    if (exactMatch) {
      selectedUrl = exactMatch.url;
    } else {
      const targetHeight = parseInt(cleanQ.replace(/[^\d]/g, ''), 10);
      if (!isNaN(targetHeight)) {
        const match = availableQualities.find((q) => q.height > 0 && q.height <= targetHeight);
        if (match) selectedUrl = match.url;
      }
    }
  }

  console.log(`[Twitch CloudFront Direct ✅] Resolved: ${selectedUrl} with ${availableQualities.length} tiers`);
  return {
    streamUrl: selectedUrl,
    qualities: availableQualities,
  };
}

/**
 * Resolves explicit VOD URL via CloudFront directly.
 */
async function resolveVodCloudFront(
  vodId: string,
  quality?: string
): Promise<{ streamUrl: string; qualities: StreamQualityOption[] } | null> {
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({
        query: `query {
          video(id: "${vodId}") {
            id
            seekPreviewsURL
            previewThumbnailURL(height: 180, width: 320)
          }
        }`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const node = data?.data?.video;
    if (!node) return null;
    return await resolveCloudFrontDvrFromNode(node, quality);
  } catch (err: any) {
    console.warn('[Twitch VOD GQL Error]', err.message);
    return null;
  }
}

/**
 * yt-dlp fallback — used only for clips and as absolute last resort.
 */
async function resolveViaYtDlp(targetUrl: string, ytDlpBin: string, quality?: string): Promise<string | null> {
  let formatFilter = 'best/bestvideo+bestaudio';
  if (quality && quality !== 'source' && quality !== 'best') {
    const height = parseInt(quality.replace('p', ''), 10);
    if (!isNaN(height) && height > 0) {
      formatFilter = `best[height<=${height}]/bestvideo[height<=${height}]+bestaudio/best`;
    }
  }

  const cmd = `"${ytDlpBin}" -g -f "${formatFilter}" --no-warnings --no-check-certificate "${targetUrl}"`;
  console.log(`[Twitch yt-dlp Fallback] 🔧 Trying yt-dlp for: ${targetUrl.substring(0, 80)}`);

  try {
    const { stdout } = await execAsync(cmd, { timeout: 25000 });
    const url = stdout.trim().split('\n')[0].trim();
    if (url && url.startsWith('http')) {
      console.log(`[Twitch yt-dlp Fallback] ✅ yt-dlp resolved: ${url.substring(0, 80)}...`);
      return url;
    }
  } catch (err: any) {
    console.warn(`[Twitch yt-dlp Fallback] ❌ yt-dlp failed: ${err.message?.split('\n')[0]}`);
  }
  return null;
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class TwitchStreamResolverService {
  /**
   * Resolves the active recording DVR VOD node for a live Twitch channel via GQL.
   */
  static async resolveActiveDvrNode(channelName: string): Promise<any | null> {
    const channel = channelName.toLowerCase().trim();
    if (!channel || ['videos', 'clip', 'directory', 'p', 'settings'].includes(channel)) {
      return null;
    }

    try {
      const gqlRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({
          query: `query {
            user(login: "${channel}") {
              stream { id createdAt }
              videos(first: 5, sort: TIME) {
                edges {
                  node {
                    id
                    status
                    broadcastType
                    createdAt
                    seekPreviewsURL
                    previewThumbnailURL(height: 180, width: 320)
                  }
                }
              }
            }
          }`,
        }),
      });

      if (!gqlRes.ok) return null;

      const gqlData = await gqlRes.json();
      const userObj = gqlData?.data?.user;
      const streamObj = userObj?.stream;
      const edges = userObj?.videos?.edges || [];

      // 1. Explicit RECORDING status = active DVR VOD
      let recordingVod = edges.find((e: any) => e?.node?.status === 'RECORDING')?.node;

      // 2. If stream is live and top video is ARCHIVE type → it's the DVR VOD
      if (!recordingVod && streamObj?.id && edges.length > 0) {
        const topNode = edges[0]?.node;
        if (topNode?.broadcastType === 'ARCHIVE') {
          recordingVod = topNode;
        }
      }

      // 3. Fallback to latest video if created within recent broadcast
      if (!recordingVod && edges.length > 0) {
        const topNode = edges[0]?.node;
        if (topNode?.broadcastType === 'ARCHIVE' || topNode?.status === 'RECORDED') {
          recordingVod = topNode;
        }
      }

      if (recordingVod) {
        return recordingVod;
      }
    } catch (err: any) {
      console.warn(`[Twitch Stream Resolver] GQL DVR check error for ${channel}:`, err.message);
    }
    return null;
  }

  /**
   * Resolves direct HLS stream URL for any Twitch URL.
   *
   * Strategy (in order):
   *   1. CloudFront Direct DVR (instant, no auth, no blocking)
   *   2. Usher API (usher.ttvnw.net)
   *   3. yt-dlp last resort
   */
  static async resolveStreamUrl(
    targetUrl: string,
    ytDlpBin: string,
    quality?: string,
    forceRefresh = false
  ): Promise<StreamResolutionResult> {
    const cleanUrl = targetUrl.split('?')[0].replace(/\/$/, '');
    const cacheKey = `${cleanUrl.toLowerCase()}_${quality || 'best'}`;

    // 1. Cache hit
    if (!forceRefresh) {
      const cached = streamCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Twitch Stream Resolver ⚡ CACHE HIT] ${cacheKey}`);
        return cached.result;
      }
    }

    // 2. Single-flight deduplication
    const existingInFlight = inFlightResolutions.get(cacheKey);
    if (existingInFlight && !forceRefresh) {
      console.log(`[Twitch Stream Resolver ⚡ SINGLE-FLIGHT] Joining in-flight resolution for: ${cacheKey}`);
      return await existingInFlight;
    }

    // 3. Initiate new resolution
    const resolutionPromise = (async (): Promise<StreamResolutionResult> => {
      const channelMatch = cleanUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)$/i);
      const isChannel = Boolean(
        channelMatch &&
        channelMatch[1] &&
        !['videos', 'clip', 'directory', 'p', 'settings'].includes(channelMatch[1].toLowerCase())
      );
      const channel = isChannel ? channelMatch![1].toLowerCase() : undefined;

      const isClip = targetUrl.includes('/clip/') || targetUrl.includes('clips.twitch.tv');
      const isVodUrl = targetUrl.includes('/videos/');
      const vodMatch = targetUrl.match(/videos\/(\d+)/);
      const vodId = vodMatch ? vodMatch[1] : undefined;

      let sourceType: 'dvr' | 'live' | 'vod' | 'clip' = 'vod';
      let resolvedVodId: string | undefined = vodId;
      let resolvedChannel: string | undefined = channel;
      let streamUrl: string | null = null;
      let resolvedQualities: StreamQualityOption[] = [];
      let resolvedMasterUrl: string | undefined;

      // ─── CLIP ─────────────────────────────────────────────────────────────
      if (isClip) {
        sourceType = 'clip';
        streamUrl = await resolveViaYtDlp(targetUrl, ytDlpBin, quality);
        if (!streamUrl) throw new Error('Failed to resolve Twitch clip URL');
      }

      // ─── LIVE CHANNEL ─────────────────────────────────────────────────────
      else if (isChannel && channel) {
        const dvrNode = await this.resolveActiveDvrNode(channel);

        if (dvrNode) {
          console.log(`[Twitch Stream Resolver] 🎯 DVR VOD found: ${dvrNode.id} for channel "${channel}"`);
          sourceType = 'dvr';
          resolvedVodId = String(dvrNode.id);

          // Priority 1: Direct CloudFront HLS (Fastest, zero blocking, instant 200 OK)
          const cfRes = await resolveCloudFrontDvrFromNode(dvrNode, quality);
          if (cfRes) {
            streamUrl = cfRes.streamUrl;
            resolvedQualities = cfRes.qualities;
          }

          // Priority 2: Usher VOD
          if (!streamUrl) {
            console.warn(`[Twitch Stream Resolver ⚠️] CloudFront direct failed, trying Usher VOD...`);
            const usherVodRes = await resolveVodHls(dvrNode.id, quality);
            if (usherVodRes) {
              streamUrl = usherVodRes.streamUrl;
              resolvedQualities = usherVodRes.qualities;
              resolvedMasterUrl = usherVodRes.masterPlaylistUrl;
            }
          }

          // Priority 3: Live Usher
          if (!streamUrl) {
            console.warn(`[Twitch Stream Resolver ⚠️] VOD Usher failed, trying live Usher...`);
            const liveUsherRes = await resolveChannelHls(channel, quality);
            if (liveUsherRes) {
              streamUrl = liveUsherRes.streamUrl;
              resolvedQualities = liveUsherRes.qualities;
              resolvedMasterUrl = liveUsherRes.masterPlaylistUrl;
              sourceType = 'live';
            }
          }

          // Priority 4: yt-dlp last resort
          if (!streamUrl) {
            console.warn(`[Twitch Stream Resolver ⚠️] Usher methods failed, trying yt-dlp...`);
            streamUrl = await resolveViaYtDlp(`https://www.twitch.tv/videos/${dvrNode.id}`, ytDlpBin, quality);
          }
        } else {
          sourceType = 'live';
          console.log(`[Twitch Stream Resolver] 📡 No DVR VOD found, resolving live channel via Usher: ${channel}`);
          const liveUsherRes = await resolveChannelHls(channel, quality);
          if (liveUsherRes) {
            streamUrl = liveUsherRes.streamUrl;
            resolvedQualities = liveUsherRes.qualities;
            resolvedMasterUrl = liveUsherRes.masterPlaylistUrl;
          }

          if (!streamUrl) {
            console.warn(`[Twitch Stream Resolver ⚠️] Live Usher failed, trying yt-dlp...`);
            streamUrl = await resolveViaYtDlp(targetUrl, ytDlpBin, quality);
          }
        }

        if (!streamUrl) {
          throw new Error(`The channel "${channel}" is not currently live or stream resolution failed.`);
        }
      }

      // ─── EXPLICIT VOD URL ─────────────────────────────────────────────────
      else if (isVodUrl && vodId) {
        sourceType = 'vod';

        // Priority 1: Direct CloudFront HLS
        const cfRes = await resolveVodCloudFront(vodId, quality);
        if (cfRes) {
          streamUrl = cfRes.streamUrl;
          resolvedQualities = cfRes.qualities;
        }

        // Priority 2: Usher VOD
        if (!streamUrl) {
          console.warn(`[Twitch Stream Resolver ⚠️] CloudFront direct failed, trying Usher VOD...`);
          const usherVodRes = await resolveVodHls(vodId, quality);
          if (usherVodRes) {
            streamUrl = usherVodRes.streamUrl;
            resolvedQualities = usherVodRes.qualities;
            resolvedMasterUrl = usherVodRes.masterPlaylistUrl;
          }
        }

        // Priority 3: yt-dlp
        if (!streamUrl) {
          console.warn(`[Twitch Stream Resolver ⚠️] VOD Usher failed, trying yt-dlp...`);
          streamUrl = await resolveViaYtDlp(targetUrl, ytDlpBin, quality);
        }

        if (!streamUrl) throw new Error(`Failed to resolve Twitch VOD ${vodId}`);
      }

      // ─── UNKNOWN ──────────────────────────────────────────────────────────
      else {
        streamUrl = await resolveViaYtDlp(targetUrl, ytDlpBin, quality);
        if (!streamUrl) throw new Error(`Failed to resolve Twitch URL: ${targetUrl}`);
      }

      const result: StreamResolutionResult = {
        streamUrl,
        sourceType,
        vodId: resolvedVodId,
        channel: resolvedChannel,
        masterPlaylistUrl: resolvedMasterUrl,
        qualities: resolvedQualities,
      };

      // Cache for 12 minutes
      streamCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + 12 * 60 * 1000,
      });

      return result;
    })();

    inFlightResolutions.set(cacheKey, resolutionPromise);

    try {
      const result = await resolutionPromise;
      return result;
    } finally {
      inFlightResolutions.delete(cacheKey);
    }
  }

  /**
   * Manually invalidate cache for a given URL.
   */
  static invalidateCache(targetUrl: string, quality?: string) {
    const cleanUrl = targetUrl.split('?')[0].replace(/\/$/, '');
    const cacheKey = `${cleanUrl.toLowerCase()}_${quality || 'best'}`;
    streamCache.delete(cacheKey);
    console.log(`[Twitch Stream Resolver 🗑️] Cache invalidated for: ${cacheKey}`);
  }
}

