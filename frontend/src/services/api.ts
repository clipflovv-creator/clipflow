/**
 * Centralized API Client for ClipFlow Frontend.
 *
 * All network calls, backend endpoints, and proxy URL generators must be defined here.
 * The backend base URL is dynamically read from Vite environment variables (VITE_BACKEND_URL).
 */

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

// ── Auth APIs ───────────────────────────────────────────────────────────────
export const authApi = {
  async getMe() {
    return fetch(`${BACKEND_URL}/api/auth/me`, {
      credentials: 'include',
    });
  },

  async login(email: string, password: string) {
    return fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(data: { email: string; password: string; name?: string; plan?: string }) {
    return fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  },

  async logout() {
    return fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async verifyEmail(token: string) {
    return fetch(`${BACKEND_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
  },

  async verifyEmailWithCode(code: string, email: string) {
    return fetch(`${BACKEND_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, email }),
    });
  },


  async resendVerification(email: string) {
    return fetch(`${BACKEND_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email: string) {
    return fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, newPassword: string) {
    return fetch(`${BACKEND_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return fetch(`${BACKEND_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async selectPlan(plan: string) {
    return fetch(`${BACKEND_URL}/api/auth/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan }),
    });
  },

  async updateProfile(data: { name?: string; email?: string }) {
    return fetch(`${BACKEND_URL}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  },
};

// ── Google Drive Auth Integration ───────────────────────────────────────────
export const googleApi = {
  getConnectUrl(): string {
    return `${BACKEND_URL}/api/google/connect`;
  },

  async getConnectUrlJson() {
    return fetch(`${BACKEND_URL}/api/google/connect?format=json`, {
      credentials: 'include',
    });
  },

  async disconnect() {
    return fetch(`${BACKEND_URL}/api/google/disconnect`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};

// ── Video & Media APIs ──────────────────────────────────────────────────────
export interface VideoDownloadPayload {
  url: string;
  format?: string;
  quality?: string;
  audioBitrate?: string;
  trimStart?: number;
  trimEnd?: number;
  aspectRatio?: string;
  fitMode?: string;
  cropPosition?: string;
  cropBox?: { x: number; y: number; width: number; height: number };
  customFileName?: string;
  mode?: string;
  captionLang?: string;
  subtitleLang?: string;
  relativeTimecodes?: boolean;
}

export const videoApi = {
  async getMetadata(url: string, signal?: AbortSignal) {
    return fetch(`${BACKEND_URL}/api/video/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    });
  },

  async download(payload: VideoDownloadPayload) {
    return fetch(`${BACKEND_URL}/api/video/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async fetchFile(downloadUrl: string) {
    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${BACKEND_URL}${downloadUrl}`;
    return fetch(fullUrl);
  },

  getProxyStreamUrl(directUrl: string): string {
    if (!directUrl) return '';
    return `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(directUrl)}`;
  },

  getHlsProxyUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    return `${BACKEND_URL}/api/video/hls-proxy?url=${encodeURIComponent(rawUrl)}`;
  },

  isProxiedUrl(url: string): boolean {
    if (!url) return false;
    return url.includes('/api/video/') || url.includes('/api/twitch-live/');
  },

  getFrameUrl(params: {
    url: string;
    time: number;
    quality: string;
    cleanTitle: string;
    cropParam?: string;
    streamParam?: string;
  }): string {
    const crop = params.cropParam || '';
    const stream = params.streamParam || '';
    return `${BACKEND_URL}/api/video/frame?url=${encodeURIComponent(params.url)}&time=${params.time}&quality=${encodeURIComponent(params.quality)}&download=true&fullRes=true&format=png&title=${encodeURIComponent(params.cleanTitle)}${crop}${stream}`;
  },
};

// ── Twitch Live & Preview APIs ──────────────────────────────────────────────
export const twitchApi = {
  async getStreamInfo(url: string, options?: { quality?: string; forceRefresh?: boolean; signal?: AbortSignal }) {
    const qualityParam = options?.quality ? `&quality=${encodeURIComponent(options.quality)}` : '';
    const refreshParam = options?.forceRefresh ? '&forceRefresh=true' : '';
    const endpoint = `${BACKEND_URL}/api/twitch-live/stream-info?url=${encodeURIComponent(url)}${qualityParam}${refreshParam}`;
    return fetch(endpoint, { signal: options?.signal });
  },

  getLiveFrameUrl(params: {
    url: string;
    chunkOffset: number;
    localTime: number;
    targetTime: number;
    quality: string;
    cleanTitle: string;
    cropParam?: string;
  }): string {
    const crop = params.cropParam || '';
    return `${BACKEND_URL}/api/twitch-live/live-frame?url=${encodeURIComponent(params.url)}&chunkOffset=${params.chunkOffset}&localTime=${params.localTime}&globalTime=${params.targetTime}&quality=${encodeURIComponent(params.quality)}&download=true&format=png&title=${encodeURIComponent(params.cleanTitle)}${crop}`;
  },
};

// ── Cloud Storage (Self-hosted & Supabase) ──────────────────────────────────
export const cloudStorageApi = {
  async getVideos() {
    return fetch(`${BACKEND_URL}/api/videos`, {
      credentials: 'include',
    });
  },

  async deleteVideo(videoId: string) {
    return fetch(`${BACKEND_URL}/api/videos/${videoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },

  getVideoDownloadUrl(videoId: string): string {
    return `${BACKEND_URL}/api/videos/${videoId}/download`;
  },

  async downloadVideoBlob(videoId: string) {
    return fetch(`${BACKEND_URL}/api/videos/${videoId}/download`, {
      credentials: 'include',
    });
  },
};

// ── Google Drive Storage ────────────────────────────────────────────────────
export const driveApi = {
  async getFiles(token: string) {
    return fetch(`${BACKEND_URL}/api/drive/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async getQuota(token: string) {
    return fetch(`${BACKEND_URL}/api/drive/quota`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async deleteFile(fileId: string, token: string) {
    return fetch(`${BACKEND_URL}/api/drive/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

// ── App Requests / Waitlist ─────────────────────────────────────────────────
export const appRequestsApi = {
  async submit(data: { email: string }) {
    return fetch(`${BACKEND_URL}/api/app-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};

// ── Unified API Export ──────────────────────────────────────────────────────
export const api = {
  auth: authApi,
  google: googleApi,
  video: videoApi,
  twitch: twitchApi,
  cloudStorage: cloudStorageApi,
  drive: driveApi,
  appRequests: appRequestsApi,
};

export default api;
