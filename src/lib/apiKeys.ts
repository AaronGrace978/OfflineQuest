/** Clean pasted API keys (mobile often adds spaces/newlines/quotes). */
export function sanitizeApiKey(key: string): string {
  return key.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

/** Parse ElevenLabs error JSON into a readable message. */
export async function readElevenLabsError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) {
      const status = detail.status ? ` (${detail.status})` : '';
      return `${detail.message}${status}`;
    }
    return data?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
