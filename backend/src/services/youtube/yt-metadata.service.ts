import { resolveStreamUrls } from '../ytdlp-online/index.js';
import { YouTubeInnerTubeService } from './yt-innertube.service.js';
import { logger } from '../../utils/logger.util.js';

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
  return match ? match[1] : 'video';
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

export class YouTubeMetadataService {
  /**
   * Production-grade YouTube metadata extractor.
   * Priority:
   *  1. Direct Native InnerTube Player (Instant, complete metadata + all stream formats, zero binary)
   *  2. ytdlp.online + oEmbed Fallback
   *  3. Local yt-dlp binary Fallback
   */
  static async getMetadata(url: string, ytDlpBin?: string, _retries: number = 1): Promise<any> {
    const videoId = extractVideoId(url);
    logger.info('YouTubeMetadata', `Fetching metadata for ${videoId}...`);

    // ── Primary: Direct InnerTube Resolver ─────────────────────────────────
    try {
      logger.info('YouTubeMetadata', `Attempting Layer 1A: Direct InnerTube for ${videoId}`);
      const innerTube = await YouTubeInnerTubeService.resolveVideo(url);
      logger.info('YouTubeMetadata', `Layer 1A (InnerTube) succeeded for ${videoId} (${innerTube.formats.length} formats)`);

      return {
        id: innerTube.id,
        title: innerTube.title,
        thumbnail: innerTube.thumbnail,
        uploader: innerTube.uploader,
        duration: innerTube.duration,
        duration_string: innerTube.duration_string,
        is_live: false,
        live_status: 'not_live',
        platform: 'youtube',
        direct_stream_url: innerTube.direct_stream_url,
        audio_stream_url: innerTube.audio_stream_url,
        hls_manifest_url: innerTube.hls_manifest_url,
        formats: innerTube.formats,
        video_formats: innerTube.video_formats,
        audio_formats: innerTube.audio_formats,
        subtitles: {},
        automatic_captions: {},
        webpage_url: url,
      };
    } catch (err: any) {
      logger.warn('YouTubeMetadata', `Layer 1A (InnerTube) failed: ${err?.message || err}. Falling back to cascading resolver...`);
    }

    // ── Secondary: Cascading Stream Resolver (ytdlp.online / local) ─────────
    const stream = await resolveStreamUrls(url, ytDlpBin);

    // 2. Fetch fast public oEmbed metadata (title, author, thumbnail)
    let title = 'YouTube Video';
    let uploader = 'YouTube Creator';
    let thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: AbortSignal.timeout(5000),
      });
      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        title = oembedData.title || title;
        uploader = oembedData.author_name || uploader;
        if (oembedData.thumbnail_url) thumbnail = oembedData.thumbnail_url;
      }
    } catch (_) {
      // Keep default thumbnail
    }

    // 3. Extract exact duration from googlevideo stream URL (dur=... query param)
    let parsedDuration: number | undefined;
    for (const u of stream.allUrls) {
      const durMatch = u.match(/[?&]dur=([\d.]+)/);
      if (durMatch && durMatch[1]) {
        parsedDuration = Math.round(parseFloat(durMatch[1]));
        break;
      }
    }

    const duration = parsedDuration && parsedDuration > 0 ? parsedDuration : 180;
    const duration_string = formatDuration(duration);

    // 4. Build rich formats array matching original yt-dlp schema for ffmpeg.wasm
    const formats = stream.allUrls.map((streamUrl, idx) => {
      const isAudio = streamUrl.includes('mime=audio') || /[?&]itag=(251|249|250|140|258|256)(&|$)/.test(streamUrl);
      const isManifest = streamUrl.includes('.m3u8') || streamUrl.includes('/manifest/');

      const clenMatch = streamUrl.match(/[?&]clen=(\d+)/);
      const filesize = clenMatch ? parseInt(clenMatch[1], 10) : undefined;

      const itagMatch = streamUrl.match(/[?&]itag=(\d+)/);
      const itag = itagMatch ? itagMatch[1] : undefined;

      if (isAudio) {
        return {
          format_id: itag || `audio-${idx}`,
          ext: streamUrl.includes('webm') ? 'webm' : 'm4a',
          url: streamUrl,
          vcodec: 'none',
          acodec: streamUrl.includes('webm') ? 'opus' : 'mp4a.40.2',
          resolution: 'audio only',
          filesize,
          filesize_approx: filesize,
          abr: 160,
          format_note: 'audio',
        };
      }

      return {
        format_id: itag || (isManifest ? 'hls' : `video-${idx}`),
        ext: 'mp4',
        url: streamUrl,
        vcodec: 'avc1.640028',
        acodec: 'none',
        resolution: '1920x1080',
        height: 1080,
        width: 1920,
        fps: 30,
        filesize,
        filesize_approx: filesize,
        format_note: '1080p',
      };
    });

    const directStreamUrl = stream.videoUrl || stream.allUrls[0];
    const audioStreamUrl = stream.audioUrl;

    const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none');
    const audioFormats = formats.filter((f) => f.acodec && f.acodec !== 'none');

    // Ensure audio format entry exists if audioStreamUrl is present
    if (audioStreamUrl && !audioFormats.some((a) => a.url === audioStreamUrl)) {
      const audioEntry = {
        format_id: '140',
        ext: 'm4a',
        url: audioStreamUrl,
        vcodec: 'none',
        acodec: 'mp4a.40.2',
        resolution: 'audio only',
        filesize: undefined as number | undefined,
        filesize_approx: undefined as number | undefined,
        abr: 160,
        format_note: 'audio',
      };
      formats.push(audioEntry);
      audioFormats.push(audioEntry);
    }

    return {
      id: videoId,
      title,
      thumbnail,
      uploader,
      duration,
      duration_string,
      is_live: false,
      live_status: 'not_live',
      platform: 'youtube',
      direct_stream_url: directStreamUrl,
      audio_stream_url: audioStreamUrl,
      formats,
      video_formats: videoFormats,
      audio_formats: audioFormats,
      subtitles: {},
      automatic_captions: {},
      webpage_url: url,
    };
  }
}
