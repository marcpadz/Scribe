// Universal CORS Proxy with Social Media Support
// Supports: YouTube, TikTok, Instagram, Facebook, Twitter/X, Threads
// Uses free Cobalt API for media extraction

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
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
  }
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), { 
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { 
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
      }), { status: 422, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const response = await fetch(finalUrl, {
      method: request.method,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': parsedUrl.origin }
    });
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'public, max-age=3600',
        'X-Platform': platform || 'direct'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to fetch', message: error.message }), { 
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.arrayBuffer());
}