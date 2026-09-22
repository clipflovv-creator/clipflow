import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const ytDlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const binDir = path.join(backendRoot, 'bin');

// How old (ms) before we force-refresh the binary
const MAX_BINARY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Downloads a URL following 301/302 redirects to destination path.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'yt-dlp-updater/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      const tmp = destPath + '.tmp';
      const fileStream = fs.createWriteStream(tmp);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => {
          try { fs.renameSync(tmp, destPath); } catch { fs.copyFileSync(tmp, destPath); fs.unlinkSync(tmp); }
          resolve(destPath);
        });
      });
      fileStream.on('error', (err) => {
        try { fs.unlinkSync(tmp); } catch {}
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function isBinaryStale(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return (Date.now() - stat.mtimeMs) > MAX_BINARY_AGE_MS;
  } catch {
    return true;
  }
}

async function downloadLatestYtDlp(targetPath) {
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpName}`;
  console.log(`[ensure-binaries] ⬇️ Downloading latest yt-dlp from GitHub releases...`);
  await downloadFile(downloadUrl, targetPath);
  if (!isWin) fs.chmodSync(targetPath, 0o755);
  // Verify
  try {
    const ver = execSync(`"${targetPath}" --version`, { encoding: 'utf8', timeout: 10000 }).trim();
    console.log(`[ensure-binaries] ✅ yt-dlp ${ver} downloaded to: ${targetPath}`);
  } catch {
    console.log(`[ensure-binaries] ✅ yt-dlp downloaded to: ${targetPath}`);
  }
  return targetPath;
}

async function ensureYtDlp() {
  console.log('[ensure-binaries] 🔍 Checking yt-dlp availability...');

  // On Linux (cloud/Render), always use our managed binary in ./bin/ to ensure latest version.
  // The yt-dlp-exec bundled binary is typically months old and fails with modern YouTube.
  if (!isWin) {
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    const managedBin = path.join(binDir, ytDlpName);
    const needsUpdate = !fs.existsSync(managedBin) || isBinaryStale(managedBin);
    if (needsUpdate) {
      try {
        await downloadLatestYtDlp(managedBin);
        return managedBin;
      } catch (err) {
        console.warn(`[ensure-binaries] ⚠️ Could not download latest yt-dlp: ${err.message}`);
      }
    } else {
      if (!isWin) { try { fs.chmodSync(managedBin, 0o755); } catch {} }
      try {
        const ver = execSync(`"${managedBin}" --version`, { encoding: 'utf8', timeout: 10000 }).trim();
        console.log(`[ensure-binaries] ✅ Found managed yt-dlp ${ver}: ${managedBin}`);
      } catch {
        console.log(`[ensure-binaries] ✅ Found managed yt-dlp: ${managedBin}`);
      }
      return managedBin;
    }
  }

  // Windows dev: check system PATH first
  try {
    const probeCmd = isWin ? 'where.exe yt-dlp' : 'which yt-dlp';
    const out = execSync(probeCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    if (first && fs.existsSync(first)) {
      console.log(`[ensure-binaries] ✅ Found yt-dlp in system PATH: ${first}`);
      return first;
    }
  } catch {}

  // Windows: check candidate local directories
  const candidateDirs = [
    binDir,
    path.join(backendRoot, 'node_modules', 'yt-dlp-exec', 'bin'),
    backendRoot,
  ];
  for (const dir of candidateDirs) {
    const filePath = path.join(dir, ytDlpName);
    if (fs.existsSync(filePath)) {
      console.log(`[ensure-binaries] ✅ Found local yt-dlp: ${filePath}`);
      return filePath;
    }
  }

  // Last resort: download
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  const targetPath = path.join(binDir, ytDlpName);
  try {
    await downloadLatestYtDlp(targetPath);
    return targetPath;
  } catch (err) {
    console.error(`[ensure-binaries] ❌ Failed to download yt-dlp:`, err.message);
    return null;
  }
}

async function checkFFmpeg() {
  console.log('[ensure-binaries] 🔍 Checking FFmpeg availability...');
  try {
    const probeCmd = isWin ? 'where.exe ffmpeg' : 'which ffmpeg';
    const out = execSync(probeCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    if (first && fs.existsSync(first)) {
      console.log(`[ensure-binaries] ✅ Found system FFmpeg: ${first}`);
      return first;
    }
  } catch {}

  try {
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    const installerPath = ffmpegInstaller.default?.path || ffmpegInstaller.path;
    if (installerPath && fs.existsSync(installerPath)) {
      console.log(`[ensure-binaries] ✅ Found @ffmpeg-installer/ffmpeg binary: ${installerPath}`);
      return installerPath;
    }
  } catch (err) {
    console.warn(`[ensure-binaries] ⚠️ @ffmpeg-installer/ffmpeg not loaded:`, err.message);
  }

  return null;
}

async function main() {
  try {
    await ensureYtDlp();
    await checkFFmpeg();
  } catch (e) {
    console.error('[ensure-binaries] Error during binary verification:', e);
  }
}

main();
