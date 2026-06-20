import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Mission, Settings } from '../types';
import { analyzeImage, type VisionResult } from '../lib/ai';

export function CameraVerify({
  settings, mission, onResult,
}: {
  settings: Settings;
  mission: Mission;
  onResult?: (r: VisionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setShot(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError('Camera unavailable. Check browser permissions.');
    }
  }, []);

  useEffect(() => {
    if (open) startCamera();
    return () => stopStream();
  }, [open, startCamera, stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const maxW = 768;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setShot(dataUrl);
    stopStream();
  };

  const analyze = async () => {
    if (!shot) return;
    setAnalyzing(true);
    try {
      const r = await analyzeImage(settings, mission, shot);
      setResult(r);
      onResult?.(r);
    } finally {
      setAnalyzing(false);
    }
  };

  const close = () => {
    stopStream();
    setOpen(false);
    setShot(null);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        className="w-full py-3.5 rounded-2xl glass text-white font-medium text-sm flex items-center justify-center gap-2 hover:border-white/30 transition-all"
      >
        📸 Verify with AI vision
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl glass-dark overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <span className="font-display text-lg text-white">{mission.emoji} Verify Quest</span>
                <button onClick={close} className="text-white/50 hover:text-white text-xl leading-none">✕</button>
              </div>

              <div className="relative aspect-3/4 bg-black mx-4 rounded-2xl overflow-hidden">
                {!shot && (
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                )}
                {shot && (
                  <img src={shot} alt="capture" className="w-full h-full object-cover" />
                )}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-white/70 text-sm p-6">
                    {error}
                  </div>
                )}
                {analyzing && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                    <span className="w-8 h-8 border-2 border-white/30 border-t-emerald-300 rounded-full animate-spin" />
                    <span className="text-white/80 text-sm">AI is looking…</span>
                  </div>
                )}

                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      className="absolute bottom-0 inset-x-0 p-4 bg-linear-to-t from-black/95 to-transparent"
                    >
                      <div className={`text-xs font-bold mb-1 ${result.verified ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {result.verified ? '✓ Quest verified' : '○ Keep exploring'}
                        {result.provider && (
                          <span className="font-normal text-white/40 ml-1">· {result.provider}</span>
                        )}
                      </div>
                      <p className="text-white/90 text-sm leading-snug">{result.note}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4 flex gap-2">
                {!shot && streaming && (
                  <button
                    onClick={capture}
                    className="flex-1 py-3.5 rounded-2xl bg-white text-stone-900 font-semibold text-sm"
                  >
                    ◉ Capture
                  </button>
                )}
                {shot && !result && (
                  <>
                    <button
                      onClick={startCamera}
                      className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-medium text-sm"
                    >
                      ↻ Retake
                    </button>
                    <button
                      onClick={analyze}
                      disabled={analyzing}
                      className="flex-1 py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm disabled:opacity-50"
                    >
                      ✦ Analyze
                    </button>
                  </>
                )}
                {result && (
                  <button
                    onClick={close}
                    className="flex-1 py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm"
                  >
                    Done
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
