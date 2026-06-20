import { useState, useEffect, useRef } from 'react';
import { missions, getRandomMission } from './data/missions';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Mission, MoodLevel, LogEntry, Screen } from './types';

const MOOD_OPTIONS: { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😞', label: 'Rough' },
  { level: 2, emoji: '😕', label: 'Low' },
  { level: 3, emoji: '😐', label: 'Okay' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 5, emoji: '😄', label: 'Great' },
];

const CATEGORY_BG: Record<Mission['category'], string> = {
  water:    'from-sky-100 to-blue-50',
  earth:    'from-amber-100 to-stone-50',
  sky:      'from-indigo-100 to-sky-50',
  sound:    'from-violet-100 to-purple-50',
  touch:    'from-green-100 to-emerald-50',
  movement: 'from-teal-100 to-green-50',
};

function moodDelta(before: MoodLevel, after: MoodLevel) {
  const d = after - before;
  if (d > 0) return { text: `+${d} mood boost`, color: 'text-green-700' };
  if (d < 0) return { text: `${d} mood drop`, color: 'text-rose-600' };
  return { text: 'No change', color: 'text-stone-400' };
}

// ─── Mood Picker ─────────────────────────────────────────────────────────────
function MoodPicker({ value, onChange }: { value: MoodLevel | null; onChange: (v: MoodLevel) => void }) {
  return (
    <div className="flex justify-center gap-3 my-6">
      {MOOD_OPTIONS.map(({ level, emoji, label }) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl border-2 transition-all duration-150
            ${value === level
              ? 'border-green-600 bg-green-50 scale-110 shadow-md'
              : 'border-stone-200 bg-white hover:border-green-300 hover:scale-105'}`}
        >
          <span className="text-3xl">{emoji}</span>
          <span className={`text-xs font-medium ${value === level ? 'text-green-700' : 'text-stone-400'}`}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Mission Card ─────────────────────────────────────────────────────────────
function MissionCard({ mission, compact }: { mission: Mission; compact?: boolean }) {
  const bg = CATEGORY_BG[mission.category];
  return (
    <div className={`rounded-3xl bg-linear-to-br ${bg} p-6 text-left relative overflow-hidden`}>
      <div className="absolute -right-4 -top-4 text-8xl opacity-10 select-none">{mission.emoji}</div>
      <span className="text-4xl mb-3 block">{mission.emoji}</span>
      <h2 className="text-xl font-bold text-stone-800 mb-2">{mission.title}</h2>
      {!compact && (
        <p className="text-stone-600 text-sm leading-relaxed mb-4">{mission.description}</p>
      )}
      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/60 text-stone-600 px-3 py-1 rounded-full">
        ⏱ {mission.durationMin} min
      </span>
    </div>
  );
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function Timer({ durationMin, onDone }: { durationMin: number; onDone: () => void }) {
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="#16a34a" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-mono font-bold text-stone-800">{mm}:{ss}</span>
        </div>
      </div>
      <p className="text-stone-400 text-sm">Stay present · no peeking</p>
    </div>
  );
}

// ─── Home Screen ─────────────────────────────────────────────────────────────
function HomeScreen({
  mission, onStart, onNewMission, onLog, logCount,
}: {
  mission: Mission;
  onStart: () => void;
  onNewMission: () => void;
  onLog: () => void;
  logCount: number;
}) {
  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">OfflineQuest 🌿</h1>
          <p className="text-stone-400 text-sm">Step outside. Feel something real.</p>
        </div>
        <button
          onClick={onLog}
          className="relative flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-green-700 transition-colors px-3 py-2 rounded-xl hover:bg-green-50"
        >
          📋 Log
          {logCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {logCount > 9 ? '9+' : logCount}
            </span>
          )}
        </button>
      </div>

      {/* Today's mission */}
      <div className="px-6 flex-1 flex flex-col gap-4">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Today's Quest</div>
        <MissionCard mission={mission} />

        <div className="flex gap-3 mt-2">
          <button
            onClick={onNewMission}
            className="flex-1 py-3.5 rounded-2xl border-2 border-stone-200 text-stone-600 font-semibold text-sm hover:border-green-300 hover:text-green-700 transition-all"
          >
            🎲 New Quest
          </button>
          <button
            onClick={onStart}
            className="flex-2 py-3.5 rounded-2xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-200"
          >
            Begin Quest →
          </button>
        </div>

        {/* All missions preview */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">All Quests</div>
          <div className="grid grid-cols-2 gap-2">
            {missions.slice(0, 6).map(m => (
              <div key={m.id} className="bg-stone-50 rounded-2xl p-3 flex items-center gap-2">
                <span className="text-xl">{m.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-stone-700 leading-tight">{m.title}</p>
                  <p className="text-xs text-stone-400">{m.durationMin} min</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}

// ─── Mood Before Screen ───────────────────────────────────────────────────────
function MoodBeforeScreen({
  mission, onNext, onBack,
}: {
  mission: Mission;
  onNext: (mood: MoodLevel) => void;
  onBack: () => void;
}) {
  const [mood, setMood] = useState<MoodLevel | null>(null);

  return (
    <div className="animate-fade-in flex flex-col h-full px-6 pt-8">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-600 text-sm mb-6 self-start flex items-center gap-1">
        ← Back
      </button>
      <div className="text-4xl mb-2 text-center">🌿</div>
      <h2 className="text-2xl font-bold text-stone-800 text-center mb-1">Before you go…</h2>
      <p className="text-stone-400 text-center text-sm mb-6">How are you feeling right now?</p>

      <MissionCard mission={mission} compact />

      <MoodPicker value={mood} onChange={setMood} />

      <button
        onClick={() => mood && onNext(mood)}
        disabled={!mood}
        className="mt-auto mb-8 w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base
          disabled:bg-stone-200 disabled:text-stone-400 hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-100"
      >
        Start Quest →
      </button>
    </div>
  );
}

// ─── Active Mission Screen ────────────────────────────────────────────────────
function ActiveMissionScreen({
  mission, onDone,
}: {
  mission: Mission;
  onDone: () => void;
}) {
  const [timerDone, setTimerDone] = useState(false);

  return (
    <div className="animate-fade-in flex flex-col h-full px-6 pt-8 text-center">
      <div className={`flex-1 flex flex-col items-center justify-center bg-linear-to-br ${CATEGORY_BG[mission.category]} rounded-3xl p-8 mb-6`}>
        <div className="text-6xl mb-4 animate-pulse-ring">{mission.emoji}</div>
        <h2 className="text-xl font-bold text-stone-800 mb-3">{mission.title}</h2>
        <p className="text-stone-600 text-sm leading-relaxed mb-8 max-w-xs">{mission.description}</p>
        <Timer durationMin={mission.durationMin} onDone={() => setTimerDone(true)} />
      </div>

      {timerDone && (
        <div className="animate-fade-in text-center mb-2">
          <p className="text-green-700 font-semibold text-sm mb-3">✨ Time's up! How do you feel?</p>
        </div>
      )}

      <button
        onClick={onDone}
        className={`w-full py-4 rounded-2xl font-bold text-base mb-8 transition-all
          ${timerDone
            ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 active:scale-[0.98]'
            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
      >
        {timerDone ? "I'm Done! →" : "Skip Timer →"}
      </button>
    </div>
  );
}

// ─── Mood After Screen ────────────────────────────────────────────────────────
function MoodAfterScreen({
  moodBefore, onSave, onBack,
}: {
  moodBefore: MoodLevel;
  onSave: (moodAfter: MoodLevel) => void;
  onBack: () => void;
}) {
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const before = MOOD_OPTIONS.find(o => o.level === moodBefore)!;

  return (
    <div className="animate-fade-in flex flex-col h-full px-6 pt-8">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-600 text-sm mb-6 self-start flex items-center gap-1">
        ← Back
      </button>
      <div className="text-4xl mb-2 text-center">✨</div>
      <h2 className="text-2xl font-bold text-stone-800 text-center mb-1">Quest Complete!</h2>
      <p className="text-stone-400 text-center text-sm mb-6">How do you feel now?</p>

      {/* Before mood */}
      <div className="bg-stone-50 rounded-2xl px-5 py-4 flex items-center justify-between mb-4">
        <span className="text-sm text-stone-500">Before</span>
        <span className="flex items-center gap-2 font-semibold text-stone-700">
          <span className="text-xl">{before.emoji}</span> {before.label}
        </span>
      </div>

      <p className="text-sm font-semibold text-stone-500 mb-1 text-center">After:</p>
      <MoodPicker value={mood} onChange={setMood} />

      {mood && moodBefore && (
        <div className="animate-fade-in text-center -mt-2 mb-4">
          <span className={`text-sm font-bold ${moodDelta(moodBefore, mood).color}`}>
            {moodDelta(moodBefore, mood).text}
          </span>
        </div>
      )}

      <button
        onClick={() => mood && onSave(mood)}
        disabled={!mood}
        className="mt-auto mb-8 w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base
          disabled:bg-stone-200 disabled:text-stone-400 hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-100"
      >
        Save to Log →
      </button>
    </div>
  );
}

// ─── Log Screen ───────────────────────────────────────────────────────────────
function LogScreen({ entries, onBack, onClear }: { entries: LogEntry[]; onBack: () => void; onClear: () => void }) {
  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '—';
  const avgBefore = avg(entries.map(e => e.moodBefore));
  const avgAfter  = avg(entries.map(e => e.moodAfter));

  return (
    <div className="animate-fade-in flex flex-col h-full px-6 pt-8">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-600 text-sm flex items-center gap-1">
          ← Back
        </button>
        {entries.length > 0 && (
          <button onClick={onClear} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">
            Clear all
          </button>
        )}
      </div>

      <h2 className="text-2xl font-bold text-stone-800 mb-1">Quest Log 📋</h2>
      <p className="text-stone-400 text-sm mb-6">{entries.length} quest{entries.length !== 1 ? 's' : ''} completed</p>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-stone-50 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-stone-800">{avgBefore}</p>
            <p className="text-xs text-stone-400 mt-1">Avg mood before</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{avgAfter}</p>
            <p className="text-xs text-stone-400 mt-1">Avg mood after</p>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🌱</div>
          <p className="text-stone-500 font-medium">No quests yet.</p>
          <p className="text-stone-400 text-sm mt-1">Complete your first mission to start tracking.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pb-8">
          {[...entries].reverse().map(entry => {
            const before = MOOD_OPTIONS.find(o => o.level === entry.moodBefore)!;
            const after  = MOOD_OPTIONS.find(o => o.level === entry.moodAfter)!;
            const delta  = moodDelta(entry.moodBefore, entry.moodAfter);
            const date   = new Date(entry.completedAt);
            return (
              <div key={entry.id} className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{entry.missionEmoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{entry.missionTitle}</p>
                      <p className="text-xs text-stone-400">
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${delta.color}`}>{delta.text}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-stone-400 text-xs">Before</span>
                  <span className="text-xl">{before.emoji}</span>
                  <span className="text-stone-300">→</span>
                  <span className="text-xl">{after.emoji}</span>
                  <span className="text-stone-400 text-xs">After</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mission, setMission] = useState<Mission>(() => getRandomMission());
  const [moodBefore, setMoodBefore] = useState<MoodLevel | null>(null);
  const [log, setLog] = useLocalStorage<LogEntry[]>('oq-log', []);

  const handleStart = () => setScreen('mood-before');
  const handleNewMission = () => setMission(getRandomMission(mission.id));

  const handleMoodBefore = (mood: MoodLevel) => {
    setMoodBefore(mood);
    setScreen('active');
  };

  const handleMissionDone = () => setScreen('mood-after');

  const handleMoodAfter = (moodAfter: MoodLevel) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      missionId: mission.id,
      missionTitle: mission.title,
      missionEmoji: mission.emoji,
      moodBefore: moodBefore!,
      moodAfter,
      completedAt: new Date().toISOString(),
    };
    setLog(prev => [...prev, entry]);
    setMission(getRandomMission(mission.id));
    setMoodBefore(null);
    setScreen('home');
  };

  return (
    <div className="min-h-dvh bg-stone-50 flex justify-center">
      <div className="w-full max-w-sm bg-white min-h-dvh flex flex-col shadow-xl relative overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {screen === 'home' && (
          <HomeScreen
            mission={mission}
            onStart={handleStart}
            onNewMission={handleNewMission}
            onLog={() => setScreen('log')}
            logCount={log.length}
          />
        )}
        {screen === 'mood-before' && (
          <MoodBeforeScreen
            mission={mission}
            onNext={handleMoodBefore}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'active' && (
          <ActiveMissionScreen
            mission={mission}
            onDone={handleMissionDone}
          />
        )}
        {screen === 'mood-after' && moodBefore && (
          <MoodAfterScreen
            moodBefore={moodBefore}
            onSave={handleMoodAfter}
            onBack={() => setScreen('active')}
          />
        )}
        {screen === 'log' && (
          <LogScreen
            entries={log}
            onBack={() => setScreen('home')}
            onClear={() => setLog([])}
          />
        )}
      </div>
    </div>
  );
}
