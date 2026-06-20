import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_SETTINGS, OLLAMA_CLOUD_VISION_MODELS, type Settings } from '../types';
import { activeProviderLabel, effectiveProxyUrl, withEffectiveProxy } from '../lib/providers';

const VALID_CLOUD_VISION = new Set(OLLAMA_CLOUD_VISION_MODELS.map(m => m.id));

/** Merge saved settings with defaults; fix outdated model names from older app versions. */
function mergeSettings(saved: Partial<Settings> | null): Settings {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  if (!VALID_CLOUD_VISION.has(merged.ollamaVisionModel as typeof OLLAMA_CLOUD_VISION_MODELS[number]['id'])) {
    merged.ollamaVisionModel = DEFAULT_SETTINGS.ollamaVisionModel;
  }
  return merged;
}

export function useSettings() {
  const [raw, setRaw] = useLocalStorage<Partial<Settings>>('oq-settings', DEFAULT_SETTINGS);
  const settings = withEffectiveProxy(mergeSettings(raw));

  const update = (patch: Partial<Settings>) =>
    setRaw(prev => ({ ...mergeSettings(prev), ...patch }));

  const hasOpenAi = settings.openAiKey.trim().length > 0;
  const hasOllamaCloud = settings.ollamaApiKey.trim().length > 0 || effectiveProxyUrl(settings).length > 0;
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
