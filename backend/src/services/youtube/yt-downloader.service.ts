import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFFmpegAspectFilter } from '../video-crop.service.js';
import { getFFmpegLocationFlag } from '../../utils/binary-resolver.util.js';
import { getYoutubeCookiesPath } from '../../utils/cookie-resolver.util.js';

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
   * Downloads a YouTube video or audio clip at exact requested resolution (4K, 2K, 1080p, etc.)
   * directly clipping the requested time slice without ever downloading the full video.
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
    const heightLimit = this.parseHeightLimit(quality);

    const cookiesFile = getYoutubeCookiesPath();
    const rawTarget = needsCrop ? tempRawFile : finalFile;

    // Clean up any stale files from previous attempts
    try {
      if (fs.existsSync(rawTarget)) fs.unlinkSync(rawTarget);
      if (fs.existsSync(finalFile)) fs.unlinkSync(finalFile);
      if (fs.existsSync(tempRawFile)) fs.unlinkSync(tempRawFile);
    } catch (_) {}

    const startTimeStr = formatSecondsToTime(trimStart);
    const endTimeStr = isTrimmed && trimEnd ? formatSecondsToTime(trimEnd) : '';

    const proxy = process.env.YTDLP_PROXY?.trim();
    const poToken = process.env.YTDLP_PO_TOKEN?.trim();
    const NODE_BIN = process.execPath;

    // android-based clients reject --cookies; web/ios/mweb need js-runtimes for sig solving
    const clientDefs: Array<{ arg: string; supportsCookies: boolean }> = [
      { arg: '',                                                           supportsCookies: true  },
      { arg: '--extractor-args "youtube:player_client=ios"',              supportsCookies: true  },
      { arg: '--extractor-args "youtube:player_client=mweb"',             supportsCookies: true  },
      { arg: '--extractor-args "youtube:player_client=android"',          supportsCookies: false },
      { arg: '--extractor-args "youtube:player_client=tv,android"',       supportsCookies: false },
      { arg: '--extractor-args "youtube:player_client=android,ios,mweb"', supportsCookies: false },
    ];

    const buildArgs = (clientArg: string, useProxy: boolean, useCookies: boolean): string[] => {
      const ffmpegLocFlag = getFFmpegLocationFlag(ffmpegBin);
      const args: string[] = [
        `"${ytDlpBin}"`,
        ...(ffmpegLocFlag ? [ffmpegLocFlag] : []),
        `--js-runtimes "node:${NODE_BIN}"`,
        '--no-check-certificate',
        '--no-playlist',
      ];

      if (clientArg) args.push(clientArg);

      if (useProxy && proxy) {
        args.push(`--proxy "${proxy}"`);
      } else if (proxy) {
        args.push('--proxy ""');
      }

      if (poToken) args.push(`--extractor-args "youtube:po_token=web+${poToken}"`);

      if (isTrimmed) {
        args.push(`--download-sections "*${startTimeStr}-${endTimeStr}"`);
      }

      if (isAudio) {
        args.push('-f', '"bestaudio[format_note*=original]/bestaudio[format_note*=default]/bestaudio[language_preference>=10]/bestaudio/best"', '-x', '--audio-format', format, '--audio-quality', String(audioQuality));
      } else {
        const defaultAudioSelector = '(bestaudio[format_note*=original][ext=m4a]/bestaudio[format_note*=original]/bestaudio[format_note*=default][ext=m4a]/bestaudio[format_note*=default]/bestaudio[language_preference>=10][ext=m4a]/bestaudio[language_preference>=10]/bestaudio[ext=m4a]/bestaudio)';
        const ytFormat = heightLimit
          ? `bestvideo[height<=${heightLimit}]+${defaultAudioSelector}/best[height<=${heightLimit}]`
          : `bestvideo+${defaultAudioSelector}/best`;
        args.push('-f', `"${ytFormat}"`, '--merge-output-format', 'mp4');
      }

      if (isTrimmed) args.push('--force-keyframes-at-cuts');
      if (useCookies && cookiesFile) args.push(`--cookies "${cookiesFile}"`);

      args.push('-o', `"${rawTarget}"`, `"${url}"`);
      return args;
    };

    if (onProgress) onProgress('⬇️ Downloading high-resolution clip stream...', 30);

    // Interleave proxy/no-proxy for each client strategy
    const downloadStrategies: Array<{ clientArg: string; useProxy: boolean; useCookies: boolean }> = [];
    for (const { arg, supportsCookies } of clientDefs) {
      const canUseCookies = supportsCookies && Boolean(cookiesFile);
      if (proxy) downloadStrategies.push({ clientArg: arg, useProxy: true,  useCookies: canUseCookies });
               downloadStrategies.push({ clientArg: arg, useProxy: false, useCookies: canUseCookies });
    }

    let lastDownloadErr: any;
    let downloaded = false;

    for (let attempt = 0; attempt < downloadStrategies.length; attempt++) {
      const { clientArg, useProxy, useCookies } = downloadStrategies[attempt];
      const args = buildArgs(clientArg, useProxy, useCookies);
      console.log(`[YouTube Downloader] Strategy ${attempt + 1}/${downloadStrategies.length} (client=${clientArg || 'default'}, proxy=${useProxy}, cookies=${useCookies})`);

      try {
        await execAsync(args.join(' '), { maxBuffer: 500 * 1024 * 1024, timeout: 30 * 60 * 1000 });
        downloaded = true;
        console.log(`[YouTube Downloader] Strategy ${attempt + 1} succeeded`);
        break;
      } catch (err: any) {
        lastDownloadErr = err;
        const fullMsg = (err?.stderr || err?.message || String(err)).trim();
        console.warn(`[YouTube Downloader] Strategy ${attempt + 1} failed:\n${fullMsg}`);
        if (attempt < downloadStrategies.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    if (!downloaded) {
      throw lastDownloadErr;
    }

    if (!fs.existsSync(rawTarget) || fs.statSync(rawTarget).size === 0) {
      throw new Error('Video clip stream download failed or produced an empty file.');
    }

    const rawSizeMb = (fs.statSync(rawTarget).size / (1024 * 1024)).toFixed(2);
    console.log(`[YouTube Downloader] ✅ Full-quality stream downloaded (${rawSizeMb} MB)`);

    // ── Local FFmpeg Processing (Aspect Ratio Cropping if requested) ──
    if (needsCrop) {
      if (onProgress) onProgress('✂️ Cropping clip aspect ratio...', 80);

      const ffmpegArgs: string[] = [
        `"${ffmpegBin}"`,
        '-y',
        '-fflags +genpts+discardcorrupt',
        `-i "${rawTarget}"`,
        `-vf "${filterString}"`,
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-c:a aac',
        '-map 0:v:0',
        '-map 0:a:0?',
        '-avoid_negative_ts make_zero',
        '-movflags +faststart',
        `"${finalFile}"`,
      ];

      console.log(`[YouTube Downloader] ✂️ Cropping clip with FFmpeg:\n${ffmpegArgs.join(' ')}`);
      await execAsync(ffmpegArgs.join(' '), { maxBuffer: 100 * 1024 * 1024, timeout: 30 * 60 * 1000 });

      // Clean up raw download if it was stored in tempRawFile
      if (fs.existsSync(tempRawFile)) {
        try { fs.unlinkSync(tempRawFile); } catch (_) {}
      }
    }

    if (!fs.existsSync(finalFile) || fs.statSync(finalFile).size === 0) {
      throw new Error('Final exported file was not generated.');
    }

    const finalSizeMb = (fs.statSync(finalFile).size / (1024 * 1024)).toFixed(2);
    console.log(`[YouTube Downloader] 🎉 Export ready: ${finalFile} (${finalSizeMb} MB)`);

    if (onProgress) onProgress('✅ Complete!', 100);
    return finalFile;
  }
}
