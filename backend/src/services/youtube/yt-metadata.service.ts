import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

function findCookiesFile(): string | null {
  // Support YOUTUBE_COOKIES or YOUTUBE_COOKIES_BASE64 via environment variable (e.g. on Render)
  try {
    const rawEnv = process.env.YOUTUBE_COOKIES || (
      process.env.YOUTUBE_COOKIES_BASE64
        ? Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf8')
        : ''
    );
    if (rawEnv && rawEnv.trim().length > 50) {
      const target = path.join(process.cwd(), 'cookies.txt');
      if (!fs.existsSync(target) || fs.statSync(target).size < 50) {
        fs.writeFileSync(target, rawEnv.trim(), 'utf8');
      }
      return target;
    }
  } catch (err) {
    console.warn('[YouTubeMetadataService] Failed to write env cookies to disk:', err);
  }

  const candidates = [
    path.join(process.cwd(), 'cookies.txt'),
    path.join(process.cwd(), 'youtube-cookies.txt'),
    path.join(process.cwd(), 'backend', 'cookies.txt'),
    path.join(process.cwd(), '..', 'cookies.txt'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).size > 100) {
      return c;
    }
  }
  return null;
}

/**
 * Returns extra bypass flags read from environment variables:
 *   YTDLP_PROXY       - e.g. "http://user:pass@proxy.webshare.io:80"
 *                       Routes yt-dlp through a residential proxy to bypass datacenter IP blocks.
 *   YTDLP_PO_TOKEN    - YouTube PO token (from browser DevTools → Network → innertube requests).
 *                       Set alongside YOUTUBE_COOKIES for the best bypass rate.
 */
function getBypassFlags(): string {
  const parts: string[] = [];
  const proxy = process.env.YTDLP_PROXY?.trim();
  if (proxy) {
    parts.push(`--proxy "${proxy}"`);
    console.log('[YouTubeMetadataService] Using proxy for YouTube requests.');
  }
  const poToken = process.env.YTDLP_PO_TOKEN?.trim();
  if (poToken) {
    parts.push(`--extractor-args "youtube:po_token=web+${poToken}"`);
  }
  return parts.join(' ');
}

export class YouTubeMetadataService {
  /**
   * Fetches full YouTube video metadata, title, duration, uploader, thumbnails, and DASH formats.
   * Uses multiple client-spoofing strategies to prevent datacenter IP 429 / 403 blocks on Render / cloud hosts.
   * Set YTDLP_PROXY env var to a residential HTTP/SOCKS5 proxy URL for most reliable results.
   */
  static async getMetadata(url: string, ytDlpBin: string, retries = 2): Promise<any> {
    const cookiesFile = findCookiesFile();
    const cookieArg = cookiesFile ? `--cookies "${cookiesFile}" ` : '';
    const bypassFlags = getBypassFlags();

    // Client strategies: Default visionos/web returns full 1080p/720p/480p DASH formats with direct URLs.
    // Fallback to mobile clients only if cloud datacenter IP blocks the primary visionos extractor.
    const clientStrategies = [
      '',
      '--extractor-args "youtube:player_client=visionos"',
      '--extractor-args "youtube:player_client=visionos,android"',
      '--extractor-args "youtube:player_client=android,ios,mweb"',
      '--extractor-args "youtube:player_client=android"',
    ];

    let lastErr: any;
    let lowResFallback: any = null;

    for (let attempt = 0; attempt < clientStrategies.length && attempt <= retries + 2; attempt++) {
      const clientArg = clientStrategies[attempt];
      const flags = `--js-runtimes node ${clientArg} ${bypassFlags} ${cookieArg}--no-warnings --no-check-certificate --no-playlist --dump-json`;

      try {
        const { stdout } = await execAsync(
          `"${ytDlpBin}" ${flags} "${url}"`,
          { maxBuffer: 1024 * 1024 * 100 }
        );
        const parsed = JSON.parse(stdout);
        const videoFormats = (parsed.formats || []).filter(
          (f: any) => f.url && f.vcodec && f.vcodec !== 'none'
        );
        const hasHd = videoFormats.some((f: any) => (f.height || 0) >= 720);

        // If strategy returned full HD formats (or 3+ diverse video streams), return immediately
        if (hasHd || videoFormats.length >= 3) {
          return parsed;
        }

        // If it only got low-res (e.g. format 18 360p), save as fallback and test if next strategy yields HD
        if (!lowResFallback && parsed) {
          lowResFallback = parsed;
        }
      } catch (err: any) {
        lastErr = err;
        const msg = (err?.message || String(err)).toLowerCase();
        console.warn(`[YouTube Metadata] Strategy ${attempt + 1} (${clientArg || 'default'}) failed:`, msg.split('\n')[0]);
        if (attempt < clientStrategies.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
      }
    }

    if (lowResFallback) return lowResFallback;
    throw lastErr;
  }
}
