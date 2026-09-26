/**
 * logger.util.ts
 *
 * Environment-aware client-side logging utility for ClipFlow Frontend.
 *
 * - Localhost (DEV): Emits detailed structured error diagnostics with badges.
 * - Production (Non-localhost): Silences internal verbose debug traces and localhost references.
 */

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    Boolean(import.meta.env.DEV)
  );
}

export interface ClientErrorDetails {
  context: string;
  summary: string;
  code?: string | number;
  reason?: string;
  endpoint?: string;
  error?: unknown;
}

export const clientLogger = {
  isLocal: isLocalhost,

  info(context: string, message: string, data?: any) {
    if (!isLocalhost()) return;
    if (data !== undefined) {
      console.log(`%c[${context}]%c ${message}`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;', data);
    } else {
      console.log(`%c[${context}]%c ${message}`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;');
    }
  },

  warn(context: string, message: string, data?: any) {
    if (data !== undefined) {
      console.warn(`%c[${context}]%c ⚠️ ${message}`, 'color: #f59e0b; font-weight: bold;', 'color: inherit;', data);
    } else {
      console.warn(`%c[${context}]%c ⚠️ ${message}`, 'color: #f59e0b; font-weight: bold;', 'color: inherit;');
    }
  },

  error(details: ClientErrorDetails) {
    const isLocal = isLocalhost();
    const { context, summary, code, reason, endpoint, error } = details;

    let errMsg = '';
    if (error instanceof Error) {
      errMsg = error.message;
    } else if (typeof error === 'string') {
      errMsg = error;
    } else if (error) {
      errMsg = String(error);
    }

    const cleanMsg = errMsg.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    if (isLocal) {
      console.groupCollapsed(
        `%c🚨 [ERROR] [${context}]%c ${summary}${code ? ` (Code: ${code})` : ''}`,
        'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #ef4444; font-weight: bold; margin-left: 6px;'
      );
      if (code) console.error('Code:', code);
      if (reason) console.error('Reason:', reason);
      if (endpoint) console.error('Endpoint:', endpoint);
      if (cleanMsg) console.error('Details:', cleanMsg);
      if (error && typeof error === 'object') console.dir(error);
      console.groupEnd();
    } else {
      // Production: concise sanitized message without localhost
      const sanitizedSummary = summary.replace(/localhost:[0-9]+/g, '[api]');
      console.error(`[${context}] Error: ${sanitizedSummary}`);
    }
  },
};
