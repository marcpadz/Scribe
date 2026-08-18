// Universal CORS Proxy with Social Media Support
// Supports: YouTube, TikTok, Instagram, Facebook, Twitter/X, Threads
// Uses free Cobalt API for media extraction
// Rate-limited per caller IP via in-memory sliding window (simple, works in Workers).

// In-memory store — resets on each Worker restart. For production, use a KV
// rate-limiting policy or move this behind Cloudflare's built-in cache layer.
const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 60s sliding window
const RATE_LIMIT_MAX = 30;            // 30 requests per IP per window

export async function onRequest(context: any) {
  return handleRequest(context.request, context.env);
}

export async function handler(event: any, context: any) {
  const request = {
    url: event.rawUrl || `https://${event.headers.host}${event.path}`,
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  };
  const response = await handleRequest(request as any, {});
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  };
}

/** Extract a lightweight caller key from the request headers. */
function callerKey(req: Request): string {
  // Prefer CF-Connecting-IP if present; fall back to a hash of the Host header
  const cfIp = req.headers.get('cf-connecting-ip') ?? '';
  if (cfIp) return 'ip:' + cfIp;
  return 'host:' + (req.headers.get('host') ?? 'unknown');
}

/** Returns true if the caller is within rate limits. */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);
  if (!entry) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('threads.net')) return 'threads';
  return null;
}

async function extractMediaUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, videoQuality: '720', filenameStyle: 'basic', downloadMode: 'auto', audioFormat: 'mp3' })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'error' || data.status === 'rate-limit') return null;
    if (data.status === 'redirect' || data.status === 'tunnel' || data.status === 'stream') return data.url;
    if (data.status === 'picker' && data.picker?.[0]) return data.picker[0].url;
    return null;
  } catch (e) { return null; }
}

async function handleRequest(request: Request, env: any): Promise<Response> {
  const allowedHeaders = new Set([
    'origin', 'referer', 'user-agent', 'accept',
    'accept-language', 'accept-encoding', 'cache-control'
  ]);

  const isOptions = request.method === 'OPTIONS';
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': Array.from(allowedHeaders).join(', '),
    'Access-Control-Max-Age': '86400',
  };

  if (isOptions) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // --- Rate limit ---
  const key = callerKey(request);
  if (!checkRateLimit(key)) {
    return new Response(JSON.stringify({ error: 'Rate limited', limit: RATE_LIMIT_MAX }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...corsHeaders, 'Retry-After': '60' }
    });
  }

  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Only allow http/https targets
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only http/https URLs allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const platform = detectPlatform(targetUrl);
    let finalUrl = targetUrl;
    if (platform) {
      const extracted = await extractMediaUrl(targetUrl);
      if (extracted) finalUrl = extracted;
      else return new Response(JSON.stringify({
        error: 'Failed to extract media',
        message: `Could not extract media from ${platform}. Content may be private or unavailable.`,
        platform
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Fetch with timeout + bounded body size
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    const response = await fetch(finalUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'ScribeProxy/1.0', 'Accept': '*/*' }
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('Content-Type') || '';
    const bodyBuffer = await response.arrayBuffer();

    // Hard size limit: 500MB cap (pragmatic for transcription workloads)
    const MAX_SIZE_BYTES = 500 * 1024 * 1024;
    if (bodyBuffer.byteLength > MAX_SIZE_BYTES) {
      return new Response(JSON.stringify({
        error: 'Media too large',
        size: bodyBuffer.byteLength,
        limit: MAX_SIZE_BYTES,
        platform
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(bodyBuffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=3600',
        'X-Platform': platform || 'direct',
        'X-Content-Length': String(bodyBuffer.byteLength),
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch',
      message: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export default async function(req: any, res: any) {
  const url = `https://${req.headers.host}${req.url}`;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined
  });
  const response = await handleRequest(request, {});
  res.status(response.status);
  response.headers.forEach((value: any, key: any) => res.setHeader(key, value));
  res.send(await response.arrayBuffer());
}