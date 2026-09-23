import { exec } from 'child_process';
import { promisify } from 'util';

import { getYoutubeCookieArg } from '../../utils/cookie-resolver.util.js';

const execAsync = promisify(exec);

// Use the same Node binary that runs this server — guarantees yt-dlp can find it for JS challenge solving.
// process.execPath = e.g. /usr/local/bin/node on Render
const NODE_BIN = process.execPath;

function getProxyFlag(): string {
  const proxy = process.env.YTDLP_PROXY?.trim();
  return proxy ? `--proxy "${proxy}"` : '';
}

function getPoTokenFlag(): string {
  const poToken = process.env.YTDLP_PO_TOKEN?.trim();
  return poToken ? `--extractor-args "youtube:po_token=web+${poToken}"` : '';
}

interface Strategy {
  clientArg: string;
  useProxy: boolean;
  useCookies: boolean; // android client rejects --cookies flag
}

export class YouTubeMetadataService {
  static async getMetadata(url: string, ytDlpBin: string, _retries: number = 1): Promise<any> {
    const cookieArg = getYoutubeCookieArg();
    const proxyFlag = getProxyFlag();
    const poTokenFlag = getPoTokenFlag();
    const hasProxy = Boolean(process.env.YTDLP_PROXY?.trim());
    const hasCookies = Boolean(cookieArg);

    // js-runtimes flag: points yt-dlp to the exact Node binary for signature/n-challenge solving
    const jsRuntimeFlag = `--js-runtimes "node:${NODE_BIN}"`;

    // Clients: android/mweb skip cookies (unsupported), web clients need JS runtime
    const clientDefs: Array<{ arg: string; supportsCookies: boolean }> = [
      { arg: '',                                                              supportsCookies: true  }, // default web
      { arg: '--extractor-args "youtube:player_client=ios"',                 supportsCookies: true  }, // iOS
      { arg: '--extractor-args "youtube:player_client=mweb"',                supportsCookies: true  }, // mobile web
      { arg: '--extractor-args "youtube:player_client=android"',             supportsCookies: false }, // android (no cookies)
      { arg: '--extractor-args "youtube:player_client=tv,android"',          supportsCookies: false }, // TV+android (no cookies)
      { arg: '--extractor-args "youtube:player_client=android,ios,mweb"',    supportsCookies: false }, // mobile combo
      { arg: '--extractor-args "youtube:player_client=visionos,android"',    supportsCookies: true  }, // visionOS
    ];

    // Build strategy list: proxy first, then no-proxy, for each client
    const strategies: Strategy[] = [];
    for (const { arg, supportsCookies } of clientDefs) {
      if (hasProxy) strategies.push({ clientArg: arg, useProxy: true,  useCookies: supportsCookies && hasCookies });
                   strategies.push({ clientArg: arg, useProxy: false, useCookies: supportsCookies && hasCookies });
    }

    const baseFlags = `--no-check-certificate --no-playlist --dump-json`;

    let lastErr: any;
    let lowResFallback: any = null;

    for (let attempt = 0; attempt < strategies.length; attempt++) {
      const { clientArg, useProxy, useCookies } = strategies[attempt];
      const proxy = useProxy ? proxyFlag : (hasProxy ? '--proxy ""' : '');

      const flags = [
        jsRuntimeFlag,
        clientArg,
        poTokenFlag,
        proxy,
        useCookies ? cookieArg : '',
        baseFlags,
      ].filter(Boolean).join(' ');

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

        if (!lowResFallback && parsed) lowResFallback = parsed;
      } catch (err: any) {
        lastErr = err;
        const fullMsg = (err?.stderr || err?.message || String(err)).trim();
        console.warn(`[YouTube Metadata] Strategy ${attempt + 1} failed (client=${clientArg || 'default'}, proxy=${useProxy}):\n${fullMsg}`);
        if (attempt < strategies.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    if (lowResFallback) return lowResFallback;
    throw lastErr;
  }
}
