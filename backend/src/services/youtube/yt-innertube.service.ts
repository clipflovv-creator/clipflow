/**
 * yt-innertube.service.ts
 *
 * Direct native YouTube InnerTube player API client.
 *
 * Queries YouTube's official player endpoint (/youtubei/v1/player) directly
 * via native Node.js HTTP fetch, bypassing 3rd-party websites (ytdlp.online)
 * and binary dependencies.
 *
 * Returns direct signed GoogleVideo CDN streams:
 *  - Adaptive video (4K, 1440p, 1080p itag 137 AVC1, 720p itag 136 AVC1)
 *  - Adaptive audio (itag 140 AAC in M4A, itag 251 Opus)
 *  - HLS variant manifest (auto-adaptive multi-bitrate)
 *  - Complete metadata (title, author, duration, thumbnails)
 */

import { logger } from '../../utils/logger.util.js';

export interface InnerTubeFormat {
  format_id: string;
  itag: number;
  url: string;
  ext: string;
  vcodec: string;
  acodec: string;
  resolution?: string;
  height?: number;
  width?: number;
  fps?: number;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  abr?: number;
  format_note?: string;
  is_default?: boolean;
}

export interface InnerTubeResult {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  duration_string: string;
  thumbnail: string;
  direct_stream_url: string;
  audio_stream_url: string;
  hls_manifest_url?: string;
  formats: InnerTubeFormat[];
  video_formats: InnerTubeFormat[];
  audio_formats: InnerTubeFormat[];
  allUrls: string[];
}

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
  return match ? match[1] : url.trim();
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export class YouTubeInnerTubeService {
  /**
   * Resolves YouTube video metadata and direct CDN streams via InnerTube iOS client context.
   */
  static async resolveVideo(targetUrl: string): Promise<InnerTubeResult> {
    const videoId = extractVideoId(targetUrl);
    if (!videoId || videoId.length !== 11) {
      throw new Error(`Invalid YouTube video ID: "${videoId}"`);
    }

    logger.info('YouTubeInnerTube', `Resolving video ${videoId} via native InnerTube iOS context...`);

    const endpoint = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
    const payload = {
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '20.02.02',
          deviceMake: 'Apple',
          deviceModel: 'iPhone16,2',
          osName: 'iOS',
          osVersion: '18.3.2',
          hl: 'en',
          gl: 'US',
        },
      },
      videoId: videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS',
        },
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.02.02 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '20.02.02',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`InnerTube request failed: HTTP ${res.status} ${res.statusText}`);
    }

    const data: any = await res.json();
    const playability = data.playabilityStatus;

    if (playability?.status !== 'OK' && playability?.status !== 'LIVE_STREAM_OFFLINE') {
      const reason = playability?.reason || playability?.status || 'Video is unavailable';
      throw new Error(`YouTube InnerTube error: ${reason}`);
    }

    const streamingData = data.streamingData;
    if (!streamingData) {
      throw new Error('No streaming data found in YouTube InnerTube response');
    }

    const rawProgressive: any[] = streamingData.formats || [];
    const rawAdaptive: any[] = streamingData.adaptiveFormats || [];
    const rawAll = [...rawProgressive, ...rawAdaptive];

    const formats: InnerTubeFormat[] = [];
    const allUrls: string[] = [];

    for (const f of rawAll) {
      if (!f.url) continue;

      allUrls.push(f.url);
      const mime = f.mimeType || '';
      const isAudioOnly = mime.startsWith('audio/') || (!f.width && !f.height);
      const isVideoOnly = mime.startsWith('video/') && !f.audioQuality;

      let vcodec = 'none';
      let acodec = 'none';
      const codecMatch = mime.match(/codecs="([^"]+)"/);
      if (codecMatch && codecMatch[1]) {
        const codecParts = codecMatch[1].split(',').map((c: string) => c.trim());
        if (isAudioOnly) {
          acodec = codecParts[0] || (mime.includes('webm') ? 'opus' : 'mp4a.40.2');
        } else if (isVideoOnly) {
          vcodec = codecParts[0] || (mime.includes('webm') ? 'vp09' : 'avc1.640028');
        } else {
          vcodec = codecParts[0] || 'avc1.640028';
          acodec = codecParts[1] || 'mp4a.40.2';
        }
      } else {
        if (isAudioOnly) acodec = mime.includes('webm') ? 'opus' : 'mp4a.40.2';
        if (isVideoOnly) vcodec = mime.includes('webm') ? 'vp09' : 'avc1.640028';
      }

      const ext = mime.includes('webm') ? 'webm' : 'mp4';
      const height = f.height || (f.qualityLabel ? parseInt(f.qualityLabel, 10) : undefined);
      const width = f.width;
      const tbr = f.averageBitrate ? Math.round(f.averageBitrate / 1000) : (f.bitrate ? Math.round(f.bitrate / 1000) : undefined);
      const abr = isAudioOnly && tbr ? tbr : undefined;
      const contentLength = f.contentLength ? parseInt(f.contentLength, 10) : undefined;

      formats.push({
        format_id: String(f.itag),
        itag: f.itag,
        url: f.url,
        ext,
        vcodec,
        acodec,
        resolution: isAudioOnly ? 'audio only' : (width && height ? `${width}x${height}` : (f.qualityLabel || `${height}p`)),
        height,
        width,
        fps: f.fps,
        filesize: contentLength,
        filesize_approx: contentLength,
        tbr,
        abr,
        format_note: isAudioOnly ? 'audio' : (f.qualityLabel || `${height}p`),
        is_default: f.itag === 140 || f.itag === 137 || f.itag === 22,
      });
    }

    if (formats.length === 0 && !streamingData.hlsManifestUrl) {
      throw new Error('InnerTube returned 0 playable stream formats');
    }

    const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none');
    const audioFormats = formats.filter((f) => f.acodec && f.acodec !== 'none');

    // Prioritize 1080p H.264 (itag 137) or 720p H.264 (itag 136) or best available progressive
    const h264Video = videoFormats.filter((f) => f.vcodec.startsWith('avc') || f.ext === 'mp4');
    const bestVideo =
      h264Video.find((f) => f.height === 1080) ||
      h264Video.find((f) => f.height === 720) ||
      h264Video[0] ||
      videoFormats[0];

    // Prioritize itag 140 (AAC M4A) audio
    const bestAudio =
      audioFormats.find((f) => f.itag === 140) ||
      audioFormats.find((f) => f.ext === 'm4a' || f.acodec.startsWith('mp4a')) ||
      audioFormats[0];

    const directStreamUrl = bestVideo?.url || formats[0]?.url || streamingData.hlsManifestUrl || '';
    const audioStreamUrl = bestAudio?.url || '';

    const details = data.videoDetails || {};
    const title = details.title || 'YouTube Video';
    const uploader = details.author || 'YouTube Creator';
    const duration = parseInt(details.lengthSeconds || '0', 10) || 180;
    const duration_string = formatDuration(duration);

    let thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    if (details.thumbnail?.thumbnails?.length) {
      const thumbs = details.thumbnail.thumbnails;
      thumbnail = thumbs[thumbs.length - 1]?.url || thumbnail;
    }

    logger.info('YouTubeInnerTube', `Successfully resolved ${videoId} (${formats.length} formats, directStream: ${Boolean(directStreamUrl)}, audioStream: ${Boolean(audioStreamUrl)})`);

    return {
      id: videoId,
      title,
      uploader,
      duration,
      duration_string,
      thumbnail,
      direct_stream_url: directStreamUrl,
      audio_stream_url: audioStreamUrl,
      hls_manifest_url: streamingData.hlsManifestUrl,
      formats,
      video_formats: videoFormats,
      audio_formats: audioFormats,
      allUrls,
    };
  }
}
