/**
 * ffmpeg.worker.ts
 *
 * Dedicated Web Worker for browser-side FFmpeg.wasm processing.
 * Runs trimming, cropping, aspect ratio conversions, scaling, and audio extraction
 * off the main UI thread with zero freeze or lag.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;
const logHistory: string[] = [];

export interface WorkerCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkerProcessPayload {
  jobId: string;
  inputData: Uint8Array;
  inputFileName?: string;
  outputFileName?: string;
  trimStart: number;
  duration: number;
  format: 'mp4' | 'mp3' | 'wav' | 'aac';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | 'custom' | string;
  fitMode?: 'crop' | 'pad';
  cropPosition?: 'center' | 'left' | 'right';
  cropBox?: WorkerCropBox;
  quality?: string;
  audioBitrate?: string;
}

/**
 * Initializes the FFmpeg.wasm instance, loading self-hosted core files from /ffmpeg/
 * with fallback to public CDN if needed.
 */
async function loadFFmpeg() {
  if (ffmpeg && isLoaded) return ffmpeg;

  const initFFmpeg = () => {
    const f = new FFmpeg();
    f.on('log', ({ message }) => {
      logHistory.push(message);
      if (logHistory.length > 100) logHistory.shift();
      console.log(`[FFmpeg.wasm Worker] ${message}`);
    });
    return f;
  };

  ffmpeg = initFFmpeg();

  // Load single-threaded FFmpeg wasm core from unpkg CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  try {
    console.log('[FFmpeg.wasm Worker] Loading core from CDN:', baseURL);
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    isLoaded = true;
    console.log('[FFmpeg.wasm Worker ✅] Loaded successfully from CDN');
    return ffmpeg;
  } catch (cdnErr: any) {
    console.warn('[FFmpeg.wasm Worker ⚠️] Primary CDN load failed, falling back to jsdelivr:', cdnErr?.message || cdnErr);

    // Fallback to jsdelivr CDN with fresh FFmpeg instance
    const fallbackURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    ffmpeg = initFFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    isLoaded = true;
    console.log('[FFmpeg.wasm Worker ✅] Loaded successfully from backup CDN');
    return ffmpeg;
  }
}

/**
 * Computes exact pixel dimensions for requested aspect ratio and target quality.
 */
function computeTargetDimensions(
  aspectRatio: string = '16:9',
  quality: string = '1080p'
): { width: number; height: number } {
  const cleanQ = parseInt(quality.replace(/[^\d]/g, ''), 10) || 1080;

  if (aspectRatio === '9:16') {
    // 9:16 Vertical (Shorts / Reels / TikTok): width matches resolution standard (e.g. 1080x1920, 720x1280)
    const w = cleanQ;
    const h = Math.round((cleanQ * 16) / 9 / 2) * 2;
    return { width: w, height: h };
  } else if (aspectRatio === '1:1') {
    // 1:1 Square
    return { width: cleanQ, height: cleanQ };
  } else if (aspectRatio === '4:5') {
    // 4:5 Portrait
    const w = cleanQ;
    const h = Math.round((cleanQ * 5) / 4 / 2) * 2;
    return { width: w, height: h };
  } else {
    // 16:9 Landscape standard
    const h = cleanQ;
    const w = Math.round((cleanQ * 16) / 9 / 2) * 2;
    return { width: w, height: h };
  }
}

/**
 * Generates the FFmpeg video filter for cropping, aspect ratio padding, and resolution scaling.
 */
function buildVideoFilter(
  aspectRatio?: string,
  fitMode: 'crop' | 'pad' = 'pad',
  cropPosition: 'center' | 'left' | 'right' = 'center',
  cropBox?: WorkerCropBox,
  quality?: string
): string {
  const filters: string[] = [];

  const hasValidCropBox = !!(cropBox && cropBox.width > 0 && cropBox.height > 0);
  const isCustom = aspectRatio === 'custom';
  const isSubFrame = hasValidCropBox && (cropBox.width < 0.999 || cropBox.height < 0.999 || cropBox.x > 0.001 || cropBox.y > 0.001);

  // 1. Custom mode or Interactive Framing Crop Box
  if (hasValidCropBox && (isCustom || (fitMode === 'crop' && isSubFrame))) {
    const w = Math.min(1, Math.max(0.05, cropBox.width)).toFixed(4);
    const h = Math.min(1, Math.max(0.05, cropBox.height)).toFixed(4);
    const x = Math.min(1, Math.max(0, cropBox.x)).toFixed(4);
    const y = Math.min(1, Math.max(0, cropBox.y)).toFixed(4);
    filters.push(`crop=trunc(iw*${w}/2)*2:trunc(ih*${h}/2)*2:trunc(iw*${x}/2)*2:trunc(ih*${y}/2)*2`);
  } else if (isCustom) {
    // Custom aspect ratio fallback if no cropBox coordinates provided
    filters.push('crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2');
  }
  // 2. Aspect Ratio Presets
  else if (aspectRatio && aspectRatio !== '16:9' && aspectRatio !== 'original') {
    if (aspectRatio === '9:16') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? '(iw-out_w)' : '(iw-out_w)/2';
        filters.push(`crop=trunc(min(iw\\,ih*9/16)/2)*2:trunc(min(ih\\,iw*16/9)/2)*2:${xOffset}:(ih-out_h)/2`);
      } else {
        // Fit mode: pad to exact 9:16 aspect ratio with top/bottom black letterboxing
        filters.push(`pad=trunc(max(iw\\,ih*9/16)/2)*2:trunc(max(ih\\,iw*16/9)/2)*2:(ow-iw)/2:(oh-ih)/2:black`);
      }
    } else if (aspectRatio === '1:1') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? '(iw-out_w)' : '(iw-out_w)/2';
        filters.push(`crop=trunc(min(iw\\,ih)/2)*2:trunc(min(iw\\,ih)/2)*2:${xOffset}:(ih-out_h)/2`);
      } else {
        filters.push(`pad=trunc(max(iw\\,ih)/2)*2:trunc(max(iw\\,ih)/2)*2:(ow-iw)/2:(oh-ih)/2:black`);
      }
    } else if (aspectRatio === '4:5') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? '(iw-out_w)' : '(iw-out_w)/2';
        filters.push(`crop=trunc(min(iw\\,ih*4/5)/2)*2:trunc(min(ih\\,iw*5/4)/2)*2:${xOffset}:(ih-out_h)/2`);
      } else {
        filters.push(`pad=trunc(max(iw\\,ih*4/5)/2)*2:trunc(max(ih\\,iw*5/4)/2)*2:(ow-iw)/2:(oh-ih)/2:black`);
      }
    }
  }

  // 3. Exact Target Quality Scaling (ensures output pixel dimensions match user selection)
  const isNatural16x9 = !aspectRatio || aspectRatio === '16:9' || aspectRatio === 'original';
  if (quality && quality !== 'source' && quality !== 'best' && quality !== 'original' && (!isNatural16x9 || filters.length > 0)) {
    const target = computeTargetDimensions(aspectRatio, quality);
    filters.push(`scale=${target.width}:${target.height}`);
  }

  return filters.join(',');
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'PROCESS_CLIP') {
    const {
      jobId,
      inputData,
      outputFileName = 'clip.mp4',
      trimStart = 0,
      duration = 60,
      format = 'mp4',
      aspectRatio,
      fitMode = 'pad',
      cropPosition = 'center',
      cropBox,
      quality,
      audioBitrate = '192k',
    }: WorkerProcessPayload = payload;

    const isInputMp4 =
      (payload.inputFileName && payload.inputFileName.endsWith('.mp4')) ||
      (inputData.length >= 8 &&
        ((inputData[4] === 0x66 && inputData[5] === 0x74 && inputData[6] === 0x79 && inputData[7] === 0x70) || // ftyp
         (inputData[4] === 0x6d && inputData[5] === 0x6f && inputData[6] === 0x6f && inputData[7] === 0x76) || // moov
         (inputData[4] === 0x6d && inputData[5] === 0x6f && inputData[6] === 0x6f && inputData[7] === 0x66))); // moof

    const internalInput = isInputMp4 ? 'input.mp4' : 'input.ts';
    const isAudio = format === 'mp3' || format === 'wav' || format === 'aac';
    const internalOutput = isAudio ? `output.${format}` : 'output.mp4';

    try {
      self.postMessage({
        type: 'PROGRESS',
        jobId,
        percent: 48,
        message: 'Initializing video engine...',
      });

      const instance = await loadFFmpeg();

      // Write raw input .ts segment bytes to FFmpeg virtual filesystem
      self.postMessage({
        type: 'PROGRESS',
        jobId,
        percent: 52,
        message: 'Writing video stream to memory...',
      });

      await instance.writeFile(internalInput, inputData);

      // Track FFmpeg progress events during transcode / mux
      const progressHandler = ({ progress, time }: { progress: number; time: number }) => {
        let percent = Math.min(92, Math.round(55 + progress * 35));
        if (isNaN(percent) && duration > 0 && time > 0) {
          const ratio = Math.min(1, (time / 1000000) / duration);
          percent = Math.min(92, Math.round(55 + ratio * 35));
        }
        self.postMessage({
          type: 'PROGRESS',
          jobId,
          percent: percent || 65,
          message: `Encoding & trimming video (${percent || 65}%)...`,
        });
      };

      instance.on('progress', progressHandler);

      const safeAudioBitrate = String(audioBitrate).endsWith('k') ? audioBitrate : '192k';
      const filter = !isAudio ? buildVideoFilter(aspectRatio, fitMode, cropPosition, cropBox, quality) : '';

      // Robust argument order for MPEG-TS streams:
      // Place input first with error tolerance, then seek offset and duration to prevent PTS mismatches
      const args: string[] = [
        '-err_detect', 'ignore_err',
        '-fflags', '+genpts+discardcorrupt',
        '-i', internalInput,
        '-ss', Math.max(0, trimStart).toFixed(3),
        '-t', Math.max(0.1, duration).toFixed(3),
      ];

      if (isAudio) {
        args.push('-avoid_negative_ts', 'make_zero');
        if (format === 'wav') {
          args.push('-vn', '-c:a', 'pcm_s16le', internalOutput);
        } else if (format === 'aac') {
          args.push('-vn', '-c:a', 'aac', '-b:a', safeAudioBitrate, internalOutput);
        } else {
          args.push('-vn', '-c:a', 'libmp3lame', '-b:a', safeAudioBitrate, internalOutput);
        }
      } else {
        if (filter) {
          args.push('-vf', filter);
        }
        args.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '21',
          '-pix_fmt', 'yuv420p',
          '-max_muxing_queue_size', '1024',
          '-c:a', 'aac',
          '-b:a', safeAudioBitrate,
          '-map', '0:v:0',
          '-map', '0:a:0?',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          internalOutput
        );
      }

      // ── FAST STREAM COPY PATH (Default 16:9 / No Filter) ───────────────────
      if (!isAudio && !filter) {
        self.postMessage({
          type: 'PROGRESS',
          jobId,
          percent: 60,
          message: 'Fast muxing trimmed clip (lossless stream copy)...',
        });
        const fastCopyArgs = [
          '-err_detect', 'ignore_err',
          '-fflags', '+genpts+discardcorrupt',
          '-i', internalInput,
          '-ss', Math.max(0, trimStart).toFixed(3),
          '-t', Math.max(0.1, duration).toFixed(3),
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', safeAudioBitrate,
          '-map', '0:v:0',
          '-map', '0:a:0?',
          '-avoid_negative_ts', 'make_zero',
          '-movflags', '+faststart',
          internalOutput,
        ];
        console.log(`[FFmpeg.wasm Worker 🚀] Executing fast stream copy args:\n${fastCopyArgs.join(' ')}`);
        const copyCode = await instance.exec(fastCopyArgs);
        if (copyCode === 0) {
          console.log('[FFmpeg.wasm Worker] ✅ Fast stream copy succeeded in milliseconds!');
          self.postMessage({
            type: 'PROGRESS',
            jobId,
            percent: 95,
            message: 'Finalizing clip file...',
          });
          const outputData = (await instance.readFile(internalOutput)) as Uint8Array;
          try {
            await instance.deleteFile(internalInput);
            await instance.deleteFile(internalOutput);
          } catch {}
          (self as unknown as Worker).postMessage(
            {
              type: 'COMPLETE',
              jobId,
              outputData,
              outputFileName,
              format,
            },
            [outputData.buffer]
          );
          return;
        }
        console.warn('[FFmpeg.wasm Worker] Fast copy returned non-zero code', copyCode, '- falling back to transcode');
        try { await instance.deleteFile(internalOutput); } catch {}
      }

      console.log(`[FFmpeg.wasm Worker 🚀] Executing transcode args:\n${args.join(' ')}`);

      self.postMessage({
        type: 'PROGRESS',
        jobId,
        percent: 60,
        message: isAudio ? 'Extracting audio track...' : 'Rendering clip in browser...',
      });

      const exitCode = await instance.exec(args);

      if (exitCode !== 0) {
        const errorDetails = logHistory.slice(-10).join('\n');
        throw new Error(`FFmpeg process returned non-zero exit code: ${exitCode}\n${errorDetails}`);
      }

      self.postMessage({
        type: 'PROGRESS',
        jobId,
        percent: 94,
        message: 'Finalizing clip file...',
      });

      // Read output file from virtual FS
      const outputData = (await instance.readFile(internalOutput)) as Uint8Array;

      // Clean up virtual filesystem memory
      try {
        await instance.deleteFile(internalInput);
        await instance.deleteFile(internalOutput);
      } catch (_) { }

      // Transfer Uint8Array buffer back to main thread
      (self as unknown as Worker).postMessage(
        {
          type: 'COMPLETE',
          jobId,
          outputData,
          outputFileName,
          format,
        },
        // Transfer buffer ownership to avoid memory cloning overhead
        [outputData.buffer]
      );
    } catch (err: any) {
      console.error('[FFmpeg.wasm Worker ❌ Error]', err);
      self.postMessage({
        type: 'ERROR',
        jobId,
        error: err.message || 'Video processing failed in browser',
      });
    }
  }
};
