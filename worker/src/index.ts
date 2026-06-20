/**
 * Cloudflare Worker — proxies Ollama Cloud API with CORS for GitHub Pages.
 *
 * Deploy:
 *   cd worker
 *   npx wrangler deploy
 *   npx wrangler secret put OLLAMA_API_KEY   # optional if passing key from app
 *
 * Then paste your worker URL into OfflineQuest Settings → Ollama proxy URL.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: { OLLAMA_API_KEY?: string }): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    const targetPath = path.startsWith('api/') ? path : `api/${path || 'tags'}`;
    const target = `https://ollama.com/${targetPath}${url.search}`;

    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

    const clientAuth = request.headers.get('Authorization');
    if (clientAuth) {
      headers.set('Authorization', clientAuth);
    } else if (env.OLLAMA_API_KEY) {
      headers.set('Authorization', `Bearer ${env.OLLAMA_API_KEY}`);
    }

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
    });

    const out = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: CORS,
    });
    out.headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
    return out;
  },
};
