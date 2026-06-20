const proxy = 'https://offlinequest-ollama-proxy.aromatic-game.workers.dev/api/chat';
const img = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/Z';

const models = [
  'kimi-k2.5',
  'kimi-k2.6',
  'gemma4:31b',
  'gemini-3-flash-preview',
  'minimax-m3',
  'qwen3.5:397b',
  'gemma3:12b',
  'glm-4.7',
  'kimi-k2.7-code',
];

const system =
  'You verify nature mindfulness missions from a photo. Return STRICT JSON only with keys: verified (boolean), note (string, max 20 words).';

const user = 'Mission: watch the sky. Does this photo show evidence?';

for (const model of models) {
  try {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://aarongrace978.github.io',
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0.3 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user, images: [img] },
        ],
      }),
    });
    const text = await res.text();
    const preview = text.slice(0, 150).replace(/\s+/g, ' ');
    console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${res.status} ${model}`);
    console.log(`      ${preview}\n`);
  } catch (e) {
    console.log(`ERR  ${model} -> ${e.message}\n`);
  }
}
