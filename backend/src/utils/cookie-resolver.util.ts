import path from 'path';
import fs from 'fs';
import os from 'os';

let cachedCookiePath: string | null = null;
let hasLoggedStatus = false;

/**
 * Discovers or materializes a valid YouTube cookies.txt file.
 * Supports:
 *  1. Render Secret Files: /etc/secrets/cookies.txt
 *  2. Env variable YOUTUBE_COOKIES_BASE64: base64-encoded Netscape cookies.txt
 *  3. Env variable YOUTUBE_COOKIES or YTDLP_COOKIES: raw text or newline-escaped text
 *  4. Local files: cookies.txt, youtube-cookies.txt in project root or cwd
 */
export function getYoutubeCookiesPath(): string | null {
  // 1. Check Render Secret Files first (/etc/secrets/...)
  // IMPORTANT: /etc/secrets/ is a READ-ONLY filesystem on Render.
  // yt-dlp writes updated cookies back to the file after each request → OSError crash.
  // Fix: copy to /tmp (writable) and return that path instead.
  const renderSecrets = [
    '/etc/secrets/cookies.txt',
    '/etc/secrets/youtube-cookies.txt',
    '/etc/secrets/youtube.cookies.txt',
  ];
  for (const secretPath of renderSecrets) {
    if (fs.existsSync(secretPath) && fs.statSync(secretPath).size > 50) {
      const tmpTarget = path.join(os.tmpdir(), 'clipflow_yt_cookies.txt');
      try {
        fs.copyFileSync(secretPath, tmpTarget);
        fs.chmodSync(tmpTarget, 0o600);
        if (!hasLoggedStatus) {
          console.log(`[YouTube Cookies] ✅ Copied Render Secret File to writable tmp: ${tmpTarget}`);
          hasLoggedStatus = true;
        }
        return tmpTarget;
      } catch (copyErr) {
        console.warn('[YouTube Cookies] Failed to copy secret file to tmp, using original path:', copyErr);
        if (!hasLoggedStatus) {
          console.log(`[YouTube Cookies] ✅ Found Render Secret File: ${secretPath}`);
          hasLoggedStatus = true;
        }
        return secretPath;
      }
    }
  }

  // 2. Check environment variables
  try {
    let rawContent = '';
    const b64 = process.env.YOUTUBE_COOKIES_BASE64 || process.env.YTDLP_COOKIES_BASE64;
    if (b64 && b64.trim().length > 20) {
      rawContent = Buffer.from(b64.trim(), 'base64').toString('utf8');
    } else {
      const rawEnv = process.env.YOUTUBE_COOKIES || process.env.YTDLP_COOKIES;
      if (rawEnv && rawEnv.trim().length > 20) {
        // Fix common Render issue where newlines get escaped as literal '\n'
        rawContent = rawEnv.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
      }
    }

    if (rawContent && rawContent.length > 50) {
      const tempTarget = path.join(os.tmpdir(), 'clipflow_yt_cookies.txt');
      fs.writeFileSync(tempTarget, rawContent, { encoding: 'utf8', mode: 0o600 });
      if (!hasLoggedStatus) {
        console.log(`[YouTube Cookies] ✅ Loaded cookies from env to ${tempTarget} (${rawContent.length} bytes)`);
        hasLoggedStatus = true;
      }
      return tempTarget;
    }
  } catch (err) {
    console.warn('[YouTube Cookies] Failed to materialize cookies from environment variable:', err);
  }

  // 3. Check disk files in common locations
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'cookies.txt'),
    path.join(cwd, 'youtube-cookies.txt'),
    path.join(cwd, 'backend', 'cookies.txt'),
    path.join(cwd, '..', 'cookies.txt'),
    path.join(os.tmpdir(), 'clipflow_yt_cookies.txt'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).size > 50) {
      if (!hasLoggedStatus) {
        console.log(`[YouTube Cookies] ✅ Found local cookie file: ${c}`);
        hasLoggedStatus = true;
      }
      return c;
    }
  }

  if (!hasLoggedStatus) {
    console.warn('[YouTube Cookies] ⚠️ No YouTube cookies detected. Cloud/proxy requests may hit "Sign in to confirm you’re not a bot".');
    hasLoggedStatus = true;
  }

  return null;
}

/**
 * Returns formatted --cookies flag string if cookies file is available.
 * e.g. `--cookies "/tmp/clipflow_yt_cookies.txt" ` or `""`
 */
export function getYoutubeCookieArg(): string {
  const cookiePath = getYoutubeCookiesPath();
  return cookiePath ? `--cookies "${cookiePath}" ` : '';
}
