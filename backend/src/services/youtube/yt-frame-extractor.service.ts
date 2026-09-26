import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { scheduleCleanup } from '../ffmpeg.service.js';
import { getYoutubeCookiesPath } from '../../utils/cookie-resolver.util.js';
import { resolveStreamUrls } from '../ytdlp-online/index.js';
import { getFFmpegStreamArgs } from './yt-downloader.service.js';

const execAsync = promisify(exec);

export interface YouTubeFrameOptions {
  url: string;
  timestamp: number;
  quality?: string;
  format?: 'png' | 'jpg';
  crop?: {
    crop_x?: string | number;
    crop_y?: string | number;
    crop_w?: string | number;
    crop_h?: string | number;
  };
  cacheDir: string;
  ytDlpBin: string;
  ffmpegBin: string;
  streamUrl?: string;
}

export class YouTubeFrameExtractorService {
  /**
   * Extracts an uncompressed master resolution (4K / 1080p) frame at exact timestamp for YouTube.
   */
  static async extractFrame(options: YouTubeFrameOptions): Promise<{ filePath: string; ext: string; isPng: boolean; fromCache: boolean }> {
    const {
      url,
      timestamp,
      quality = '1080p',
      format = 'png',
      crop,
      cacheDir,
      ytDlpBin,
      ffmpegBin,
      streamUrl,
    } = options;

    const isPng = format.toLowerCase() === 'png';
    const ext = isPng ? 'png' : 'jpg';

    let heightLimit = 1080;
    if (quality && quality.toLowerCase() !== 'best' && quality.toLowerCase() !== 'max') {
      const cleanQ = quality.toLowerCase().replace('p', '');
      if (cleanQ === '4k' || cleanQ === '2160') heightLimit = 2160;
      else if (cleanQ === '1440' || cleanQ === '2k') heightLimit = 1440;
      else if (cleanQ === '1080') heightLimit = 1080;
      else if (cleanQ === '720') heightLimit = 720;
      else if (cleanQ === '480') heightLimit = 480;
      else if (cleanQ === '360') heightLimit = 360;
      else if (cleanQ === '240') heightLimit = 240;
      else if (!isNaN(Number(cleanQ))) heightLimit = Number(cleanQ);
    }

    let cropFilter = '';
    if (crop) {
      const { crop_x, crop_y, crop_w, crop_h } = crop;
      const cX = typeof crop_x === 'number' ? crop_x : parseFloat(crop_x || '0');
      const cY = typeof crop_y === 'number' ? crop_y : parseFloat(crop_y || '0');
      const cW = typeof crop_w === 'number' ? crop_w : parseFloat(crop_w || '0');
      const cH = typeof crop_h === 'number' ? crop_h : parseFloat(crop_h || '0');

      if (!isNaN(cW) && !isNaN(cH) && cW > 0 && cH > 0 && (cW < 0.999 || cH < 0.999 || cX > 0.001 || cY > 0.001)) {
        const safeX = isNaN(cX) ? 0 : Math.max(0, Math.min(1 - cW, cX));
        const safeY = isNaN(cY) ? 0 : Math.max(0, Math.min(1 - cH, cY));
        cropFilter = `crop=iw*${cW.toFixed(4)}:ih*${cH.toFixed(4)}:iw*${safeX.toFixed(4)}:ih*${safeY.toFixed(4)}`;
      }
    }

    const cacheKey = `yt_${url}_${timestamp.toFixed(2)}_res_${heightLimit}_${cropFilter}_${ext}`;
    const hash = crypto.createHash('md5').update(cacheKey).digest('hex');
    const framePath = path.join(cacheDir, `frame_${hash}.${ext}`);

    if (fs.existsSync(framePath) && fs.statSync(framePath).size > 1000) {
      return { filePath: framePath, ext, isPng, fromCache: true };
    }

    const vfOption = cropFilter ? `-vf "${cropFilter}"` : '';
    const qOption = isPng ? '' : '-q:v 1';

    // 1. Fast Path: If a direct streamUrl is already available, extract directly with FFmpeg
    if (streamUrl) {
      try {
        const coarseSeek = Math.max(0, timestamp - 2);
        const fineSeek = timestamp - coarseSeek;
        const streamFlags = getFFmpegStreamArgs(streamUrl).join(' ');
        await execAsync(`"${ffmpegBin}" ${streamFlags} -ss ${coarseSeek} -i "${streamUrl}" -ss ${fineSeek} -frames:v 1 -update 1 ${qOption} ${vfOption} -y "${framePath}"`, { timeout: 15000 });
        if (fs.existsSync(framePath) && fs.statSync(framePath).size > 1000) {
          scheduleCleanup(framePath, 2 * 60 * 60 * 1000);
          return { filePath: framePath, ext, isPng, fromCache: false };
        }
      } catch (ffErr: any) {
        console.warn('[YouTubeFrameExtractorService] Direct stream URL extraction failed, falling back to yt-dlp:', ffErr.message);
      }
    }

    // 2. Resolve direct video stream URL using ytdlp.online (MAIN) -> local yt-dlp (FALLBACK)
    try {
      const cookiesFile = getYoutubeCookiesPath();
      const resolved = await resolveStreamUrls(url, ytDlpBin, cookiesFile || undefined);
      const directUrl = resolved.videoUrl || resolved.allUrls[0];
      if (directUrl) {
        const coarseSeek = Math.max(0, timestamp - 2);
        const fineSeek = timestamp - coarseSeek;
        const directFlags = getFFmpegStreamArgs(directUrl).join(' ');
        await execAsync(`"${ffmpegBin}" ${directFlags} -ss ${coarseSeek} -i "${directUrl}" -ss ${fineSeek} -frames:v 1 -update 1 ${qOption} ${vfOption} -y "${framePath}"`, { timeout: 15000 });
        if (fs.existsSync(framePath) && fs.statSync(framePath).size > 1000) {
          scheduleCleanup(framePath, 2 * 60 * 60 * 1000);
          return { filePath: framePath, ext, isPng, fromCache: false };
        }
      }
    } catch (streamResolveErr: any) {
      console.warn('[YouTubeFrameExtractorService] Fast stream resolution warning, falling back to segment:', streamResolveErr.message);
    }

    // 3. Fallback: Download small 1.5s video segment via native yt-dlp and extract frame
    const tempSeg = path.join(cacheDir, `seg_${hash}.mp4`);
    const startSec = Math.max(0, timestamp - 0.3);
    const endSec = timestamp + 1.5;
    const cookiesFile = getYoutubeCookiesPath();
    const proxy = process.env.YTDLP_PROXY?.trim();
    const buildFrameCmd = (useCookies: boolean) => [
      `"${ytDlpBin}"`,
      `--ffmpeg-location "${path.dirname(ffmpegBin)}"`,
      '--no-warnings',
      '--no-check-certificate',
      proxy ? `--proxy "${proxy}"` : '',
      useCookies && cookiesFile ? `--cookies "${cookiesFile}"` : '',
      '--no-playlist',
      `--download-sections "*${startSec}-${endSec}"`,
      '--force-keyframes-at-cuts',
      `-f "bestvideo[height<=${heightLimit}]/best[height<=${heightLimit}]/best"`,
      `-o "${tempSeg}"`,
      `"${url}"`,
    ].filter(Boolean).join(' ');

    try {
      await execAsync(buildFrameCmd(Boolean(cookiesFile)), { timeout: 35000 });
      if (fs.existsSync(tempSeg)) {
        const offsetSeek = Math.max(0, timestamp - startSec);
        await execAsync(`"${ffmpegBin}" -ss ${offsetSeek} -i "${tempSeg}" -frames:v 1 -update 1 ${qOption} ${vfOption} -y "${framePath}"`);
        scheduleCleanup(tempSeg, 30000);
      }
    } catch (e: any) {
      console.warn('[YouTubeFrameExtractorService] Fast segment extraction warning, retrying without cookies:', e.message);
      try {
        await execAsync(buildFrameCmd(false), { timeout: 35000 });
        if (fs.existsSync(tempSeg)) {
          const offsetSeek = Math.max(0, timestamp - startSec);
          await execAsync(`"${ffmpegBin}" -ss ${offsetSeek} -i "${tempSeg}" -frames:v 1 -update 1 ${qOption} ${vfOption} -y "${framePath}"`);
          scheduleCleanup(tempSeg, 30000);
        }
      } catch (err: any) {
        console.warn('[YouTubeFrameExtractorService] Retry failed:', err.message);
      }
    }

    if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) {
      scheduleCleanup(framePath, 2 * 60 * 60 * 1000);
      return { filePath: framePath, ext, isPng, fromCache: false };
    }

    throw new Error('Failed to extract high-resolution YouTube frame.');
  }
}
