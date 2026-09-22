import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

let cachedYtDlp: string | null = null;
let cachedFFmpeg: string | null = null;

const isWin = process.platform === 'win32';
const ytName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const ffName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

export function resolveYtDlpBinary(): string {
  if (cachedYtDlp && fs.existsSync(cachedYtDlp)) return cachedYtDlp;

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'bin', ytName),
    path.join(cwd, 'backend', 'bin', ytName),
    path.join(cwd, 'backend', 'node_modules', 'yt-dlp-exec', 'bin', ytName),
    path.join(cwd, 'node_modules', 'yt-dlp-exec', 'bin', ytName),
    path.join(cwd, 'backend', ytName),
    path.join(cwd, ytName),
    path.join(cwd, 'qt-app', 'bin', ytName),
  ];

  if (!isWin) {
    // Also check standard Linux locations
    candidates.push(
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      path.join(process.env.HOME || '', '.local', 'bin', 'yt-dlp')
    );
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      if (!isWin) {
        try { fs.chmodSync(c, 0o755); } catch {}
      }
      cachedYtDlp = c;
      return c;
    }
  }

  // Probe system PATH
  try {
    const cmd = isWin ? 'where.exe yt-dlp' : 'which yt-dlp';
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      cachedYtDlp = firstLine;
      return firstLine;
    }
  } catch {}

  // If still missing and running on Linux / Render, try fast standalone download to ./bin/yt-dlp
  try {
    const targetDir = path.join(cwd, 'bin');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, ytName);
    console.warn(`[BinaryResolver] ⚠️ yt-dlp not found on disk or PATH, attempting auto-download to ${targetPath}...`);
    execSync(`curl -L -s https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytName} -o "${targetPath}"`, { stdio: 'ignore' });
    if (fs.existsSync(targetPath)) {
      if (!isWin) fs.chmodSync(targetPath, 0o755);
      cachedYtDlp = targetPath;
      return targetPath;
    }
  } catch {}

  cachedYtDlp = 'yt-dlp';
  return 'yt-dlp';
}

export function resolveFFmpegBinary(): string {
  if (cachedFFmpeg && fs.existsSync(cachedFFmpeg)) return cachedFFmpeg;

  // 1. Probe system PATH first
  try {
    const cmd = isWin ? 'where.exe ffmpeg' : 'which ffmpeg';
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      cachedFFmpeg = firstLine;
      return firstLine;
    }
  } catch {}

  // 2. Use @ffmpeg-installer/ffmpeg prebuilt binary
  try {
    const installerPath = ffmpegInstaller?.path;
    if (installerPath && fs.existsSync(installerPath)) {
      if (!isWin) {
        try { fs.chmodSync(installerPath, 0o755); } catch {}
      }
      cachedFFmpeg = installerPath;
      return installerPath;
    }
  } catch {}

  // 3. Check local candidate paths
  const cwd = process.cwd();
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(cwd, 'bin', ffName),
    path.join(cwd, 'backend', 'bin', ffName),
    path.join(cwd, 'backend', ffName),
    path.join(cwd, ffName),
    path.join(cwd, 'qt-app', 'bin', ffName),
    path.join(localAppData, 'Programs', 'ClipFlow', 'bin', ffName),
    path.join(localAppData, 'ClipFlow', 'bin', ffName),
  ];

  if (!isWin) {
    candidates.push('/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg');
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      if (!isWin) {
        try { fs.chmodSync(c, 0o755); } catch {}
      }
      cachedFFmpeg = c;
      return c;
    }
  }

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
