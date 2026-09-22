import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

let cachedYtDlp: string | null = null;
let cachedFFmpeg: string | null = null;

export function resolveYtDlpBinary(): string {
  if (cachedYtDlp) return cachedYtDlp;

  const candidates = [
    path.join(process.cwd(), 'backend', 'yt-dlp.exe'),
    path.join(process.cwd(), 'yt-dlp.exe'),
    path.join(process.cwd(), 'backend', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe'),
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe'),
    path.join(process.cwd(), 'qt-app', 'bin', 'yt-dlp.exe'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedYtDlp = c;
      return c;
    }
  }

  // Probe system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where.exe yt-dlp' : 'which yt-dlp';
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      cachedYtDlp = firstLine;
      return firstLine;
    }
  } catch {}

  cachedYtDlp = 'yt-dlp';
  return 'yt-dlp';
}

export function resolveFFmpegBinary(): string {
  if (cachedFFmpeg) return cachedFFmpeg;

  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(process.cwd(), 'backend', 'ffmpeg.exe'),
    path.join(process.cwd(), 'ffmpeg.exe'),
    path.join(process.cwd(), 'qt-app', 'bin', 'ffmpeg.exe'),
    path.join(localAppData, 'Programs', 'ClipFlow', 'bin', 'ffmpeg.exe'),
    path.join(localAppData, 'ClipFlow', 'bin', 'ffmpeg.exe'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedFFmpeg = c;
      return c;
    }
  }

  // Probe system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where.exe ffmpeg' : 'which ffmpeg';
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      cachedFFmpeg = firstLine;
      return firstLine;
    }
  } catch {}

  cachedFFmpeg = 'ffmpeg';
  return 'ffmpeg';
}

/**
 * Returns `--ffmpeg-location "<dir>"` only if ffmpegBin is an absolute path.
 * If ffmpegBin is just 'ffmpeg' or empty, returns empty string so yt-dlp searches PATH.
 */
export function getFFmpegLocationFlag(ffmpegBin?: string): string {
  const bin = ffmpegBin || resolveFFmpegBinary();
  if (bin && path.isAbsolute(bin)) {
    return `--ffmpeg-location "${path.dirname(bin)}"`;
  }
  return '';
}
