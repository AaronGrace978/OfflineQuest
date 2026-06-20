import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Mission, MoodLevel, Settings } from '../types';
import { generateAffirmation, speak, stopSpeaking } from '../lib/ai';
import { SoundWave } from './ui';

export function AffirmationPanel({
  settings, mission, moodBefore, moodAfter, onAffirmation,
}: {
  settings: Settings;
  mission: Mission;
  moodBefore?: MoodLevel;
  moodAfter?: MoodLevel;
  onAffirmation?: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const run = async () => {
    setLoading(true);
    stopSpeaking();
    try {
      const aff = await generateAffirmation(settings, { mission, moodBefore, moodAfter });
      setText(aff);
      onAffirmation?.(aff);
      if (settings.voiceEnabled) {
        await speak(settings, aff, setPlaying);
      }
    } finally {
      setLoading(false);
    }
  };

  const replay = async () => {
    if (!text) return;
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    await speak(settings, text, setPlaying);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!text ? (
          <motion.button
            key="trigger"
            whileTap={{ scale: 0.97 }}
            onClick={run}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl glass text-white font-medium text-sm flex items-center justify-center gap-2 hover:border-white/30 transition-all disabled:opacity-60"
          >
            {loading ? (
              <>
                <Spinner /> Channeling words for you…
              </>
            ) : (
              <>✦ Get an AI affirmation</>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl glass p-5 text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                ✦ Your affirmation
              </span>
              <SoundWave active={playing} />
            </div>
            <p className="font-display text-lg leading-relaxed text-white/90 italic">"{text}"</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={replay}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                {playing ? '⏸ Stop' : '🔊 Play again'}
              </button>
              <button
                onClick={run}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <Spinner /> : '↻ New one'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}
