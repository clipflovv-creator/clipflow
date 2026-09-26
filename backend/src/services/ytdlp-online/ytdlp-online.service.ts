/**
 * ytdlp-online.service.ts
 *
 * PRIMARY stream-URL resolver — calls ytdlp.online API over native HTTP/2 (node:http2).
 * Returns direct video/audio CDN URLs (googlevideo.com) that can be piped
 * through our existing HLS-proxy / download pipeline.
 *
 * Architecture:
 *   ytdlp.online (MAIN) ──→ fails / error ──→ local yt-dlp.exe (FALLBACK)
 *
 * Rate limit: Tracked by _sid cookie ONLY — not IP, not UA, not TLS fingerprint.
 * Strategy: Auto-mint new sessions on demand via a cookieless homepage request over HTTP/2.
 * Each minted _sid provides 5 free high-speed stream extractions.
 */

import http2 from 'http2';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger.util.js';

// ─── Error Classes ─────────────────────────────────────────────────────────────

export class YtdlpOnlineRateLimitError extends Error {
  constructor(msg = 'ytdlp.online: all sessions exhausted and failed to mint a new one') {
    super(msg);
    this.name = 'YtdlpOnlineRateLimitError';
  }
}

export class YtdlpOnlineError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'YtdlpOnlineError';
  }
}

// ─── Result Type ───────────────────────────────────────────────────────────────

export interface YtdlpOnlineResult {
  /** HLS manifest or best video CDN URL */
  videoUrl: string | null;
  /** Separate audio-only URL (webm/opus from googlevideo) */
  audioUrl: string | null;
  /** All raw URLs returned in the SSE stream */
  allUrls: string[];
  /** Clean log lines from the SSE output (HTML stripped) */
  log: string[];
}

// ─── Session Store ─────────────────────────────────────────────────────────────

export interface SessionEntry {
  sid: string;
  sessionCookie: string; // Flask JWT
  usedCount: number;
  createdAt: number;
  exhausted: boolean;
}

function getSessionStorePath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'ytdlp-online-sessions.json'),
    path.join(process.cwd(), 'backend', 'data', 'ytdlp-online-sessions.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.dirname(p))) return p;
  }
  return candidates[0];
}

function loadSessions(): SessionEntry[] {
  try {
    const p = getSessionStorePath();
    if (fs.existsSync(p)) {
      const list: SessionEntry[] = JSON.parse(fs.readFileSync(p, 'utf8'));
      // Auto-reset sessions older than 24 hours (daily limit reset)
      const now = Date.now();
      let changed = false;
      for (const s of list) {
        if (now - s.createdAt > 24 * 60 * 60 * 1000 && (s.exhausted || s.usedCount > 0)) {
          s.usedCount = 0;
          s.exhausted = false;
          s.createdAt = now;
          changed = true;
        }
      }
      if (changed) saveSessions(list);
      return list;
    }
  } catch {}
  return [];
}

function saveSessions(sessions: SessionEntry[]) {
  try {
    const p = getSessionStorePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(sessions, null, 2));
  } catch (err) {
    logger.error({
      context: 'YtdlpOnline:SessionStore',
      summary: 'Failed to write session file to disk',
      error: err,
    });
  }
}

function getActiveSession(): SessionEntry | null {
  // 1. High priority: User-configured registered account session from environment
  const envSession = process.env.YTDLP_ONLINE_SESSION?.trim();
  const envSid = process.env.YTDLP_ONLINE_SID?.trim();
  if (envSession && envSid) {
    return {
      sid: envSid,
      sessionCookie: envSession,
      usedCount: 0,
      createdAt: Date.now(),
      exhausted: false,
    };
  }

  return loadSessions().find((s) => !s.exhausted && s.usedCount < 5) ?? null;
}

function markSessionUsed(sid: string, exhausted = false) {
  const sessions = loadSessions();
  const entry = sessions.find((s) => s.sid === sid);
  if (entry) {
    entry.usedCount += 1;
    if (exhausted || entry.usedCount >= 5) entry.exhausted = true;
    saveSessions(sessions);
    const remaining = Math.max(0, 5 - entry.usedCount);
    logger.info('YtdlpOnline', `Session _sid=${sid.slice(0, 8)}... used=${entry.usedCount}/5 remaining=${remaining}`);
  }
}

function upsertSession(sid: string, sessionCookie: string): boolean {
  const sessions = loadSessions();
  const existing = sessions.find((s) => s.sid === sid);
  if (existing) {
    existing.sessionCookie = sessionCookie;
    saveSessions(sessions);
    return false;
  }
  sessions.push({ sid, sessionCookie, usedCount: 0, createdAt: Date.now(), exhausted: false });
  saveSessions(sessions);
  logger.info('YtdlpOnline', `New session stored: _sid=${sid.slice(0, 8)}... (${sessions.length} total)`);
  return true;
}

// ─── Native HTTP/2 Client ──────────────────────────────────────────────────────

interface H2Response {
  status: number;
  headers: http2.IncomingHttpHeaders;
  body: string;
}

function requestHttp2(
  requestPath: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<H2Response> {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || 45_000;

  return new Promise((resolve, reject) => {
    let client: http2.ClientHttp2Session | null = null;
    let timer: NodeJS.Timeout | null = null;
    let req: http2.ClientHttp2Stream | null = null;
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (client && !client.closed) {
        try { client.close(); } catch (_) {}
      }
    };

    try {
      client = http2.connect('https://ytdlp.online');
    } catch (err) {
      return reject(err);
    }

    client.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new YtdlpOnlineError(`HTTP/2 request timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const reqHeaders: http2.OutgoingHttpHeaders = {
      ':method': method,
      ':path': requestPath,
      ':authority': 'ytdlp.online',
      ':scheme': 'https',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      'referer': 'https://ytdlp.online/',
      ...(options.headers || {}),
    };

    try {
      req = client.request(reqHeaders);
    } catch (err) {
      cleanup();
      return reject(err);
    }

    let resHeaders: http2.IncomingHttpHeaders = {};
    let body = '';

    req.on('response', (headers) => {
      resHeaders = headers;
    });

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!settled) {
        settled = true;
        cleanup();
        const status = Number(resHeaders[':status'] || 0);
        resolve({ status, headers: resHeaders, body });
      }
    });

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    req.end();
  });
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class YtdlpOnlineService {
  /**
   * GET the ytdlp.online homepage with NO cookies over HTTP/2.
   * Server returns fresh _sid and session cookies in Set-Cookie.
   */
  static async mintFreshSession(): Promise<SessionEntry | null> {
    logger.info('YtdlpOnline', 'Minting fresh session (cookieless HTTP/2 request)...');

    try {
      const res = await requestHttp2('/', {
        method: 'GET',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'cache-control': 'no-cache',
        },
        timeoutMs: 15_000,
      });

      const setCookies = res.headers['set-cookie'];
      const cookieLines = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];

      let newSid: string | null = null;
      let newSession: string | null = null;

      for (const line of cookieLines) {
        const parts = line.split(';');
        const first = parts[0]?.trim() || '';
        if (first.startsWith('_sid=')) {
          newSid = first.replace('_sid=', '').trim();
        }
        if (first.startsWith('session=')) {
          newSession = first.replace('session=', '').trim();
        }
      }

      if (newSid && newSession) {
        upsertSession(newSid, newSession);
        return getActiveSession();
      }

      logger.warn('YtdlpOnline', 'Homepage did not return _sid / session cookies');
      return null;
    } catch (err: any) {
      logger.error({
        context: 'YtdlpOnline:MintSession',
        summary: 'Failed to mint fresh session from ytdlp.online',
        reason: 'Network or Cloudflare error during initial handshake',
        error: err,
        fallbackAction: 'Will attempt fallback or retry next cycle',
      });
      return null;
    }
  }

  /**
   * Resolve direct CDN stream URLs via ytdlp.online SSE API.
   * Auto-mints a fresh session when needed, and auto-rotates if a session expires mid-flight.
   */
  static async getStreamUrls(targetUrl: string, retryCount = 0): Promise<YtdlpOnlineResult> {
    let session = getActiveSession();

    if (!session) {
      logger.info('YtdlpOnline', 'No active session available — auto-minting new session...');
      session = await YtdlpOnlineService.mintFreshSession();
      if (!session) {
        throw new YtdlpOnlineRateLimitError();
      }
    }

    const jobId = randomUUID();
    const encodedCmd = encodeURIComponent(`--get-url -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b" ${targetUrl}`);
    const ssePath = `/api/v1/stream?command=${encodedCmd}&job_id=${jobId}&source=index&engine=nightly`;

    const cookieStr = `_sid=${session.sid}; session=${session.sessionCookie}`;

    logger.info('YtdlpOnline', `Dispatching SSE stream request (job_id=${jobId.slice(0, 8)}... _sid=${session.sid.slice(0, 8)}...)`);

    let res: H2Response;
    try {
      res = await requestHttp2(ssePath, {
        method: 'GET',
        headers: {
          'accept': 'text/event-stream',
          'cache-control': 'no-cache',
          'cookie': cookieStr,
          'sec-fetch-mode': 'cors',
          'sec-fetch-dest': 'empty',
        },
        timeoutMs: 65_000,
      });
    } catch (err: any) {
      logger.error({
        context: 'YtdlpOnline:Stream',
        summary: 'HTTP/2 stream request failed',
        reason: 'Connection interrupted or timeout exceeded',
        targetUrl,
        error: err,
        fallbackAction: 'Triggering local yt-dlp fallback',
      });
      throw new YtdlpOnlineError(`HTTP/2 request error: ${err?.message || String(err)}`);
    }

    try {
      return YtdlpOnlineService.parseResponse(res, session.sid, targetUrl);
    } catch (err: any) {
      const isIpLimit = err instanceof YtdlpOnlineRateLimitError && err.message?.includes('Anonymous daily limit reached on this IP');
      if (err instanceof YtdlpOnlineRateLimitError && !isIpLimit && retryCount < 2) {
        logger.info('YtdlpOnline', `Session hit rate-limit (attempt ${retryCount + 1}/2) — auto-minting new session and retrying...`);
        const newSession = await YtdlpOnlineService.mintFreshSession();
        if (newSession) {
          return YtdlpOnlineService.getStreamUrls(targetUrl, retryCount + 1);
        }
      }
      throw err;
    }
  }

  // ─── Parse HTTP/2 Response & SSE Stream ──────────────────────────────────────

  private static parseResponse(res: H2Response, currentSid: string, targetUrl: string): YtdlpOnlineResult {
    // 1. Capture any updated Set-Cookie headers
    const setCookies = res.headers['set-cookie'];
    const cookieLines = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    let newSid: string | null = null;
    let newSession: string | null = null;

    for (const line of cookieLines) {
      const parts = line.split(';');
      const first = parts[0]?.trim() || '';
      if (first.startsWith('_sid=')) newSid = first.replace('_sid=', '').trim();
      if (first.startsWith('session=')) newSession = first.replace('session=', '').trim();
    }
    if (newSid && newSession) upsertSession(newSid, newSession);

    // 2. Parse X-Ratelimit-Remaining
    const rawRemaining = res.headers['x-ratelimit-remaining'];
    if (rawRemaining !== undefined) {
      const remaining = parseInt(String(rawRemaining), 10);
      logger.info('YtdlpOnline', `Server reports X-Ratelimit-Remaining: ${remaining}`);

      const sessions = loadSessions();
      const entry = sessions.find((s) => s.sid === currentSid);
      if (entry) {
        entry.usedCount = Math.max(0, 5 - remaining);
        entry.exhausted = remaining === 0;
        saveSessions(sessions);
      }
    }

    // 3. Check for Rate Limit (HTTP 429 or SSE limit message)
    const isIpLimit = res.body.includes('Daily launch limit reached');
    if (res.status === 429 || res.headers['x-ratelimit-remaining'] === '0' || isIpLimit) {
      logger.warn('YtdlpOnline', `Session quota exhausted on server (_sid=${currentSid.slice(0, 8)}... isIpLimit=${isIpLimit})`);
      markSessionUsed(currentSid, true);
      if (isIpLimit) {
        throw new YtdlpOnlineRateLimitError('ytdlp.online: Anonymous daily limit reached on this IP (5 tasks/day). Reconnect VPN or configure YTDLP_ONLINE_SESSION in .env.');
      }
      throw new YtdlpOnlineRateLimitError();
    }

    if (res.status !== 200) {
      logger.error({
        context: 'YtdlpOnline:HttpStatus',
        summary: `ytdlp.online returned non-200 status code: ${res.status}`,
        code: res.status,
        reason: res.body.slice(0, 150),
        targetUrl,
        fallbackAction: 'Falling back to local yt-dlp',
      });
      throw new YtdlpOnlineError(`ytdlp.online HTTP error ${res.status}`);
    }

    // 4. Parse SSE data lines
    logger.info('YtdlpOnline', `SSE raw body received (${res.body.length} bytes): ${res.body.slice(0, 400)}`);
    const lines = res.body.split(/\r?\n/);
    const allUrls: string[] = [];
    const log: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const dataVal = trimmed.slice('data:'.length).trim();
      if (!dataVal || dataVal === '{}') continue;

      const clean = dataVal
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      log.push(clean);
      if (clean.startsWith('https://')) {
        allUrls.push(clean);
      }
    }

    if (allUrls.length === 0) {
      const done = log.some((l) => l.includes('Command execution completed'));
      const reasonMsg = done
        ? 'ytdlp.online returned no URLs (video may be restricted or private)'
        : 'Empty or malformed SSE payload from ytdlp.online';

      logger.error({
        context: 'YtdlpOnline:Extraction',
        summary: 'No playable stream URLs returned from online extraction',
        reason: reasonMsg,
        targetUrl,
        fallbackAction: 'Falling back to local yt-dlp extraction',
      });

      throw new YtdlpOnlineError(reasonMsg);
    }

    markSessionUsed(currentSid);

    // 5. Classify URLs (HLS manifest / video vs audio)
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

    logger.info('YtdlpOnline', `Successfully resolved ${allUrls.length} URL(s) (video: ${Boolean(videoUrl)}, audio: ${Boolean(audioUrl)})`);
    return { videoUrl, audioUrl, allUrls, log };
  }

  // ─── Session Management Helpers ─────────────────────────────────────────────

  /** Manually inject a browser session */
  static addManualSession(sid: string, sessionCookie: string) {
    upsertSession(sid, sessionCookie);
  }

  /** Inspect all stored sessions */
  static listSessions(): SessionEntry[] {
    return loadSessions();
  }

  /** Wipe all stored sessions */
  static clearSessions() {
    saveSessions([]);
    logger.info('YtdlpOnline', 'All sessions wiped from storage');
  }
}
