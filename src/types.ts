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

export interface Settings {
  openAiKey: string;
  elevenLabsKey: string;
  elevenLabsVoiceId: string;
  voiceEnabled: boolean;
  affirmationName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  openAiKey: '',
  elevenLabsKey: '',
  elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // "Sarah" – warm, calm
  voiceEnabled: true,
  affirmationName: '',
};

export const VOICE_PRESETS: { id: string; name: string; vibe: string }[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   vibe: 'Warm & calm' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  vibe: 'Soft & clear' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    vibe: 'Deep & grounding' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh',    vibe: 'Gentle & steady' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    vibe: 'Bright & uplifting' },
];
