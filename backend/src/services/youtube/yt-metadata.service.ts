import { exec } from 'child_process';
import { promisify } from 'util';
import { getYoutubeCookieArg } from '../../utils/cookie-resolver.util.js';

const execAsync = promisify(exec);

// Use the same Node binary that runs this server — guarantees yt-dlp can find it for JS challenge solving.
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
  useCookies: boolean;
}

export class YouTubeMetadataService {
  private static cache = new Map<string, { data: any; expiresAt: number }>();
  private static inFlight = new Map<string, Promise<any>>();

  static async getMetadata(url: string, ytDlpBin: string, _retries: number = 1): Promise<any> {
    const cacheKey = url.trim();

    // 1. In-memory cache hit (15 min TTL)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[YouTube Metadata ⚡] Serving from cache: ${cacheKey.substring(0, 60)}`);
      return cached.data;
    }

    // 2. In-flight promise deduplication: avoid running concurrent duplicate yt-dlp child processes
    if (this.inFlight.has(cacheKey)) {
      console.log(`[YouTube Metadata ⏳] In-flight fetch in progress, deduplicating: ${cacheKey.substring(0, 60)}`);
      return await this.inFlight.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const result = await this.executeFetch(url, ytDlpBin);
        this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 15 * 60 * 1000 });
        return result;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  private static async executeFetch(url: string, ytDlpBin: string): Promise<any> {
    const cookieArg = getYoutubeCookieArg();
    const proxyFlag = getProxyFlag();
    const poTokenFlag = getPoTokenFlag();
    const hasProxy = Boolean(process.env.YTDLP_PROXY?.trim());
    const hasCookies = Boolean(cookieArg);

    const jsRuntimeFlag = `--js-runtimes "node:${NODE_BIN}"`;
    const baseFlags = `--no-check-certificate --no-playlist --dump-json`;

    // Prioritized, lean strategy list (avoids spawning 14 child processes which causes Render 512MB RAM OOM)
    const strategies: Strategy[] = [];

    // 1. If valid cookies exist, try direct with cookies first (fastest, typically 2-4 seconds)
    if (hasCookies) {
      strategies.push({ clientArg: '', useProxy: false, useCookies: true });
      strategies.push({ clientArg: '--extractor-args "youtube:player_client=ios"', useProxy: false, useCookies: true });
    }

    // 2. Try proxy with cookies or default web (if proxy configured)
    if (hasProxy) {
      strategies.push({ clientArg: '', useProxy: true, useCookies: hasCookies });
      strategies.push({ clientArg: '--extractor-args "youtube:player_client=ios"', useProxy: true, useCookies: hasCookies });
    }

    // 3. Fallback without cookies (Android / Mobile web)
    strategies.push({ clientArg: '--extractor-args "youtube:player_client=android"', useProxy: false, useCookies: false });
    strategies.push({ clientArg: '--extractor-args "youtube:player_client=mweb"', useProxy: false, useCookies: hasCookies });

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
        const { stdout } = await execAsync(cmd, {
          maxBuffer: 10 * 1024 * 1024, // 10MB memory safety cap to prevent OOM
          timeout: 15000,              // 15s timeout kills hanging process
        });
        const parsed = JSON.parse(stdout);
        const videoFormats = (parsed.formats || []).filter(
          (f: any) => f.url && f.vcodec && f.vcodec !== 'none'
        );
        const hasHd = videoFormats.some((f: any) => (f.height || 0) >= 720);

        if (hasHd || videoFormats.length >= 3) {
          console.log(`[YouTube Metadata ✅] Strategy ${attempt + 1} succeeded (client=${clientArg || 'default'}, proxy=${useProxy})`);
          return parsed;
        }

        if (!lowResFallback && parsed) lowResFallback = parsed;
      } catch (err: any) {
        lastErr = err;
        const fullMsg = (err?.stderr || err?.message || String(err)).trim();
        console.warn(`[YouTube Metadata ⚠️] Strategy ${attempt + 1} failed (client=${clientArg || 'default'}, proxy=${useProxy}):\n${fullMsg.substring(0, 150)}`);
        if (attempt < strategies.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    if (lowResFallback) return lowResFallback;
    throw lastErr;
  }
}
