export interface Mission {
  id: string;
  emoji: string;
  title: string;
  description: string;
  durationMin: number;
  category: 'water' | 'earth' | 'sky' | 'sound' | 'touch' | 'movement';
  aiGenerated?: boolean;
}

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface LogEntry {
  id: string;
  missionId: string;
  missionTitle: string;
  missionEmoji: string;
  moodBefore: MoodLevel;
  moodAfter: MoodLevel;
  completedAt: string;
  affirmation?: string;
  visionNote?: string;
  verified?: boolean;
}

export type Screen =
  | 'home'
  | 'mood-before'
  | 'active'
  | 'mood-after'
  | 'log'
  | 'settings';

/** Which AI backend to use. Auto picks the best configured provider per task. */
export type AiProvider = 'auto' | 'openai' | 'ollama-cloud' | 'ollama-local';

export interface Settings {
  affirmationName: string;
  voiceEnabled: boolean;
  /** Primary AI routing */
  aiProvider: AiProvider;
  /** OpenAI */
  openAiKey: string;
  openAiTextModel: string;
  openAiVisionModel: string;
  /** Ollama Cloud (ollama.com) or local (localhost:11434) */
  ollamaApiKey: string;
  /** Cloudflare Worker URL — required for Ollama on GitHub Pages (CORS) */
  ollamaProxyUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  /** ElevenLabs TTS */
  elevenLabsKey: string;
  elevenLabsVoiceId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  affirmationName: '',
  voiceEnabled: true,
  aiProvider: 'auto',
  openAiKey: '',
  openAiTextModel: 'gpt-4o-mini',
  openAiVisionModel: 'gpt-4o',
  ollamaApiKey: '',
  ollamaProxyUrl: '',
  ollamaTextModel: 'glm-4.7',
  ollamaVisionModel: 'kimi-k2.5',
  elevenLabsKey: '',
  elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
};

/** Pre-deployed Cloudflare proxy — Ollama key lives on the worker, not in the browser. */
export const OLLAMA_PROXY_URL = 'https://offlinequest-ollama-proxy.aromatic-game.workers.dev';

export const AI_PROVIDER_OPTIONS: { id: AiProvider; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto (best available)', desc: 'Picks the strongest configured provider per task' },
  { id: 'openai', label: 'OpenAI', desc: 'GPT-4o family — fast, reliable vision' },
  { id: 'ollama-cloud', label: 'Ollama Cloud', desc: 'Gemma 4, Kimi K2.5, GLM — huge models via ollama.com' },
  { id: 'ollama-local', label: 'Ollama Local', desc: 'Free, private — runs on your PC at localhost:11434' },
];

/** Curated model lists — see https://ollama.com/search?c=cloud */
export const OLLAMA_CLOUD_TEXT_MODELS = [
  { id: 'gemma4:12b', name: 'Gemma 4 12B', tag: 'Multimodal · balanced' },
  { id: 'glm-4.7:cloud', name: 'GLM 4.7', tag: 'Flagship reasoning' },
  { id: 'gpt-oss:120b-cloud', name: 'GPT-OSS 120B', tag: 'Deep reasoning' },
  { id: 'deepseek-v4-flash:cloud', name: 'DeepSeek V4 Flash', tag: 'Fast · 1M context' },
  { id: 'qwen3-coder:480b-cloud', name: 'Qwen3 Coder 480B', tag: 'Agentic' },
  { id: 'minimax-m2.1:cloud', name: 'MiniMax M2.1', tag: 'Fast cloud' },
] as const;

export const OLLAMA_CLOUD_VISION_MODELS = [
  { id: 'gemma4:12b', name: 'Gemma 4 12B', tag: 'Best all-round vision' },
  { id: 'kimi-k2.5:cloud', name: 'Kimi K2.5', tag: 'Native multimodal' },
  { id: 'qwen3.5:27b', name: 'Qwen 3.5 27B', tag: 'Strong vision + tools' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', tag: 'Frontier speed' },
  { id: 'minimax-m3:cloud', name: 'MiniMax M3', tag: '1M context vision' },
] as const;

export const OLLAMA_LOCAL_TEXT_MODELS = [
  { id: 'gemma3:12b', name: 'Gemma 3 12B', tag: 'Great local default' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', tag: 'Lightweight' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', tag: 'Strong small model' },
  { id: 'mistral:7b', name: 'Mistral 7B', tag: 'Fast' },
] as const;

export const OLLAMA_LOCAL_VISION_MODELS = [
  { id: 'llama3.2-vision:11b', name: 'Llama 3.2 Vision', tag: 'Reliable local vision' },
  { id: 'qwen2.5vl:7b', name: 'Qwen 2.5 VL', tag: 'Sharp OCR + scenes' },
  { id: 'moondream', name: 'Moondream', tag: 'Tiny · runs anywhere' },
  { id: 'llava:13b', name: 'LLaVA 13B', tag: 'Classic vision' },
] as const;

export const OPENAI_TEXT_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', tag: 'Fast · cheap' },
  { id: 'gpt-4o', name: 'GPT-4o', tag: 'Highest quality' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', tag: 'Newer · efficient' },
] as const;

export const OPENAI_VISION_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', tag: 'Best vision' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', tag: 'Faster vision' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', tag: 'Newer multimodal' },
] as const;

export const VOICE_PRESETS: { id: string; name: string; vibe: string }[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', vibe: 'Warm & calm' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', vibe: 'Soft & clear' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', vibe: 'Deep & grounding' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', vibe: 'Gentle & steady' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', vibe: 'Bright & uplifting' },
];
