declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    movie_timescale: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;
    type: 'video' | 'audio';
    audio?: {
      sample_rate: number;
      channel_count: number;
      sample_size: number;
    };
    video?: {
      width: number;
      height: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasMoov: boolean;
    tracks: MP4MediaTrack[];
    videoTracks: MP4MediaTrack[];
    audioTracks: MP4MediaTrack[];
  }

  export interface MP4Sample {
    track_id: number;
    number: number;
    data: Uint8Array;
    size: number;
    dts: number;
    pts: number;
    duration: number;
    cts: number;
    is_sync: boolean;
    is_rap?: boolean;
    timescale: number;
    description?: any;
    offset: number;
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (error: any) => void;
    onSamples?: (id: number, user: any, samples: MP4Sample[]) => void;
    onMoovStart?: () => void;
    onSegment?: (id: number, user: any, buffer: ArrayBuffer, sampleNum: number, is_last: boolean) => void;

    moov?: any;
    sidx?: any;
    onSidx?: (sidx: any) => void;
    getTrackById(id: number): any;
    appendBuffer(buffer: ArrayBuffer & { fileStart?: number }): number;
    start(): void;
    stop(): void;
    flush(): void;
    setExtractionOptions(trackId: number, user?: any, options?: { nbSamples?: number; rapAlignment?: boolean }): void;
    seek(time: number, useRap?: boolean): { offset: number; time: number };
    releaseUsedSamples(trackId: number, sampleNumber: number): void;
  }

  export function createFile(): MP4File;
  export class DataStream {
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
  }
}
