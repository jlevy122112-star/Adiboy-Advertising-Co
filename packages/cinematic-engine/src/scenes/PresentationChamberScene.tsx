
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GenerationResult } from '../types';

interface PresentationChamberSceneProps {
  result: GenerationResult | null;
  error: string | null;
  onDone: () => void;
}

type ChamberPhase = 'fade' | 'briefcase' | 'reveal' | 'ready';

const ARTIFACT_KEYS: Array<keyof GenerationResult> = [
  'copy',
  'captions',
  'hashtags',
  'variations',
  'images',
];

const ARTIFACT_LABELS: Record<keyof GenerationResult, string> = {
  copy:       'COPY DOSSIER',
  captions:   'CAPTION FILE',
  hashtags:   'HASHTAG SET',
  variations: 'VARIATIONS',
  images:     'VISUAL ASSETS',
  id:         'ID',
};

export const PresentationChamberScene: React.FC<PresentationChamberSceneProps> = ({
  result,
  error,
  onDone,
}) => {
  const [phase, setPhase] = useState<ChamberPhase>('fade');

  useEffect(() => {
    // 0.2s fade to black
    const t1 = setTimeout(() => setPhase('briefcase'), 200);
    // 0.2s briefcase slam + 0.2s latches + 0.5s fog/glow = 0.6s
    const t2 = setTimeout(() => setPhase('reveal'), 600);
    // 0.5s reveal animation
    const t3 = setTimeout(() => setPhase('ready'), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleSelectArtifact = (_type: keyof GenerationResult) => {
    // Navigate to editor/preview with selected artifact, then call onDone
    onDone();
  };

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <p className="font-display text-2xl tracking-[0.2em] text-red-500">REACTOR FAILURE</p>
          <p className="font-classified text-sm text-red-400/70 mt-2">{error}</p>
        </div>
        <button
          onClick={onDone}
          className="font-classified text-xs tracking-[0.25em] text-slate-500 hover:text-slate-300 uppercase transition-colors border border-white/10 px-6 py-2 rounded-lg"
        >
          Return to Desk
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">

      {/* Spotlight — visible from briefcase phase onward */}
      <AnimatePresence>
        {(phase === 'briefcase' || phase === 'reveal' || phase === 'ready') && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'radial-gradient(ellipse 40% 60% at 50% 30%, rgba(201,168,76,0.08) 0%, rgba(0,0,0,0) 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Fog layer */}
      <AnimatePresence>
        {phase === 'reveal' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: 'linear-gradient(to top, rgba(201,168,76,0.04) 0%, transparent 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Metal table */}
      <AnimatePresence>
        {(phase === 'briefcase' || phase === 'reveal' || phase === 'ready') && (
          <motion.div
            className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-80 h-2 rounded-full bg-slate-800 border border-white/[0.06]"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Briefcase */}
      <AnimatePresence>
        {(phase === 'briefcase' || phase === 'reveal') && (
          <motion.div
            className="absolute bottom-1/3 mb-2 w-32 h-20 rounded-lg border border-classified/30 bg-desk-900 flex flex-col items-center justify-center gap-1"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ boxShadow: '0 0 30px rgba(201,168,76,0.12)' }}
          >
            {/* Latch lines */}
            <div className="w-12 h-0.5 rounded-full bg-classified/30" />
            <div className="w-8 h-0.5 rounded-full bg-classified/20" />
            <div className="w-12 h-0.5 rounded-full bg-classified/30" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artifact cards — shown when ready */}
      <AnimatePresence>
        {phase === 'ready' && result && (
          <motion.div
            className="flex flex-col items-center gap-6 w-full max-w-md px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <p className="font-display text-lg tracking-[0.25em] text-classified">
              CLASSIFIED ASSETS READY
            </p>

            <div className="w-full space-y-2">
              {ARTIFACT_KEYS.map((key, i) => {
                const items = result[key] as string[];
                if (!items || items.length === 0) return null;
                return (
                  <motion.button
                    key={key}
                    onClick={() => handleSelectArtifact(key)}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-classified/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-6 rounded-full bg-classified/40 group-hover:bg-classified/70 transition-colors" />
                      <div className="text-left">
                        <p className="font-classified text-xs tracking-[0.2em] text-classified/80 group-hover:text-classified transition-colors">
                          {ARTIFACT_LABELS[key]}
                        </p>
                        <p className="font-body text-xs text-slate-600 mt-0.5">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="font-classified text-xs text-slate-700 group-hover:text-classified/60 transition-colors">
                      OPEN →
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <button
              onClick={onDone}
              className="font-classified text-[10px] tracking-[0.25em] text-slate-700 hover:text-slate-500 transition-colors uppercase mt-2"
            >
              Return to Desk
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state — waiting for result while phases play */}
      <AnimatePresence>
        {phase === 'ready' && !result && !error && (
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-classified/60"
                />
              ))}
            </div>
            <p className="font-classified text-xs tracking-[0.25em] text-slate-600">
              PROCESSING...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
