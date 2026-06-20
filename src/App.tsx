import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { missions, getRandomMission } from './data/missions';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSettings } from './hooks/useSettings';
import { generateMission, speak, stopSpeaking } from './lib/ai';
import type { Mission, MoodLevel, LogEntry, Screen, Settings, AiProvider } from './types';
import {
  OLLAMA_PROXY_URL, VOICE_PRESETS, AI_PROVIDER_OPTIONS,
  OLLAMA_CLOUD_TEXT_MODELS, OLLAMA_CLOUD_VISION_MODELS,
  OLLAMA_LOCAL_TEXT_MODELS, OLLAMA_LOCAL_VISION_MODELS,
  OPENAI_TEXT_MODELS, OPENAI_VISION_MODELS,
} from './types';
import { testOllamaConnection, testOpenAiConnection, testElevenLabsConnection, testVisionConnection, effectiveProxyUrl } from './lib/providers';
import {
  Background, MoodPicker, MissionCard, Timer, MOOD_OPTIONS, moodDelta,
  PrimaryButton, GhostButton,
} from './components/ui';
import { AffirmationPanel } from './components/AffirmationPanel';
import { CameraVerify } from './components/CameraVerify';

// ── streak helper ─────────────────────────────────────────────
function computeStreak(entries: LogEntry[]): number {
  if (!entries.length) return 0;
  const days = new Set(entries.map(e => new Date(e.completedAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  // allow today OR yesterday to start the streak
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const pageVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mission, setMission] = useState<Mission>(() => getRandomMission());
  const [moodBefore, setMoodBefore] = useState<MoodLevel | null>(null);
  const [pendingAffirmation, setPendingAffirmation] = useState<string | undefined>();
  const [pendingVision, setPendingVision] = useState<{ note: string; verified: boolean } | undefined>();
  const [log, setLog] = useLocalStorage<LogEntry[]>('oq-log', []);
  const [generating, setGenerating] = useState(false);
  const { settings, update, hasOpenAi, hasOllamaCloud, hasElevenLabs, hasAnyAi, providerSummary } = useSettings();

  const streak = useMemo(() => computeStreak(log), [log]);

  const go = (s: Screen) => { stopSpeaking(); setScreen(s); };

  const handleNewMission = () => setMission(getRandomMission(mission.id));

  const handleAiGenerate = async () => {
    if (!hasAnyAi) { go('settings'); return; }
    setGenerating(true);
    try {
      const m = await generateMission(settings);
      if (m) setMission(m);
    } finally {
      setGenerating(false);
    }
  };

  const handleMoodBefore = (m: MoodLevel) => { setMoodBefore(m); go('active'); };

  const handleSave = (moodAfter: MoodLevel) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      missionId: mission.id,
      missionTitle: mission.title,
      missionEmoji: mission.emoji,
      moodBefore: moodBefore!,
      moodAfter,
      completedAt: new Date().toISOString(),
      affirmation: pendingAffirmation,
      visionNote: pendingVision?.note,
      verified: pendingVision?.verified,
    };
    setLog(prev => [...prev, entry]);
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#34d399', '#22d3ee', '#a7f3d0', '#fde68a'],
    });
    setMission(getRandomMission(mission.id));
    setMoodBefore(null);
    setPendingAffirmation(undefined);
    setPendingVision(undefined);
    go('home');
  };

  return (
    <div className="relative min-h-dvh w-full flex justify-center overflow-hidden">
      <Background />
      <div
        className="relative z-10 w-full max-w-sm min-h-dvh flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            variants={pageVariants}
            initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex-1 flex flex-col"
          >
            {screen === 'home' && (
              <HomeScreen
                mission={mission} streak={streak} logCount={log.length}
                generating={generating}
                onStart={() => go('mood-before')}
                onShuffle={handleNewMission}
                onAiGenerate={handleAiGenerate}
                onLog={() => go('log')}
                onSettings={() => go('settings')}
              />
            )}
            {screen === 'mood-before' && (
              <MoodBeforeScreen
                mission={mission}
                onNext={handleMoodBefore}
                onBack={() => go('home')}
              />
            )}
            {screen === 'active' && moodBefore && (
              <ActiveScreen
                mission={mission} moodBefore={moodBefore} settings={settings}
                onAffirmation={setPendingAffirmation}
                onVision={setPendingVision}
                onDone={() => go('mood-after')}
              />
            )}
            {screen === 'mood-after' && moodBefore && (
              <MoodAfterScreen
                mission={mission} moodBefore={moodBefore} settings={settings}
                onAffirmation={setPendingAffirmation}
                onSave={handleSave}
                onBack={() => go('active')}
              />
            )}
            {screen === 'log' && (
              <LogScreen entries={log} streak={streak}
                onBack={() => go('home')} onClear={() => setLog([])} />
            )}
            {screen === 'settings' && (
              <SettingsScreen
                settings={settings} update={update}
                hasOpenAi={hasOpenAi} hasOllamaCloud={hasOllamaCloud}
                hasElevenLabs={hasElevenLabs} providerSummary={providerSummary}
                onBack={() => go('home')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomeScreen({
  mission, streak, logCount, generating,
  onStart, onShuffle, onAiGenerate, onLog, onSettings,
}: {
  mission: Mission; streak: number; logCount: number; generating: boolean;
  onStart: () => void; onShuffle: () => void; onAiGenerate: () => void;
  onLog: () => void; onSettings: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <header className="flex items-start justify-between mb-6">
        <div>
          <p className="text-emerald-300/80 text-sm">{greeting()}</p>
          <h1 className="font-display text-3xl font-semibold text-white tracking-tight">OfflineQuest</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLog}
            className="relative w-10 h-10 rounded-full glass flex items-center justify-center text-white/80 hover:text-white">
            📋
            {logCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {logCount > 9 ? '9+' : logCount}
              </span>
            )}
          </button>
          <button onClick={onSettings}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-white/80 hover:text-white">
            ⚙️
          </button>
        </div>
      </header>

      {streak > 0 && (
        <div className="mb-5 flex items-center gap-2 self-start glass rounded-full pl-2 pr-4 py-1.5">
          <span className="text-lg">🔥</span>
          <span className="text-sm text-white/90 font-semibold">{streak}-day streak</span>
        </div>
      )}

      <div className="text-[11px] font-semibold text-emerald-300/70 uppercase tracking-widest mb-3">
        Today's Quest
      </div>
      <MissionCard mission={mission} />

      <div className="grid grid-cols-2 gap-2 mt-3">
        <GhostButton onClick={onShuffle}>🎲 Shuffle</GhostButton>
        <GhostButton onClick={onAiGenerate}>
          {generating ? <span className="inline-flex items-center gap-2"><Spinner />Conjuring…</span> : '✦ AI Quest'}
        </GhostButton>
      </div>

      <div className="mt-3">
        <PrimaryButton onClick={onStart}>Begin Quest →</PrimaryButton>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto no-scrollbar">
        <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Explore</div>
        <div className="grid grid-cols-2 gap-2 pb-6">
          {missions.slice(0, 8).map(m => (
            <div key={m.id} className="glass rounded-2xl p-3 flex items-center gap-2">
              <span className="text-xl">{m.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/90 truncate">{m.title}</p>
                <p className="text-[10px] text-white/40">{m.durationMin} min</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MOOD BEFORE ───────────────────────────────────────────────
function MoodBeforeScreen({
  mission, onNext, onBack,
}: { mission: Mission; onNext: (m: MoodLevel) => void; onBack: () => void }) {
  const [mood, setMood] = useState<MoodLevel | null>(null);
  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <BackBtn onClick={onBack} />
      <div className="text-center mt-4 mb-2">
        <div className="text-4xl mb-2 animate-float">🌿</div>
        <h2 className="font-display text-2xl font-semibold text-white">Before you go…</h2>
        <p className="text-white/50 text-sm mt-1">How are you feeling right now?</p>
      </div>
      <div className="my-4"><MissionCard mission={mission} compact /></div>
      <MoodPicker value={mood} onChange={setMood} />
      <div className="mt-auto pb-6">
        <PrimaryButton disabled={!mood} onClick={() => mood && onNext(mood)}>
          Start Quest →
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── ACTIVE ────────────────────────────────────────────────────
function ActiveScreen({
  mission, moodBefore, settings, onAffirmation, onVision, onDone,
}: {
  mission: Mission; moodBefore: MoodLevel; settings: Settings;
  onAffirmation: (t: string) => void;
  onVision: (v: { note: string; verified: boolean }) => void;
  onDone: () => void;
}) {
  const [timerDone, setTimerDone] = useState(false);
  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <div className="text-center mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/70">In progress</span>
        <h2 className="font-display text-2xl font-semibold text-white mt-1">{mission.emoji} {mission.title}</h2>
      </div>

      <div className="rounded-3xl glass p-6 flex flex-col items-center gap-4">
        <Timer durationMin={mission.durationMin} onDone={() => setTimerDone(true)} />
        <p className="text-white/70 text-sm text-center leading-relaxed max-w-xs">{mission.description}</p>
      </div>

      <div className="mt-4 space-y-2 flex-1 overflow-y-auto no-scrollbar pb-2">
        <AffirmationPanel settings={settings} mission={mission} moodBefore={moodBefore}
          onAffirmation={onAffirmation} />
        <CameraVerify settings={settings} mission={mission} onResult={onVision} />
      </div>

      <div className="pb-6">
        {timerDone && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center text-emerald-300 text-sm font-medium mb-2">
            ✨ Time's up — how do you feel?
          </motion.p>
        )}
        <PrimaryButton onClick={onDone}>
          {timerDone ? "I'm done →" : 'Finish early →'}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── MOOD AFTER ────────────────────────────────────────────────
function MoodAfterScreen({
  mission, moodBefore, settings, onAffirmation, onSave, onBack,
}: {
  mission: Mission; moodBefore: MoodLevel;
  settings: Settings;
  onAffirmation: (t: string) => void;
  onSave: (m: MoodLevel) => void; onBack: () => void;
}) {
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const before = MOOD_OPTIONS.find(o => o.level === moodBefore)!;
  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <BackBtn onClick={onBack} />
      <div className="text-center mt-4 mb-2">
        <div className="text-4xl mb-2 animate-float">✨</div>
        <h2 className="font-display text-2xl font-semibold text-white">Quest complete!</h2>
        <p className="text-white/50 text-sm mt-1">How do you feel now?</p>
      </div>

      <div className="glass rounded-2xl px-5 py-3 flex items-center justify-between my-3">
        <span className="text-sm text-white/50">Before</span>
        <span className="flex items-center gap-2 font-semibold text-white/90">
          <span className="text-xl">{before.emoji}</span> {before.label}
        </span>
      </div>

      <MoodPicker value={mood} onChange={setMood} />
      {mood && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center -mt-1 mb-2">
          <span className={`text-sm font-bold ${moodDelta(moodBefore, mood).color}`}>
            {moodDelta(moodBefore, mood).text}
          </span>
        </motion.div>
      )}

      <div className="my-2">
        <AffirmationPanel settings={settings} mission={mission}
          moodBefore={moodBefore} moodAfter={mood ?? undefined}
          onAffirmation={onAffirmation} />
      </div>

      <div className="mt-auto pb-6">
        <PrimaryButton disabled={!mood} onClick={() => mood && onSave(mood)}>
          Save to journal →
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── LOG ───────────────────────────────────────────────────────
function LogScreen({
  entries, streak, onBack, onClear,
}: { entries: LogEntry[]; streak: number; onBack: () => void; onClear: () => void }) {
  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '—';
  const lift = entries.length
    ? (entries.reduce((s, e) => s + (e.moodAfter - e.moodBefore), 0) / entries.length).toFixed(1)
    : '—';

  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <div className="flex items-center justify-between mb-4">
        <BackBtn onClick={onBack} inline />
        {entries.length > 0 && (
          <button onClick={onClear} className="text-xs text-rose-300/70 hover:text-rose-300">Clear all</button>
        )}
      </div>
      <h2 className="font-display text-3xl font-semibold text-white mb-1">Journal</h2>
      <p className="text-white/50 text-sm mb-4">{entries.length} quest{entries.length !== 1 ? 's' : ''} · {streak}-day streak 🔥</p>

      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Stat label="Avg before" value={avg(entries.map(e => e.moodBefore))} />
          <Stat label="Avg after" value={avg(entries.map(e => e.moodAfter))} highlight />
          <Stat label="Avg lift" value={`+${lift}`} highlight />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4 animate-float">🌱</div>
          <p className="text-white/70 font-medium">No quests yet.</p>
          <p className="text-white/40 text-sm mt-1">Complete your first to start tracking.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-6">
          {[...entries].reverse().map(e => {
            const before = MOOD_OPTIONS.find(o => o.level === e.moodBefore)!;
            const after = MOOD_OPTIONS.find(o => o.level === e.moodAfter)!;
            const d = moodDelta(e.moodBefore, e.moodAfter);
            const date = new Date(e.completedAt);
            return (
              <div key={e.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{e.missionEmoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                        {e.missionTitle}
                        {e.verified && <span className="text-emerald-300 text-xs">✓</span>}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${d.color}`}>{d.text}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="text-xl">{before.emoji}</span>
                  <span className="text-white/30">→</span>
                  <span className="text-xl">{after.emoji}</span>
                </div>
                {e.affirmation && (
                  <p className="font-display text-xs italic text-white/60 mt-2 leading-relaxed">"{e.affirmation}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────
function SettingsScreen({
  settings, update, hasOpenAi, hasOllamaCloud, hasElevenLabs, providerSummary, onBack,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  hasOpenAi: boolean; hasOllamaCloud: boolean; hasElevenLabs: boolean;
  providerSummary: string; onBack: () => void;
}) {
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingOllama, setTestingOllama] = useState<'cloud' | 'local' | null>(null);
  const [testingVision, setTestingVision] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  const testVoice = async () => {
    setTestingVoice(true);
    await speak(settings, 'Take a slow breath. The earth is steady beneath you, and so are you.', () => {});
    setTimeout(() => setTestingVoice(false), 1200);
  };

  const showStatus = (ok: boolean, message: string) => {
    setStatusOk(ok);
    setStatusMsg(message);
  };

  const testOllama = async (host: 'cloud' | 'local') => {
    setTestingOllama(host);
    setStatusMsg(null);
    const r = await testOllamaConnection(settings, host);
    showStatus(r.ok, r.message);
    setTestingOllama(null);
  };

  const testAll = async () => {
    setTestingAll(true);
    setStatusMsg(null);
    const parts: string[] = [];
    let anyOk = false;

    if (settings.openAiKey.trim()) {
      const r = await testOpenAiConnection(settings);
      parts.push(r.message);
      if (r.ok) anyOk = true;
    }
    if (settings.elevenLabsKey.trim()) {
      const r = await testElevenLabsConnection(settings);
      parts.push(r.message);
      if (r.ok) anyOk = true;
    }
    if (settings.ollamaApiKey.trim() || settings.ollamaProxyUrl.trim() || effectiveProxyUrl(settings)) {
      const r = await testOllamaConnection(settings, 'cloud');
      parts.push(r.message);
      if (r.ok) anyOk = true;
      const vr = await testVisionConnection(settings);
      parts.push(vr.message);
      if (vr.ok) anyOk = true;
    }
    if (!parts.length) {
      showStatus(false, 'No API keys entered yet — paste keys below, then tap Test all.');
    } else {
      showStatus(anyOk, parts.join(' · '));
    }
    setTestingAll(false);
  };

  const showOpenAi = settings.aiProvider === 'openai' || settings.aiProvider === 'auto';
  const showOllamaCloud = settings.aiProvider === 'ollama-cloud' || settings.aiProvider === 'auto';
  const showOllamaLocal = settings.aiProvider === 'ollama-local' || settings.aiProvider === 'auto';

  return (
    <div className="flex flex-col h-full px-5 pt-6">
      <BackBtn onClick={onBack} />
      <h2 className="font-display text-3xl font-semibold text-white mt-4 mb-1">AI & Voice</h2>
      <p className="text-white/50 text-sm mb-1">Keys stay on this device only.</p>
      <p className="text-emerald-300/70 text-xs mb-4">Active: {providerSummary}</p>

      <div className="glass rounded-2xl p-4 mb-4 border border-emerald-300/20 bg-emerald-400/5">
        <p className="text-sm font-semibold text-emerald-100 mb-1">📱 GitHub Pages</p>
        <p className="text-[11px] text-white/55 leading-relaxed">
          <strong className="text-white/80">Ollama Cloud is pre-configured</strong> via proxy — no Ollama key needed in the app.
          Paste <strong className="text-white/80">OpenAI</strong> and <strong className="text-white/80">ElevenLabs</strong> keys below for voice &amp; vision.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-6">
        <Field label="Your name (optional)" hint="Personalizes affirmations">
          <input
            value={settings.affirmationName}
            onChange={e => update({ affirmationName: e.target.value })}
            placeholder="e.g. Aaron"
            className="oq-input"
          />
        </Field>

        {/* ── AI Provider ── */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <span className="text-sm font-semibold text-white">🤖 AI Provider</span>
          <div className="grid grid-cols-1 gap-2">
            {AI_PROVIDER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => update({ aiProvider: opt.id as AiProvider })}
                className={`text-left rounded-xl p-3 border transition-all ${
                  settings.aiProvider === opt.id
                    ? 'border-emerald-400/50 bg-emerald-400/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <p className="text-sm font-semibold text-white">{opt.label}</p>
                <p className="text-[11px] text-white/45 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Ollama Cloud ── */}
        {showOllamaCloud && (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">🦙 Ollama Cloud</span>
              <Badge ok={hasOllamaCloud} />
            </div>
            <p className="text-[11px] text-white/40 -mt-2">
              Gemma 4, Kimi K2.5, GLM 4.7, GPT-OSS 120B — huge models via{' '}
              <a href="https://ollama.com/search?c=cloud" target="_blank" rel="noreferrer" className="text-emerald-300/80 underline">ollama.com</a>
            </p>
            <Field label="API key" hint="From ollama.com/settings/keys">
              <input
                type="password" value={settings.ollamaApiKey}
                onChange={e => update({ ollamaApiKey: e.target.value })}
                placeholder="..." className="oq-input" autoComplete="off"
              />
            </Field>
            <Field label="Proxy URL" hint={`Auto-enabled on GitHub Pages (${OLLAMA_PROXY_URL})`}>
              <input
                value={settings.ollamaProxyUrl}
                onChange={e => update({ ollamaProxyUrl: e.target.value })}
                placeholder={OLLAMA_PROXY_URL}
                className="oq-input"
              />
            </Field>
            <ModelSelect
              label="Text model"
              value={settings.ollamaTextModel}
              onChange={v => update({ ollamaTextModel: v })}
              options={OLLAMA_CLOUD_TEXT_MODELS}
            />
            <ModelSelect
              label="Vision model"
              value={settings.ollamaVisionModel}
              onChange={v => update({ ollamaVisionModel: v })}
              options={OLLAMA_CLOUD_VISION_MODELS}
            />
            <div className="flex gap-2 flex-wrap">
              <a href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer"
                className="text-xs text-emerald-300/80 hover:text-emerald-200 underline flex-1">
                Get Ollama key ↗
              </a>
              <button
                onClick={() => testOllama('cloud')}
                disabled={testingOllama === 'cloud'}
                className="text-xs text-white/60 hover:text-white disabled:opacity-50"
              >
                {testingOllama === 'cloud' ? 'Testing…' : 'Test connection'}
              </button>
              <button
                onClick={async () => {
                  setTestingVision(true);
                  setStatusMsg(null);
                  const r = await testVisionConnection(settings);
                  showStatus(r.ok, r.message);
                  setTestingVision(false);
                }}
                disabled={testingVision}
                className="text-xs text-white/60 hover:text-white disabled:opacity-50"
              >
                {testingVision ? 'Testing…' : 'Test vision'}
              </button>
            </div>
          </div>
        )}

        {/* ── Ollama Local ── */}
        {showOllamaLocal && (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">💻 Ollama Local</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-400/15 text-sky-300">No key</span>
            </div>
            <p className="text-[11px] text-white/40 -mt-2">
              Runs on your PC at localhost:11434 — private, no API key needed.
            </p>
            <ModelSelect
              label="Text model"
              value={settings.ollamaTextModel}
              onChange={v => update({ ollamaTextModel: v })}
              options={OLLAMA_LOCAL_TEXT_MODELS}
            />
            <ModelSelect
              label="Vision model"
              value={settings.ollamaVisionModel}
              onChange={v => update({ ollamaVisionModel: v })}
              options={OLLAMA_LOCAL_VISION_MODELS}
            />
            <div className="flex gap-2 items-center">
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer"
                className="text-xs text-emerald-300/80 hover:text-emerald-200 underline flex-1">
                Download Ollama ↗
              </a>
              <button
                onClick={() => testOllama('local')}
                disabled={testingOllama === 'local'}
                className="text-xs text-white/60 hover:text-white disabled:opacity-50"
              >
                {testingOllama === 'local' ? 'Testing…' : 'Test local'}
              </button>
            </div>
            <p className="text-[10px] text-white/35">
              Pull models first: <code className="text-emerald-300/60">ollama pull gemma4:12b</code>
            </p>
          </div>
        )}

        {statusMsg && (
          <p className={`text-xs px-3 py-2 rounded-xl ${statusOk ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
            {statusMsg}
          </p>
        )}

        <button onClick={testAll} disabled={testingAll}
          className="w-full py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/30 disabled:opacity-50">
          {testingAll ? 'Testing connections…' : '🔌 Test all connections'}
        </button>

        {/* ── OpenAI ── */}
        {showOpenAi && (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">🧠 OpenAI</span>
              <Badge ok={hasOpenAi} />
            </div>
            <Field label="API key" hint="GPT-4o — best vision, fast affirmations">
              <input
                type="password" value={settings.openAiKey}
                onChange={e => update({ openAiKey: e.target.value })}
                placeholder="sk-..." className="oq-input" autoComplete="off"
              />
            </Field>
            <ModelSelect
              label="Text model"
              value={settings.openAiTextModel}
              onChange={v => update({ openAiTextModel: v })}
              options={OPENAI_TEXT_MODELS}
            />
            <ModelSelect
              label="Vision model"
              value={settings.openAiVisionModel}
              onChange={v => update({ openAiVisionModel: v })}
              options={OPENAI_VISION_MODELS}
            />
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
              className="text-xs text-emerald-300/80 hover:text-emerald-200 underline">
              Get OpenAI key ↗
            </a>
            <button
              onClick={async () => {
                const r = await testOpenAiConnection(settings);
                showStatus(r.ok, r.message);
              }}
              className="text-xs text-white/60 hover:text-white w-full text-left"
            >
              Test OpenAI connection
            </button>
          </div>
        )}

        {/* ── ElevenLabs ── */}
        <div className="glass rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">🎙️ ElevenLabs voice</span>
            <Badge ok={hasElevenLabs} />
          </div>
          <Field label="API key" hint="From elevenlabs.io → Profile → API Keys. Enable: Text to Speech, Voices (Read), User (Read).">
            <input
              type="password" value={settings.elevenLabsKey}
              onChange={e => update({ elevenLabsKey: e.target.value.replace(/\s+/g, '') })}
              placeholder="Paste key only — no spaces" className="oq-input" autoComplete="off"
            />
          </Field>
          <Field label="Voice">
            <select
              value={settings.elevenLabsVoiceId}
              onChange={e => update({ elevenLabsVoiceId: e.target.value })}
              className="oq-input"
            >
              {VOICE_PRESETS.map(v => (
                <option key={v.id} value={v.id} className="bg-stone-900">
                  {v.name} — {v.vibe}
                </option>
              ))}
            </select>
          </Field>
          <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer"
            className="text-xs text-emerald-300/80 hover:text-emerald-200 underline">
            Get / manage ElevenLabs key ↗
          </a>
          <button
            onClick={async () => {
              const r = await testElevenLabsConnection(settings);
              showStatus(r.ok, r.message);
            }}
            className="text-xs text-white/60 hover:text-white w-full text-left"
          >
            Test ElevenLabs connection
          </button>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Spoken affirmations</p>
            <p className="text-xs text-white/40">Read affirmations aloud</p>
          </div>
          <Toggle on={settings.voiceEnabled} onClick={() => update({ voiceEnabled: !settings.voiceEnabled })} />
        </div>

        <button onClick={testVoice} disabled={testingVoice}
          className="w-full py-3 rounded-2xl glass text-white/80 text-sm font-medium hover:text-white disabled:opacity-50">
          {testingVoice ? '🔊 Speaking…' : '▶ Test voice'}
        </button>
      </div>

      <style>{`
        .oq-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0.85rem;
          padding: 0.7rem 0.9rem;
          color: white;
          font-size: 0.9rem;
          outline: none;
        }
        .oq-input::placeholder { color: rgba(255,255,255,0.3); }
        .oq-input:focus { border-color: rgba(52,211,153,0.6); }
      `}</style>
    </div>
  );
}

function ModelSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; name: string; tag: string }[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} className="oq-input">
        {options.map(m => (
          <option key={m.id} value={m.id} className="bg-stone-900">
            {m.name} — {m.tag}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ── small bits ────────────────────────────────────────────────
function BackBtn({ onClick, inline }: { onClick: () => void; inline?: boolean }) {
  return (
    <button onClick={onClick}
      className={`text-white/50 hover:text-white text-sm flex items-center gap-1 ${inline ? '' : 'self-start'}`}>
      ← Back
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${highlight ? 'bg-emerald-400/15 border border-emerald-300/20' : 'glass'}`}>
      <p className={`text-xl font-bold ${highlight ? 'text-emerald-200' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/70 block mb-1.5">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-white/35 block mt-1">{hint}</span>}
    </label>
  );
}

function Badge({ ok, label }: { ok: boolean; label?: string }) {
  const text = ok ? (label ?? 'Connected') : 'Not set';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
      {text}
    </span>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-12 h-7 rounded-full p-1 transition-colors ${on ? 'bg-emerald-500' : 'bg-white/15'}`}>
      <motion.span layout className="block w-5 h-5 rounded-full bg-white"
        style={{ marginLeft: on ? 'auto' : 0 }} />
    </button>
  );
}

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
