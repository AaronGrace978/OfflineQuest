const ALLOWED_ORIGINS = [
  'https://aarongrace978.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const CORS_HEADERS = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

export default {
  async fetch(request: Request, env: { OLLAMA_API_KEY?: string }): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = CORS_HEADERS(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    if (!env.OLLAMA_API_KEY) {
      return new Response(JSON.stringify({ error: 'OLLAMA_API_KEY not configured on worker' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    const targetPath = path.startsWith('api/') ? path : `api/${path || 'tags'}`;
    const target = `https://ollama.com/${targetPath}${url.search}`;

    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    headers.set('Authorization', `Bearer ${env.OLLAMA_API_KEY}`);

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
    });

    const out = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: cors,
    });
    out.headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
    return out;
  },
};
