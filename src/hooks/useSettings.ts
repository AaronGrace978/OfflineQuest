import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import { activeProviderLabel } from '../lib/providers';

/** Merge saved settings with defaults so new fields appear after updates. */
function mergeSettings(saved: Partial<Settings> | null): Settings {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function useSettings() {
  const [raw, setRaw] = useLocalStorage<Partial<Settings>>('oq-settings', DEFAULT_SETTINGS);
  const settings = mergeSettings(raw);

  const update = (patch: Partial<Settings>) =>
    setRaw(prev => ({ ...mergeSettings(prev), ...patch }));

  const hasOpenAi = settings.openAiKey.trim().length > 0;
  const hasOllamaCloud = settings.ollamaApiKey.trim().length > 0;
  const hasElevenLabs = settings.elevenLabsKey.trim().length > 0;
  const hasAnyAi = hasOpenAi || hasOllamaCloud || settings.aiProvider === 'ollama-local';
  const providerSummary = activeProviderLabel(settings);

  return {
    settings,
    update,
    hasOpenAi,
    hasOllamaCloud,
    hasElevenLabs,
    hasAnyAi,
    providerSummary,
  };
}
