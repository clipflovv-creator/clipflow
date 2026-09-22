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

export class YouTubeMetadataService {
  /**
   * Fetches full YouTube video metadata, title, duration, uploader, thumbnails, and DASH formats.
   * Uses android,ios,mweb client spoofing to prevent datacenter IP 429 / 403 blocks on Render / cloud hosts.
   */
  static async getMetadata(url: string, ytDlpBin: string, retries = 2): Promise<any> {
    const cookiesFile = findCookiesFile();
    const cookieArg = cookiesFile ? `--cookies "${cookiesFile}" ` : '';

    // Multiple client spoofing strategies for cloud hosting environments
    const clientStrategies = [
      '--extractor-args "youtube:player_client=android,ios,mweb"',
      '--extractor-args "youtube:player_client=ios,tv,mweb"',
      '--extractor-args "youtube:player_client=android"',
      '',
    ];

    let lastErr: any;
    for (let attempt = 0; attempt < clientStrategies.length && attempt <= retries; attempt++) {
      const clientArg = clientStrategies[attempt];
      const flags = `--js-runtimes node ${clientArg} ${cookieArg}--no-warnings --no-check-certificate --no-playlist --dump-json`;

      try {
        const { stdout } = await execAsync(
          `"${ytDlpBin}" ${flags} "${url}"`,
          { maxBuffer: 1024 * 1024 * 100 }
        );
        return JSON.parse(stdout);
      } catch (err: any) {
        lastErr = err;
        const msg = (err?.message || String(err)).toLowerCase();
        console.warn(`[YouTube Metadata] Strategy ${attempt + 1} (${clientArg || 'default'}) failed:`, msg.split('\n')[0]);
        if (attempt < clientStrategies.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        break;
      }
    }
    throw lastErr;
  }
}
