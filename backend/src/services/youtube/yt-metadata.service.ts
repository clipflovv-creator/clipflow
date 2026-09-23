import { exec } from 'child_process';
import { promisify } from 'util';

import { getYoutubeCookieArg } from '../../utils/cookie-resolver.util.js';

const execAsync = promisify(exec);

/**
 * Returns proxy flags from YTDLP_PROXY env var.
 * Returns both a proxy version and a no-proxy version so strategies can alternate.
 */
function getProxyFlag(): string {
  const proxy = process.env.YTDLP_PROXY?.trim();
  return proxy ? `--proxy "${proxy}"` : '';
}

function getPoTokenFlag(): string {
  const poToken = process.env.YTDLP_PO_TOKEN?.trim();
  return poToken ? `--extractor-args "youtube:po_token=web+${poToken}"` : '';
}

export class YouTubeMetadataService {
  /**
   * Fetches full YouTube video metadata using multiple client/proxy strategies.
   * Logs the full error message from each failed strategy for diagnosis.
   */
  static async getMetadata(url: string, ytDlpBin: string, retries = 2): Promise<any> {
    const cookieArg = getYoutubeCookieArg();
    const proxyFlag = getProxyFlag();
    const poTokenFlag = getPoTokenFlag();

    // Build an ordered set of (clientArg, useProxy) strategy combinations.
    // Try with proxy first (if available), then without proxy as fallback.
    // This is critical: datacenter IPs are blocked, but some strategies work
    // without proxy when cookies are fresh.
    const clientArgs = [
      '',                                                                        // default web client
      '--extractor-args "youtube:player_client=tv_embedded"',                   // TV embedded — bypasses many blocks
      '--extractor-args "youtube:player_client=android"',                       // Android client
      '--extractor-args "youtube:player_client=ios"',                           // iOS client
      '--extractor-args "youtube:player_client=web_creator"',                   // Web Creator (less restricted)
      '--extractor-args "youtube:player_client=tv,android"',                    // TV + Android combo
      '--extractor-args "youtube:player_client=tv_embedded,web_embedded"',      // Embedded combo
      '--extractor-args "youtube:player_client=android,ios,mweb"',              // Mobile combo
      '--extractor-args "youtube:player_client=visionos,android"',              // visionOS combo
    ];

    // Interleave: proxy → no-proxy alternation for each client
    const strategies: Array<{ clientArg: string; useProxy: boolean }> = [];
    for (const clientArg of clientArgs) {
      if (proxyFlag) {
        strategies.push({ clientArg, useProxy: true });
      }
      strategies.push({ clientArg, useProxy: false });
    }

    const baseFlags = `--no-check-certificate --no-playlist --dump-json`;

    let lastErr: any;
    let lowResFallback: any = null;

    for (let attempt = 0; attempt < strategies.length; attempt++) {
      const { clientArg, useProxy } = strategies[attempt];
      const proxy = useProxy ? proxyFlag : '--proxy ""'; // empty string = no proxy in yt-dlp
      const flags = [clientArg, poTokenFlag, proxy, cookieArg, baseFlags]
        .filter(Boolean)
        .join(' ');

      const cmd = `"${ytDlpBin}" ${flags} "${url}"`;

      try {
        const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 100 });
        const parsed = JSON.parse(stdout);
        const videoFormats = (parsed.formats || []).filter(
          (f: any) => f.url && f.vcodec && f.vcodec !== 'none'
        );
        const hasHd = videoFormats.some((f: any) => (f.height || 0) >= 720);

        if (hasHd || videoFormats.length >= 3) {
          console.log(`[YouTube Metadata] Strategy ${attempt + 1} succeeded (client=${clientArg || 'default'}, proxy=${useProxy})`);
          return parsed;
        }

        if (!lowResFallback && parsed) {
          lowResFallback = parsed;
        }
      } catch (err: any) {
        lastErr = err;
        // Log FULL error (stderr) for diagnostics — critical for debugging Render bot blocks
        const fullMsg = (err?.stderr || err?.message || String(err)).trim();
        console.warn(
          `[YouTube Metadata] Strategy ${attempt + 1} failed (client=${clientArg || 'default'}, proxy=${useProxy}):\n${fullMsg}`
        );

        if (attempt < strategies.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }
    }

    if (lowResFallback) return lowResFallback;
    throw lastErr;
  }
}
