export interface Mission {
  id: string;
  emoji: string;
  title: string;
  description: string;
  durationMin: number;
  category: 'water' | 'earth' | 'sky' | 'sound' | 'touch' | 'movement';
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
}

export type Screen = 'home' | 'mood-before' | 'active' | 'mood-after' | 'log';
