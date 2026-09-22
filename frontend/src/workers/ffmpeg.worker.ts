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

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    logHistory.push(message);
    if (logHistory.length > 100) logHistory.shift();
    console.log(`[FFmpeg.wasm Worker] ${message}`);
  });

  try {
    // 1. Try local self-hosted core files first (instant load from public/ffmpeg)
    const origin = typeof location !== 'undefined' ? location.origin : '';
    const coreURL = `${origin}/ffmpeg/ffmpeg-core.js`;
    const wasmURL = `${origin}/ffmpeg/ffmpeg-core.wasm`;

    console.log('[FFmpeg.wasm Worker] Loading local core:', { coreURL, wasmURL });
    await ffmpeg.load({
      coreURL: await toBlobURL(coreURL, 'text/javascript'),
      wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
    });
    isLoaded = true;
    console.log('[FFmpeg.wasm Worker ✅] Loaded successfully from local origin');
    return ffmpeg;
  } catch (localErr: any) {
    console.warn('[FFmpeg.wasm Worker ⚠️] Local core load failed, falling back to CDN:', localErr.message);

    // 2. Fallback to unpkg CDN
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    isLoaded = true;
    console.log('[FFmpeg.wasm Worker ✅] Loaded successfully from CDN');
    return ffmpeg;
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

  // 1. Interactive Drag Crop Box Coordinates (only when custom crop or active sub-frame is defined)
  if (
    fitMode !== 'crop' &&
    cropBox &&
    cropBox.width > 0 &&
    cropBox.height > 0 &&
    (aspectRatio === 'custom' || (cropBox.width < 0.999 || cropBox.height < 0.999 || cropBox.x > 0.001 || cropBox.y > 0.001)) &&
    aspectRatio !== '16:9'
  ) {
    const w = Math.min(1, Math.max(0.05, cropBox.width)).toFixed(4);
    const h = Math.min(1, Math.max(0.05, cropBox.height)).toFixed(4);
    const x = Math.min(1, Math.max(0, cropBox.x)).toFixed(4);
    const y = Math.min(1, Math.max(0, cropBox.y)).toFixed(4);
    filters.push(`crop=trunc(iw*${w}/2)*2:trunc(ih*${h}/2)*2:trunc(iw*${x}/2)*2:trunc(ih*${y}/2)*2`);
  }
  // 2. Aspect Ratio Presets
  else if (aspectRatio && aspectRatio !== '16:9' && aspectRatio !== 'original') {
    if (aspectRatio === '9:16') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? 'iw-ih*9/16' : '(iw-ih*9/16)/2';
        filters.push(`crop=trunc(ih*9/16/2)*2:ih:trunc(${xOffset}/2)*2:0`);
      } else {
        filters.push(`scale=trunc(ih*9/16/2)*2:ih:force_original_aspect_ratio=decrease,pad=trunc(ih*9/16/2)*2:ih:(ow-iw)/2:(oh-ih)/2:black`);
      }
    } else if (aspectRatio === '1:1') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? 'iw-ih' : '(iw-ih)/2';
        filters.push(`crop=min(iw\\,ih):min(iw\\,ih):trunc(${xOffset}/2)*2:0`);
      } else {
        filters.push(`scale=min(iw\\,ih):min(iw\\,ih):force_original_aspect_ratio=decrease,pad=max(iw\\,ih):max(iw\\,ih):(ow-iw)/2:(oh-ih)/2:black`);
      }
    } else if (aspectRatio === '4:5') {
      if (fitMode === 'crop') {
        const xOffset = cropPosition === 'left' ? '0' : cropPosition === 'right' ? 'iw-ih*4/5' : '(iw-ih*4/5)/2';
        filters.push(`crop=trunc(ih*4/5/2)*2:ih:trunc(${xOffset}/2)*2:0`);
      } else {
        filters.push(`scale=trunc(ih*4/5/2)*2:ih:force_original_aspect_ratio=decrease,pad=trunc(ih*4/5/2)*2:ih:(ow-iw)/2:(oh-ih)/2:black`);
      }
    }
  }

  // 3. Target Quality Downscaling (e.g. 720p, 480p, 360p)
  if (quality && quality !== '1080p' && quality !== 'source' && quality !== 'best') {
    const targetHeight = parseInt(quality.replace(/[^\d]/g, ''), 10);
    if (!isNaN(targetHeight) && targetHeight < 1080 && targetHeight > 0) {
      filters.push(`scale=-2:${targetHeight}`);
    }
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

      console.log(`[FFmpeg.wasm Worker 🚀] Executing args:\n${args.join(' ')}`);

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
