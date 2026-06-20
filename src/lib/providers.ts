import type { Settings } from '../types';
import { OLLAMA_PROXY_URL } from '../types';

const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';
const OLLAMA_CLOUD = 'https://ollama.com/api';
const OLLAMA_LOCAL = 'http://localhost:11434/api';

export type AiTask = 'text' | 'vision';
type ResolvedProvider = 'openai' | 'ollama-cloud' | 'ollama-local';

function isHostedApp(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.includes('github.io') || h.includes('pages.dev');
}

/** Resolve proxy URL — auto-use built-in proxy on GitHub Pages. */
export function effectiveProxyUrl(settings: Settings): string {
  const custom = settings.ollamaProxyUrl.trim();
  if (custom) return custom.replace(/\/$/, '');
  if (isHostedApp()) return OLLAMA_PROXY_URL;
  return '';
}

export function withEffectiveProxy(settings: Settings): Settings {
  const proxy = effectiveProxyUrl(settings);
  return proxy && !settings.ollamaProxyUrl.trim()
    ? { ...settings, ollamaProxyUrl: proxy }
    : settings;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // raw base64 for Ollama
}

export interface TextResult {
  text: string;
  provider: string;
}

export interface JsonResult<T> {
  data: T;
  provider: string;
}

// ── Provider resolution ─────────────────────────────────────────

function hasOpenAi(s: Settings) {
  return s.openAiKey.trim().length > 0;
}

function hasOllamaCloud(s: Settings) {
  return s.ollamaApiKey.trim().length > 0 || effectiveProxyUrl(s).length > 0;
}

/** Local Ollama needs no key — we probe at call time. */
function wantsOllamaLocal(s: Settings) {
  return s.aiProvider === 'ollama-local' || s.aiProvider === 'auto';
}

export function resolveProvider(settings: Settings, task: AiTask): ResolvedProvider | null {
  const s = withEffectiveProxy(settings);
  const pref = s.aiProvider;

  if (pref === 'openai') return hasOpenAi(s) ? 'openai' : null;
  if (pref === 'ollama-cloud') return hasOllamaCloud(s) ? 'ollama-cloud' : null;
  if (pref === 'ollama-local') return 'ollama-local';

  // Auto: vision prefers OpenAI (reliable), then Ollama cloud vision, then local
  if (task === 'vision') {
    if (hasOpenAi(s)) return 'openai';
    if (hasOllamaCloud(s)) return 'ollama-cloud';
    if (wantsOllamaLocal(s)) return 'ollama-local';
    return null;
  }

  // Auto text: Ollama cloud (big free-tier models) → OpenAI → local
  if (hasOllamaCloud(s)) return 'ollama-cloud';
  if (hasOpenAi(s)) return 'openai';
  if (wantsOllamaLocal(s)) return 'ollama-local';
  return null;
}

export function activeProviderLabel(settings: Settings): string {
  const s = withEffectiveProxy(settings);
  const text = resolveProvider(s, 'text');
  const vision = resolveProvider(s, 'vision');
  if (!text && !vision) return 'No AI configured';
  if (text === vision) return labelFor(text);
  return `${labelFor(text)} · vision: ${labelFor(vision)}`;
}

function labelFor(p: ResolvedProvider | null): string {
  if (!p) return '—';
  if (p === 'openai') return 'OpenAI';
  if (p === 'ollama-cloud') return 'Ollama Cloud';
  return 'Ollama Local';
}

// ── Public API ──────────────────────────────────────────────────

export async function chatText(
  settings: Settings,
  system: string,
  user: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<TextResult | null> {
  const provider = resolveProvider(settings, 'text');
  if (!provider) return null;

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    if (provider === 'openai') {
      const text = await openAiChat(settings, settings.openAiTextModel, messages, opts);
      return { text, provider: `OpenAI · ${settings.openAiTextModel}` };
    }
    const model = provider === 'ollama-cloud' ? settings.ollamaTextModel : settings.ollamaTextModel;
    const text = await ollamaChat(settings, provider, model, messages, opts);
    return { text, provider: `${labelFor(provider)} · ${model}` };
  } catch (err) {
    console.warn(`chatText failed (${provider}):`, err);
    // Auto-fallback chain
    if (settings.aiProvider === 'auto') {
      return chatTextFallback(settings, system, user, provider, opts);
    }
    throw err;
  }
}

async function chatTextFallback(
  settings: Settings,
  system: string,
  user: string,
  failed: ResolvedProvider,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<TextResult | null> {
  const chain: ResolvedProvider[] = ['ollama-cloud', 'openai', 'ollama-local'].filter(p => p !== failed) as ResolvedProvider[];
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  for (const p of chain) {
    try {
      if (p === 'openai' && !hasOpenAi(settings)) continue;
      if (p === 'ollama-cloud' && !hasOllamaCloud(settings)) continue;
      if (p === 'openai') {
        const text = await openAiChat(settings, settings.openAiTextModel, messages, opts);
        return { text, provider: `OpenAI · ${settings.openAiTextModel}` };
      }
      const text = await ollamaChat(settings, p, settings.ollamaTextModel, messages, opts);
      return { text, provider: `${labelFor(p)} · ${settings.ollamaTextModel}` };
    } catch { /* try next */ }
  }
  return null;
}

export async function chatJson<T>(
  settings: Settings,
  system: string,
  user: string,
  opts?: { temperature?: number },
): Promise<JsonResult<T> | null> {
  const provider = resolveProvider(settings, 'text');
  if (!provider) return null;

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    let raw: string;
    let label: string;
    if (provider === 'openai') {
      raw = await openAiChat(settings, settings.openAiTextModel, messages, {
        ...opts,
        jsonMode: true,
      });
      label = `OpenAI · ${settings.openAiTextModel}`;
    } else {
      raw = await ollamaChat(settings, provider, settings.ollamaTextModel, messages, {
        ...opts,
        jsonMode: true,
      });
      label = `${labelFor(provider)} · ${settings.ollamaTextModel}`;
    }
    return { data: parseJson<T>(raw), provider: label };
  } catch (err) {
    console.warn(`chatJson failed (${provider}):`, err);
    return null;
  }
}

export async function chatVisionJson<T>(
  settings: Settings,
  system: string,
  userText: string,
  imageDataUrl: string,
): Promise<JsonResult<T> | null> {
  const provider = resolveProvider(settings, 'vision');
  if (!provider) return null;

  const b64 = dataUrlToBase64(imageDataUrl);

  try {
    let raw: string;
    let label: string;
    if (provider === 'openai') {
      raw = await openAiVision(settings, settings.openAiVisionModel, system, userText, imageDataUrl);
      label = `OpenAI · ${settings.openAiVisionModel}`;
    } else {
      const model = settings.ollamaVisionModel;
      raw = await ollamaVision(settings, provider, model, system, userText, b64);
      label = `${labelFor(provider)} · ${model}`;
    }
    return { data: parseJson<T>(raw), provider: label };
  } catch (err) {
    console.warn(`chatVisionJson failed (${provider}):`, err);
    if (settings.aiProvider === 'auto' && provider !== 'openai' && hasOpenAi(settings)) {
      try {
        const raw = await openAiVision(settings, settings.openAiVisionModel, system, userText, imageDataUrl);
        return { data: parseJson<T>(raw), provider: `OpenAI · ${settings.openAiVisionModel}` };
      } catch { /* fall through */ }
    }
    throw err;
  }
}

/** Ping Ollama to verify connectivity */
export async function testOllamaConnection(
  settings: Settings,
  host: 'cloud' | 'local',
): Promise<{ ok: boolean; message: string }> {
  if (host === 'cloud' && isHostedApp() && !effectiveProxyUrl(settings)) {
    return {
      ok: false,
      message: 'Ollama Cloud is blocked by browser security on GitHub Pages. Add a proxy URL below, or use OpenAI instead.',
    };
  }

  const base = host === 'cloud'
    ? (effectiveProxyUrl(settings) || OLLAMA_CLOUD.replace(/\/api$/, ''))
    : OLLAMA_LOCAL.replace(/\/api$/, '');
  const url = `${base}/api/tags`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (host === 'cloud' && settings.ollamaApiKey.trim()) {
    headers.Authorization = `Bearer ${settings.ollamaApiKey.trim()}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (host === 'local') {
        return { ok: false, message: 'Ollama not running. Install from ollama.com and run `ollama serve`.' };
      }
      return { ok: false, message: `HTTP ${res.status} — check your API key or proxy URL.` };
    }
    const data = await res.json();
    const count = data?.models?.length ?? 0;
    return {
      ok: true,
      message: host === 'cloud'
        ? 'Ollama Cloud connected via proxy'
        : `${count} local model(s) found`,
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (host === 'cloud' && msg.includes('fetch')) {
      return { ok: false, message: 'Cannot reach Ollama — check proxy URL or use OpenAI on GitHub Pages.' };
    }
    return host === 'local'
      ? { ok: false, message: 'Cannot reach localhost:11434 — is Ollama running on this device?' }
      : { ok: false, message: 'Cannot reach Ollama — check proxy URL and API key.' };
  }
}

/** Quick OpenAI key check */
export async function testOpenAiConnection(settings: Settings): Promise<{ ok: boolean; message: string }> {
  if (!settings.openAiKey.trim()) {
    return { ok: false, message: 'No OpenAI key entered.' };
  }
  try {
    const res = await fetch(OPENAI_CHAT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openAiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.openAiTextModel,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    if (res.status === 401) return { ok: false, message: 'Invalid OpenAI key.' };
    if (res.ok || res.status === 400) return { ok: true, message: 'OpenAI connected — works on GitHub Pages ✓' };
    return { ok: false, message: `OpenAI error: HTTP ${res.status}` };
  } catch {
    return { ok: false, message: 'Cannot reach OpenAI — check connection or ad-blocker.' };
  }
}

/** Quick ElevenLabs key check */
export async function testElevenLabsConnection(settings: Settings): Promise<{ ok: boolean; message: string }> {
  if (!settings.elevenLabsKey.trim()) {
    return { ok: false, message: 'No ElevenLabs key entered.' };
  }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': settings.elevenLabsKey.trim() },
    });
    if (res.status === 401) return { ok: false, message: 'Invalid ElevenLabs key.' };
    if (res.ok) return { ok: true, message: 'ElevenLabs connected ✓' };
    return { ok: false, message: `ElevenLabs error: HTTP ${res.status}` };
  } catch {
    return { ok: false, message: 'Cannot reach ElevenLabs.' };
  }
}

// ── OpenAI ────────────────────────────────────────────────────

async function openAiChat(
  settings: Settings,
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const res = await fetch(OPENAI_CHAT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openAiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.8,
      max_tokens: opts?.maxTokens ?? 300,
      ...(opts?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

async function openAiVision(
  settings: Settings,
  model: string,
  system: string,
  userText: string,
  imageDataUrl: string,
): Promise<string> {
  const res = await fetch(OPENAI_CHAT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openAiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ── Ollama (cloud + local) ──────────────────────────────────────

function ollamaBase(settings: Settings, provider: 'ollama-cloud' | 'ollama-local') {
  if (provider === 'ollama-local') return OLLAMA_LOCAL;
  const proxy = effectiveProxyUrl(settings);
  if (proxy) return `${proxy}/api`;
  return OLLAMA_CLOUD;
}

function ollamaHeaders(settings: Settings, provider: 'ollama-cloud' | 'ollama-local') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'ollama-cloud' && settings.ollamaApiKey.trim()) {
    headers.Authorization = `Bearer ${settings.ollamaApiKey.trim()}`;
  }
  return headers;
}

async function ollamaChat(
  settings: Settings,
  provider: 'ollama-cloud' | 'ollama-local',
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; jsonMode?: boolean },
): Promise<string> {
  const res = await fetch(`${ollamaBase(settings, provider)}/chat`, {
    method: 'POST',
    headers: ollamaHeaders(settings, provider),
    body: JSON.stringify({
      model,
      stream: false,
      ...(opts?.jsonMode ? { format: 'json' } : {}),
      options: { temperature: opts?.temperature ?? 0.8 },
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data?.message?.content?.trim() ?? '';
}

async function ollamaVision(
  settings: Settings,
  provider: 'ollama-cloud' | 'ollama-local',
  model: string,
  system: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const res = await fetch(`${ollamaBase(settings, provider)}/chat`, {
    method: 'POST',
    headers: ollamaHeaders(settings, provider),
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.6 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText, images: [imageBase64] },
      ],
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data?.message?.content?.trim() ?? '';
}

// ── Helpers ─────────────────────────────────────────────────────

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error('Model did not return valid JSON');
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.error || data?.detail?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
