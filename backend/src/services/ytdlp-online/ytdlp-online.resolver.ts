/**
 * ytdlp-online.resolver.ts
 *
 * Single entry-point for resolving direct stream URLs.
 *
 * Priority chain:
 *  1. ytdlp.online  (MAIN  — cloud HTTP/2, fast, no local binary needed)
 *  2. local yt-dlp  (FALLBACK — only when MAIN fails or rate-limits)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  YtdlpOnlineService,
  YtdlpOnlineRateLimitError,
  YtdlpOnlineError,
  type YtdlpOnlineResult,
} from './ytdlp-online.service.js';
import { YouTubeInnerTubeService } from '../youtube/yt-innertube.service.js';
import { logger } from '../../utils/logger.util.js';

const execAsync = promisify(exec);

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ResolvedStream extends YtdlpOnlineResult {
  /** 'innertube' = direct native player | 'online' = ytdlp.online | 'local' = local yt-dlp */
  source: 'innertube' | 'online' | 'local';
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve direct CDN stream URL(s) for a given video URL using a cascading architecture:
 *  1. Layer 1A: Direct YouTube InnerTube Native Player (Zero binary, unthrottled CDN, ~150ms)
 *  2. Layer 1B: ytdlp.online Cloud HTTP/2 Extractor
 *  3. Layer 1C: Local yt-dlp binary (if available)
 *
 * @param targetUrl   The video URL (YouTube, etc.)
 * @param ytDlpBin    Path to local yt-dlp binary (for fallback)
 * @param cookiesFile Optional path to a Netscape cookies.txt for local fallback
 */
export async function resolveStreamUrls(
  targetUrl: string,
  ytDlpBin?: string,
  cookiesFile?: string,
): Promise<ResolvedStream> {
  const isYouTube = /(?:youtu\.be\/|youtube\.com)/i.test(targetUrl);

  // ── Engine 1A: Direct Native YouTube InnerTube Resolver ──────────────────────
  if (isYouTube) {
    try {
      logger.info('StreamResolver', `Attempting Layer 1A: Direct Native InnerTube for ${targetUrl}`);
      const innerTubeResult = await YouTubeInnerTubeService.resolveVideo(targetUrl);
      logger.info('StreamResolver', `Layer 1A (InnerTube) succeeded: ${innerTubeResult.formats.length} formats resolved`);
      return {
        videoUrl: innerTubeResult.direct_stream_url,
        audioUrl: innerTubeResult.audio_stream_url,
        allUrls: innerTubeResult.allUrls,
        log: [`[innertube] ${innerTubeResult.formats.length} stream formats resolved directly via iOS context`],
        source: 'innertube',
      };
    } catch (err: any) {
      logger.warn('StreamResolver', `Layer 1A (InnerTube) failed (${err?.message || err}). Cascading to Layer 1B (ytdlp.online)...`);
    }
  }

  // ── Engine 1B: ytdlp.online Remote Cloud Extractor ─────────────────────────
  try {
    logger.info('StreamResolver', `Attempting Layer 1B: ytdlp.online cloud extractor for ${targetUrl}`);
    const result = await YtdlpOnlineService.getStreamUrls(targetUrl);
    logger.info('StreamResolver', `Layer 1B (ytdlp.online) succeeded`);
    return { ...result, source: 'online' };
  } catch (err: any) {
    logger.warn('StreamResolver', `Layer 1B (ytdlp.online) failed (${err?.message || err}). Cascading to Layer 1C...`);
  }

  // ── Engine 1C: Local yt-dlp binary fallback ────────────────────────────────
  if (ytDlpBin) {
    logger.info('StreamResolver', `Attempting Layer 1C: Local yt-dlp fallback for ${targetUrl}`);
    const localUrls = await resolveWithLocalYtDlp(targetUrl, ytDlpBin, cookiesFile);
    return {
      source: 'local',
      videoUrl: localUrls.videoUrl,
      audioUrl: localUrls.audioUrl,
      allUrls: localUrls.allUrls,
      log: localUrls.log,
    };
  }

  throw new Error(`All extraction engines failed to resolve stream URLs for ${targetUrl}`);
}

// ─── Local yt-dlp fallback ────────────────────────────────────────────────────

async function resolveWithLocalYtDlp(
  targetUrl: string,
  ytDlpBin: string,
  cookiesFile?: string,
): Promise<YtdlpOnlineResult> {
  const cookieArg = cookiesFile ? `--cookies "${cookiesFile}"` : '';
  const NODE_BIN = process.execPath;

  const cmd = [
    `"${ytDlpBin}"`,
    `--js-runtimes "node:${NODE_BIN}"`,
    '--force-ipv4',
    '--no-check-certificate',
    '--no-playlist',
    '--get-url',
    cookieArg,
    `"${targetUrl}"`,
  ].filter(Boolean).join(' ');

  logger.info('StreamResolver:Fallback', `Running local binary: ${ytDlpBin}`);

  let stdout = '';
  try {
    const result = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 2, timeout: 60_000 });
    stdout = result.stdout.trim();
  } catch (err: any) {
    const msg = err?.stderr || err?.message || String(err);
    logger.error({
      context: 'StreamResolver:Fallback',
      summary: 'Local yt-dlp fallback execution failed',
      reason: msg.slice(0, 200),
      targetUrl,
      error: err,
    });
    throw new Error(`Local yt-dlp fallback failed: ${msg.trim()}`);
  }

  const allUrls = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('https://'));

  if (allUrls.length === 0) {
    logger.error({
      context: 'StreamResolver:Fallback',
      summary: 'Local yt-dlp finished but output contained no URLs',
      targetUrl,
    });
    throw new Error('Local yt-dlp fallback returned no URLs');
  }

  // Classify video vs audio
  let videoUrl: string | null = null;
  let audioUrl: string | null = null;

  for (const u of allUrls) {
    const isManifest = u.includes('.m3u8') || u.includes('/manifest/');
    const isAudio =
      u.includes('mime=audio') ||
      /[?&]itag=(251|249|250|140|258|256)(&|$)/.test(u);

    if (!videoUrl && isManifest) { videoUrl = u; continue; }
    if (!audioUrl && isAudio)    { audioUrl = u; continue; }
    if (!videoUrl && !isAudio)   { videoUrl = u; }
  }

  logger.info('StreamResolver:Fallback', `Local fallback succeeded: ${allUrls.length} URL(s) found`);
  return { videoUrl, audioUrl, allUrls, log: [`[local yt-dlp] ${allUrls.length} URLs resolved`] };
}
