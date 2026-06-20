import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_SETTINGS, type Settings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<Settings>('oq-settings', DEFAULT_SETTINGS);

  const update = (patch: Partial<Settings>) =>
    setSettings(prev => ({ ...prev, ...patch }));

  const hasOpenAi = settings.openAiKey.trim().length > 0;
  const hasElevenLabs = settings.elevenLabsKey.trim().length > 0;

  return { settings, update, hasOpenAi, hasElevenLabs };
}
