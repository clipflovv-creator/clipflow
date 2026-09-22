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

/**
 * Downloads a URL following 301/302 redirects to destination path.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return resolve(downloadFile(res.headers.location, destPath));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function ensureYtDlp() {
  console.log('[ensure-binaries] 🔍 Checking yt-dlp availability...');

  // 1. Check system PATH
  try {
    const probeCmd = isWin ? 'where.exe yt-dlp' : 'which yt-dlp';
    const out = execSync(probeCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    if (first && fs.existsSync(first)) {
      console.log(`[ensure-binaries] ✅ Found yt-dlp in system PATH: ${first}`);
      return first;
    }
  } catch {}

  // 2. Check candidate local directories
  const candidateDirs = [
    binDir,
    path.join(backendRoot, 'node_modules', 'yt-dlp-exec', 'bin'),
    backendRoot,
  ];

  for (const dir of candidateDirs) {
    const filePath = path.join(dir, ytDlpName);
    if (fs.existsSync(filePath)) {
      if (!isWin) {
        try {
          fs.chmodSync(filePath, 0o755);
        } catch {}
      }
      console.log(`[ensure-binaries] ✅ Found local yt-dlp: ${filePath}`);
      return filePath;
    }
  }

  // 3. Download standalone official binary from GitHub release
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const targetPath = path.join(binDir, ytDlpName);
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpName}`;
  console.log(`[ensure-binaries] ⬇️ Downloading latest ${ytDlpName} from GitHub releases...`);

  try {
    await downloadFile(downloadUrl, targetPath);
    if (!isWin) {
      fs.chmodSync(targetPath, 0o755);
    }
    console.log(`[ensure-binaries] ✅ yt-dlp successfully downloaded to: ${targetPath}`);
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
