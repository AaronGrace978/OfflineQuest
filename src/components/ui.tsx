import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Mission, MoodLevel } from '../types';

export const MOOD_OPTIONS: { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😞', label: 'Rough' },
  { level: 2, emoji: '😕', label: 'Low' },
  { level: 3, emoji: '😐', label: 'Okay' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 5, emoji: '😄', label: 'Great' },
];

export const CATEGORY_GRADIENT: Record<Mission['category'], string> = {
  water:    'from-sky-400/30 to-cyan-300/10',
  earth:    'from-amber-400/30 to-orange-300/10',
  sky:      'from-indigo-400/30 to-sky-300/10',
  sound:    'from-violet-400/30 to-fuchsia-300/10',
  touch:    'from-emerald-400/30 to-green-300/10',
  movement: 'from-teal-400/30 to-emerald-300/10',
};

export const CATEGORY_LABEL: Record<Mission['category'], string> = {
  water: 'Water', earth: 'Earth', sky: 'Sky',
  sound: 'Sound', touch: 'Touch', movement: 'Movement',
};

export function moodDelta(before: MoodLevel, after: MoodLevel) {
  const d = after - before;
  if (d > 0) return { text: `+${d} mood lift`, color: 'text-emerald-300', glow: true };
  if (d < 0) return { text: `${d} dip`, color: 'text-rose-300', glow: false };
  return { text: 'Steady', color: 'text-white/50', glow: false };
}

/** Living aurora background */
export function Background() {
  return (
    <div className="absolute inset-0 bg-linear-to-b from-[#0a2a1a] via-[#0a1f14] to-[#06140d]">
      <div className="aurora" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.15),transparent_50%)]" />
    </div>
  );
}

/** Mood picker */
export function MoodPicker({
  value, onChange,
}: { value: MoodLevel | null; onChange: (v: MoodLevel) => void }) {
  return (
    <div className="flex justify-center gap-2 my-4">
      {MOOD_OPTIONS.map(({ level, emoji, label }) => (
        <motion.button
          key={level}
          whileTap={{ scale: 0.88 }}
          onClick={() => onChange(level)}
          className={`flex flex-col items-center gap-1 px-2.5 py-3 rounded-2xl border transition-all duration-200
            ${value === level
              ? 'border-emerald-300/60 bg-emerald-400/15 scale-110 shadow-lg shadow-emerald-500/20'
              : 'border-white/10 bg-white/5 hover:border-white/25'}`}
        >
          <span className="text-2xl">{emoji}</span>
          <span className={`text-[10px] font-medium ${value === level ? 'text-emerald-200' : 'text-white/40'}`}>
            {label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/** Mission card */
export function MissionCard({ mission, compact }: { mission: Mission; compact?: boolean }) {
  return (
    <div className={`relative rounded-3xl glass overflow-hidden p-6 text-left
      bg-linear-to-br ${CATEGORY_GRADIENT[mission.category]}`}>
      <div className="absolute -right-6 -top-6 text-9xl opacity-10 select-none pointer-events-none">
        {mission.emoji}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-4xl animate-float inline-block">{mission.emoji}</span>
        {mission.aiGenerated && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200 bg-emerald-400/20 px-2 py-0.5 rounded-full border border-emerald-300/30">
            ✦ AI Quest
          </span>
        )}
      </div>
      <h2 className="font-display text-2xl font-semibold text-white mb-2 leading-tight">{mission.title}</h2>
      {!compact && (
        <p className="text-white/70 text-sm leading-relaxed mb-4">{mission.description}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/10 text-white/80 px-3 py-1 rounded-full">
          ⏱ {mission.durationMin} min
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium bg-white/5 text-white/60 px-3 py-1 rounded-full">
          {CATEGORY_LABEL[mission.category]}
        </span>
      </div>
    </div>
  );
}

/** Circular countdown timer */
export function Timer({ durationMin, onDone }: { durationMin: number; onDone: () => void }) {
  const total = durationMin * 60;
  const [left, setLeft] = useState(total);
  const done = useRef(false);

  useEffect(() => {
    if (left <= 0) {
      if (!done.current) { done.current = true; onDone(); }
      return;
    }
    const id = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onDone]);

  const pct = ((total - left) / total) * 100;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <div className="absolute inset-3 rounded-full bg-emerald-400/10 animate-breathe" />
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="url(#gx)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${circ * (1 - pct / 100)}`}
            className="transition-all duration-1000 ease-linear"
          />
          <defs>
            <linearGradient id="gx" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-semibold text-white tabular-nums">{mm}:{ss}</span>
          <span className="text-white/40 text-xs mt-1">breathe</span>
        </div>
      </div>
    </div>
  );
}

/** Animated soundwave shown while voice plays */
export function SoundWave({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-1 h-6 text-emerald-300">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

/** Primary button */
export function PrimaryButton({
  children, onClick, disabled, className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-2xl font-semibold text-base transition-all
        bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-900/40
        hover:from-emerald-400 hover:to-teal-400
        disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {children}
    </motion.button>
  );
}

/** Secondary / ghost button */
export function GhostButton({
  children, onClick, className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-full py-3.5 rounded-2xl font-medium text-sm transition-all
        glass text-white/80 hover:text-white hover:border-white/30 ${className}`}
    >
      {children}
    </motion.button>
  );
}
