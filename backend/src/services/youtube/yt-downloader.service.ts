import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFFmpegAspectFilter } from '../video-crop.service.js';
import { resolveStreamUrls } from '../ytdlp-online/index.js';
import { getYoutubeCookiesPath } from '../../utils/cookie-resolver.util.js';
import { getFFmpegLocationFlag } from '../../utils/binary-resolver.util.js';
import { logger } from '../../utils/logger.util.js';

function formatSecondsToTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const ms = Math.floor((seconds % 1) * 1000);
  if (ms > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getFFmpegStreamArgs(streamUrl: string): string[] {
  const flags: string[] = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
  ];

  if (streamUrl.includes('googlevideo.com') || streamUrl.includes('youtube.com')) {
    flags.push('-referer', '"https://www.youtube.com/"');
    if (streamUrl.includes('c=IOS')) {
      flags.push('-user_agent', '"com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)"');
    } else if (streamUrl.includes('c=ANDROID')) {
      flags.push('-user_agent', '"com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip"');
    } else {
      flags.push('-user_agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"');
    }
  } else if (streamUrl.includes('twimg.com') || streamUrl.includes('twitter.com') || streamUrl.includes('x.com')) {
    flags.push('-referer', '"https://x.com/"');
    flags.push('-user_agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"');
  } else if (streamUrl.includes('instagram.com') || streamUrl.includes('cdninstagram.com')) {
    flags.push('-referer', '"https://www.instagram.com/"');
    flags.push('-user_agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"');
  } else {
    flags.push('-user_agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"');
  }

  return flags;
}

const execAsync = promisify(exec);

export interface YouTubeDownloadOptions {
  url: string;
  format?: string;
  quality?: string;
  audioQuality?: string | number;
  trimStart?: number;
  trimEnd?: number;
  aspectRatio?: string;
  fitMode?: 'crop' | 'pad';
  cropPosition?: string;
  cropBox?: any;
  tempRawFile: string;
  finalFile: string;
  ytDlpBin: string;
  ffmpegBin: string;
  onProgress?: (phase: string, percent?: number, speed?: string) => void;
}

export class YouTubeDownloaderService {
  /**
   * Parse quality string (e.g. '2160p', '4k', '1440p', '1080p', '720p') into height limit
   */
  static parseHeightLimit(quality?: string): number | null {
    if (!quality || quality.toLowerCase() === 'best' || quality.toLowerCase() === 'max') {
      return null;
    }
    const cleanQ = quality.toLowerCase().replace('p', '');
    if (cleanQ === '4k' || cleanQ === '2160') return 2160;
    if (cleanQ === '1440' || cleanQ === '2k') return 1440;
    if (cleanQ === '1080') return 1080;
    if (cleanQ === '720') return 720;
    if (cleanQ === '480') return 480;
    if (cleanQ === '360') return 360;
    if (cleanQ === '240') return 240;
    const num = Number(cleanQ);
    return !isNaN(num) && num > 0 ? num : null;
  }

  /**
   * Downloads a YouTube video or audio clip via fast stream resolution + FFmpeg,
   * with automatic fallback to local yt-dlp if direct stream download is blocked.
   */
  static async downloadClip(options: YouTubeDownloadOptions): Promise<string> {
    const {
      url,
      format = 'mp4',
      quality = '1080p',
      audioQuality = '0',
      trimStart = 0,
      trimEnd,
      aspectRatio,
      fitMode = 'pad',
      cropPosition = 'center',
      cropBox,
      tempRawFile,
      finalFile,
      ytDlpBin,
      ffmpegBin,
      onProgress,
    } = options;

    const isAudio = format === 'mp3' || format === 'wav' || format === 'm4a' || format === 'aac';
    const isTrimmed = typeof trimEnd === 'number' && trimEnd > trimStart;
    const filterString = !isAudio ? getFFmpegAspectFilter(aspectRatio as any, fitMode, cropPosition as any, cropBox) : '';
    const needsCrop = !isAudio && Boolean(filterString);

    // Clean up any stale files from previous attempts
    try {
      if (fs.existsSync(finalFile)) fs.unlinkSync(finalFile);
      if (fs.existsSync(tempRawFile)) fs.unlinkSync(tempRawFile);
    } catch (_) {}

    if (onProgress) onProgress('🌐 Resolving YouTube streams...', 15);

    try {
      // 1. Resolve direct streams via cascading resolver (InnerTube -> ytdlp.online -> yt-dlp)
      const stream = await resolveStreamUrls(url, ytDlpBin);
      const videoStreamUrl = stream.videoUrl;
      const audioStreamUrl = stream.audioUrl;

      if (!videoStreamUrl && !audioStreamUrl) {
        throw new Error('Resolver did not return stream URLs');
      }

      if (onProgress) onProgress('⬇️ Downloading & muxing stream via FFmpeg...', 45);

      const startTimeStr = formatSecondsToTime(trimStart);
      const duration = isTrimmed && trimEnd ? (trimEnd - trimStart) : null;
      const durationArg = duration ? `-t ${duration}` : '';
      const seekArg = trimStart > 0 ? `-ss ${startTimeStr}` : '';

      const ffmpegArgs: string[] = [`"${ffmpegBin}"`, '-y'];

      if (isAudio) {
        // Audio-only download
        const targetAudio = (audioStreamUrl || videoStreamUrl)!;
        ffmpegArgs.push(...getFFmpegStreamArgs(targetAudio));
        if (seekArg) ffmpegArgs.push(seekArg);
        ffmpegArgs.push(`-i "${targetAudio}"`);
        if (durationArg) ffmpegArgs.push(durationArg);

        if (format === 'mp3') {
          ffmpegArgs.push('-c:a libmp3lame', '-b:a 320k');
        } else if (format === 'wav') {
          ffmpegArgs.push('-c:a pcm_s16le');
        } else {
          ffmpegArgs.push('-c:a aac', '-b:a 192k');
        }
        ffmpegArgs.push(`"${finalFile}"`);

      } else {
        // Video + Audio mux download
        if (videoStreamUrl && audioStreamUrl) {
          ffmpegArgs.push(...getFFmpegStreamArgs(videoStreamUrl));
          if (seekArg) ffmpegArgs.push(seekArg);
          ffmpegArgs.push(`-i "${videoStreamUrl}"`);

          ffmpegArgs.push(...getFFmpegStreamArgs(audioStreamUrl));
          if (seekArg) ffmpegArgs.push(seekArg);
          ffmpegArgs.push(`-i "${audioStreamUrl}"`);
          if (durationArg) ffmpegArgs.push(durationArg);

          // When video is trimmed or cropped, transcode video with fast x264 to guarantee 100% millisecond-accurate sync
          if (isTrimmed || needsCrop) {
            const vf = filterString ? `-vf "${filterString}"` : '';
            if (vf) ffmpegArgs.push(vf);
            ffmpegArgs.push('-c:v libx264', '-preset veryfast', '-crf 18', '-pix_fmt yuv420p', '-c:a aac', '-b:a 192k', '-avoid_negative_ts make_zero');
          } else {
            ffmpegArgs.push('-c:v copy', '-c:a aac', '-b:a 192k', '-avoid_negative_ts make_zero');
          }
          ffmpegArgs.push('-map 0:v:0', '-map 1:a:0', '-shortest', '-movflags +faststart', `"${finalFile}"`);

        } else {
          // Combined stream or single track
          const singleUrl = (videoStreamUrl || audioStreamUrl)!;
          ffmpegArgs.push(...getFFmpegStreamArgs(singleUrl));
          if (seekArg) ffmpegArgs.push(seekArg);
          ffmpegArgs.push(`-i "${singleUrl}"`);
          if (durationArg) ffmpegArgs.push(durationArg);

          if (isTrimmed || needsCrop) {
            const vf = filterString ? `-vf "${filterString}"` : '';
            if (vf) ffmpegArgs.push(vf);
            ffmpegArgs.push('-c:v libx264', '-preset veryfast', '-crf 18', '-pix_fmt yuv420p', '-c:a aac', '-b:a 192k', '-avoid_negative_ts make_zero');
          } else {
            ffmpegArgs.push('-c:v copy', '-c:a aac', '-avoid_negative_ts make_zero');
          }
          ffmpegArgs.push('-movflags +faststart', `"${finalFile}"`);
        }
      }

      const ffmpegCmd = ffmpegArgs.join(' ');
      logger.info('YouTubeDownloader', 'Running FFmpeg direct stream download & mux...', { command: ffmpegCmd });

      try {
        await execAsync(ffmpegCmd, { maxBuffer: 500 * 1024 * 1024, timeout: 15 * 60 * 1000 });
      } catch (ffErr: any) {
        // If stream copy fails due to codec mismatch, retry with transcode
        if (ffmpegCmd.includes('-c:v copy')) {
          logger.warn('YouTubeDownloader', 'Stream copy failed, retrying with transcode...', { error: ffErr?.message });
          const retryArgs = ffmpegArgs.map((a) => a === '-c:v copy' ? '-c:v libx264 -preset veryfast -crf 18' : a);
          await execAsync(retryArgs.join(' '), { maxBuffer: 500 * 1024 * 1024, timeout: 15 * 60 * 1000 });
        } else {
          throw ffErr;
        }
      }

      if (fs.existsSync(finalFile) && fs.statSync(finalFile).size > 0) {
        const fileSizeMb = (fs.statSync(finalFile).size / (1024 * 1024)).toFixed(2);
        logger.info('YouTubeDownloader', `Download completed successfully (${fileSizeMb} MB) via direct stream mux`);
        if (onProgress) onProgress('✅ Download ready!', 100);
        return finalFile;
      }
    } catch (directErr: any) {
      const shortErr = directErr?.message?.includes('403') ? 'Server returned 403 Forbidden' : (directErr?.message?.split('\n')[0]?.substring(0, 80) || 'Stream download failed');
      logger.warn('YouTubeDownloader', `Direct stream download failed (${shortErr}). Falling back to local yt-dlp...`, { rawError: directErr?.message });
    }

    // 2. Robust fallback: Download via local yt-dlp if direct stream failed
    if (ytDlpBin) {
      if (onProgress) onProgress('⬇️ Processing via yt-dlp engine...', 50);
      return await YouTubeDownloaderService.downloadWithLocalYtDlp(options);
    }

    throw new Error('All YouTube download strategies failed');
  }

  /**
   * Fallback downloader using local yt-dlp binary with cookies & extractor args.
   */
  static async downloadWithLocalYtDlp(options: YouTubeDownloadOptions): Promise<string> {
    const {
      url,
      format = 'mp4',
      quality = '1080p',
      audioQuality = '0',
      trimStart = 0,
      trimEnd,
      aspectRatio,
      fitMode = 'pad',
      cropPosition = 'center',
      cropBox,
      tempRawFile,
      finalFile,
      ytDlpBin,
      ffmpegBin,
      onProgress,
    } = options;

    const isAudio = format === 'mp3' || format === 'wav' || format === 'm4a' || format === 'aac';
    const isTrimmed = typeof trimEnd === 'number' && trimEnd > trimStart;
    const filterString = !isAudio ? getFFmpegAspectFilter(aspectRatio as any, fitMode, cropPosition as any, cropBox) : '';
    const needsCrop = !isAudio && Boolean(filterString);
    const downloadTarget = (isTrimmed || needsCrop) ? tempRawFile : finalFile;

    const cookiesPath = getYoutubeCookiesPath();
    const cookieArg = cookiesPath ? `--cookies "${cookiesPath}"` : '';
    const ffmpegLocFlag = getFFmpegLocationFlag(ffmpegBin);

    const ytDlpArgs: string[] = [
      `"${ytDlpBin}"`,
      ...(ffmpegLocFlag ? [ffmpegLocFlag] : []),
      '--js-runtimes node',
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      cookieArg,
      '--extractor-args', '"youtube:player_client=android,web_embedded"',
    ];

    if (isAudio) {
      ytDlpArgs.push('-f', '"bestaudio[ext=m4a]/bestaudio/best"', '-x', '--audio-format', format, '--audio-quality', String(audioQuality));
    } else {
      const heightLimit = YouTubeDownloaderService.parseHeightLimit(quality);
      const defaultAudio = '(bestaudio[ext=m4a]/bestaudio)';
      const ytFormat = heightLimit
        ? `bestvideo[height<=${heightLimit}]+${defaultAudio}/best[height<=${heightLimit}]/bestvideo+${defaultAudio}/best`
        : `bestvideo+${defaultAudio}/best`;
      ytDlpArgs.push('-f', `"${ytFormat}"`, '--merge-output-format', 'mp4');
    }

    ytDlpArgs.push('-o', `"${downloadTarget}"`, `"${url}"`);

    const ytDlpCmd = ytDlpArgs.filter(Boolean).join(' ');
    logger.info('YouTubeDownloader:Fallback', 'Executing fallback yt-dlp engine...', { command: ytDlpCmd });
    await execAsync(ytDlpCmd, { maxBuffer: 500 * 1024 * 1024, timeout: 15 * 60 * 1000 });

    if (isTrimmed || needsCrop) {
      const startTimeStr = formatSecondsToTime(trimStart);
      const duration = isTrimmed && trimEnd ? (trimEnd - trimStart) : null;
      const durationArg = duration ? `-t ${duration}` : '';
      const seekArg = trimStart > 0 ? `-ss ${startTimeStr}` : '';
      const vf = filterString ? `-vf "${filterString}"` : '';

      const cutArgs = [
        `"${ffmpegBin}"`,
        '-y',
        seekArg,
        `-i "${downloadTarget}"`,
        durationArg,
        vf,
        '-c:v libx264',
        '-preset veryfast',
        '-crf 18',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-b:a 192k',
        '-avoid_negative_ts make_zero',
        '-movflags +faststart',
        `"${finalFile}"`,
      ].filter(Boolean).join(' ');

      await execAsync(cutArgs, { maxBuffer: 500 * 1024 * 1024, timeout: 15 * 60 * 1000 });
      try { if (fs.existsSync(downloadTarget)) fs.unlinkSync(downloadTarget); } catch {}
    }

    if (!fs.existsSync(finalFile) || fs.statSync(finalFile).size === 0) {
      throw new Error('yt-dlp fallback produced an empty output file');
    }

    if (onProgress) onProgress('✅ Download ready!', 100);
    return finalFile;
  }
}
