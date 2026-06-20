import type { Mission, MoodLevel, Settings } from '../types';
import { chatText, chatJson, chatVisionJson } from './providers';

const ELEVEN_TTS = 'https://api.elevenlabs.io/v1/text-to-speech';

const MOOD_WORDS: Record<MoodLevel, string> = {
  1: 'rough', 2: 'low', 3: 'okay', 4: 'good', 5: 'great',
};

/** ── Affirmation generation ───────────────────────────────────── */
export async function generateAffirmation(
  settings: Settings,
  opts: { mission: Mission; moodBefore?: MoodLevel; moodAfter?: MoodLevel },
): Promise<string> {
  const { mission, moodBefore, moodAfter } = opts;
  const name = settings.affirmationName.trim();

  const context = [
    `Nature mission: "${mission.title}" — ${mission.description}`,
    moodBefore ? `Mood before: ${MOOD_WORDS[moodBefore]}` : '',
    moodAfter ? `Mood after: ${MOOD_WORDS[moodAfter]}` : '',
    name ? `The person's name is ${name}.` : '',
  ].filter(Boolean).join('\n');

  const system =
    'You are a warm, grounded mindfulness guide for an app called OfflineQuest that sends people on small nature missions. ' +
    'Write ONE short spoken affirmation (2-3 sentences, max 55 words). ' +
    'It must feel calm, present, and human — never cheesy or clinical. ' +
    'Reference the nature element from the mission. Speak directly to the person. No emojis, no quotes, no markdown.';

  const result = await chatText(settings, system, context, { temperature: 0.9, maxTokens: 120 });
  if (result?.text) return result.text;
  return fallbackAffirmation(mission, name);
}

function fallbackAffirmation(mission: Mission, name: string): string {
  const who = name ? `${name}, ` : '';
  const pool = [
    `${who}you showed up for yourself today. The world slowed down because you let it. Carry this stillness with you.`,
    `${who}notice how present you just were. Nature didn't ask anything of you — it simply welcomed you. You belong here.`,
    `${who}that small moment outside was real, and so are you. Let your breath stay soft and your shoulders drop.`,
    `${who}${mission.title.toLowerCase()} — you did that. Let the ${mission.category} element stay with you a little longer.`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** ── AI quest generation ────────────────────────────────────────── */
interface MissionJson {
  emoji: string;
  title: string;
  description: string;
  durationMin: number;
  category: string;
}

export async function generateMission(settings: Settings): Promise<Mission | null> {
  const system =
    'You invent tiny real-world nature micro-missions for a mindfulness app. ' +
    'Return STRICT JSON only, no markdown, with keys: emoji (single emoji), title (max 4 words), ' +
    'description (1-2 sentences, concrete sensory instruction, present tense), durationMin (integer 1-10), ' +
    'category (one of: water, earth, sky, sound, touch, movement). The mission must be doable outdoors in minutes, ' +
    'safe, free, and require no equipment.';

  const result = await chatJson<MissionJson>(
    settings,
    system,
    'Generate one fresh, surprising nature mission.',
    { temperature: 1 },
  );
  if (!result) return null;

  const parsed = result.data;
  return {
    id: `ai-${Date.now()}`,
    emoji: parsed.emoji || '🌿',
    title: parsed.title || 'Nature Moment',
    description: parsed.description || 'Step outside and notice one living thing.',
    durationMin: Math.min(10, Math.max(1, Number(parsed.durationMin) || 2)),
    category: ['water', 'earth', 'sky', 'sound', 'touch', 'movement'].includes(parsed.category)
      ? (parsed.category as Mission['category']) : 'earth',
    aiGenerated: true,
  };
}

/** ── Vision: verify quest from photo ──────────────────────────── */
export interface VisionResult {
  verified: boolean;
  note: string;
  provider?: string;
}

interface VisionJson {
  verified: boolean;
  note: string;
}

export async function analyzeImage(
  settings: Settings,
  mission: Mission,
  imageDataUrl: string,
): Promise<VisionResult> {
  const system =
    'You verify nature mindfulness missions from a photo. Be encouraging and poetic but honest. ' +
    'Return STRICT JSON only with keys: verified (boolean — does the photo plausibly show the mission element?), ' +
    'note (1-2 warm sentences describing what you see and connecting it to the mission, max 45 words).';

  const user = `Mission: "${mission.title}" — ${mission.description}\nDoes this photo show evidence of completing it?`;

  try {
    const result = await chatVisionJson<VisionJson>(settings, system, user, imageDataUrl);
    if (!result) {
      return {
        verified: false,
        note: 'Add an OpenAI or Ollama API key in Settings to use AI vision.',
      };
    }
    return {
      verified: Boolean(result.data.verified),
      note: result.data.note || 'A beautiful moment in nature.',
      provider: result.provider,
    };
  } catch (err) {
    return { verified: false, note: `Vision failed: ${(err as Error).message}` };
  }
}

/** ── Voice: ElevenLabs TTS with browser fallback ────────────────── */
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speak(
  settings: Settings,
  text: string,
  onState?: (playing: boolean) => void,
): Promise<void> {
  stopSpeaking();

  if (settings.elevenLabsKey.trim()) {
    try {
      const res = await fetch(`${ELEVEN_TTS}/${settings.elevenLabsVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': settings.elevenLabsKey.trim(),
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      onState?.(true);
      audio.onended = () => { onState?.(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { onState?.(false); URL.revokeObjectURL(url); };
      await audio.play();
      return;
    } catch (err) {
      console.warn('ElevenLabs failed, falling back to browser voice:', err);
    }
  }

  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /female|samantha|karen|moira|tessa/i.test(v.name))
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => onState?.(true);
    utter.onend = () => onState?.(false);
    window.speechSynthesis.speak(utter);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.detail?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
