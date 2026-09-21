/**
 * Cloudflare Worker - Zero-Cost HTTP Range CORS Relay
 * 
 * Deploy this on Cloudflare Workers (100,000 free requests/day, unlimited bandwidth).
 * 
 * How it works:
 * 1. Receives incoming request from your browser with `?url=<signed-googlevideo-url>`
 * 2. Passes the browser's `Range: bytes=x-y` header directly to YouTube CDN
 * 3. Streams only the requested byte chunk back to the browser
 * 4. Injects `Access-Control-Allow-Origin: *` to bypass browser CORS restrictions
 * 
 * Result: Render server uses 0 MB bandwidth and 0% CPU for video transfers!
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing "url" query parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // 2. Prepare upstream headers
      const upstreamHeaders = new Headers();
      if (targetUrl.includes('googlevideo.com') || targetUrl.includes('youtube.com')) {
        if (targetUrl.includes('c=IOS')) {
          upstreamHeaders.set('User-Agent', 'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)');
        } else {
          // Android VR client matches yt-dlp default extraction client
          upstreamHeaders.set(
            'User-Agent',
            'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
          );
        }
      } else {
        upstreamHeaders.set(
          'User-Agent',
          request.headers.get('User-Agent') ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );
      }
      upstreamHeaders.set('Accept', '*/*');

      // Forward Range header from browser if present
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        upstreamHeaders.set('Range', rangeHeader);
      }

      // Add appropriate referer based on target host
      if (targetUrl.includes('youtube.com') || targetUrl.includes('googlevideo.com')) {
        upstreamHeaders.set('Referer', 'https://www.youtube.com/');
        upstreamHeaders.set('Origin', 'https://www.youtube.com');
      } else if (targetUrl.includes('instagram.com') || targetUrl.includes('cdninstagram.com')) {
        upstreamHeaders.set('Referer', 'https://www.instagram.com/');
      } else if (targetUrl.includes('twitter.com') || targetUrl.includes('x.com') || targetUrl.includes('twimg.com')) {
        upstreamHeaders.set('Referer', 'https://twitter.com/');
      } else if (targetUrl.includes('twitch.tv') || targetUrl.includes('ttvnw.net')) {
        upstreamHeaders.set('Referer', 'https://www.twitch.tv/');
      }

      // 3. Stream from upstream CDN
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
      });

      // 4. Build response headers with CORS
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization');
      responseHeaders.set(
        'Access-Control-Expose-Headers',
        'Content-Range, Content-Length, Accept-Ranges, Content-Type'
      );
      responseHeaders.set('Cache-Control', 'public, max-age=3600');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Upstream fetch failed' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
