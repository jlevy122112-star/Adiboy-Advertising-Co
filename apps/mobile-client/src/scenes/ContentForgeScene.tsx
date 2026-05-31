
import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface ContentForgeSceneProps {
  generationId: string;
  onComplete: () => void;
}

export const ContentForgeScene: React.FC<ContentForgeSceneProps> = ({
  generationId,
  onComplete,
}) => {
  // Purely visual wrapper around cinematic engine + lootbox reveal
  useEffect(() => {
    fetch('/api/rewards/lootbox/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ generationId }),
    }).then(() => onComplete());
  }, [generationId, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient forge glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 60%, rgba(201,168,76,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Giant machine — progress bars, sparks, smoke */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Machine frame */}
        <div className="relative w-48 h-48 border border-classified/20 rounded-2xl bg-desk-900/80 flex items-center justify-center">
          {/* Rotating inner ring */}
          <motion.div
            className="absolute inset-4 rounded-xl border border-classified/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          {/* Counter-rotating inner ring */}
          <motion.div
            className="absolute inset-8 rounded-lg border border-dashed border-classified/15"
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          {/* Core pulse */}
          <motion.div
            className="w-10 h-10 rounded-full bg-classified/20 border border-classified/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />

          {/* Spark particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-classified"
              style={{ top: '50%', left: '50%' }}
              animate={{
                x: [0, Math.cos((i / 6) * Math.PI * 2) * 60],
                y: [0, Math.sin((i / 6) * Math.PI * 2) * 60],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.13,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>

        {/* Progress bars */}
        <div className="w-64 space-y-2">
          {['BRAND INTEL', 'AUDIENCE DATA', 'AI SYNTHESIS', 'ARTIFACT FORGING'].map((label, i) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between">
                <span className="font-classified text-[9px] tracking-[0.2em] text-slate-600 uppercase">
                  {label}
                </span>
              </div>
              <div className="h-0.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-classified"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <motion.p
          className="font-classified text-xs tracking-[0.25em] text-classified/60"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          FORGING CONTENT...
        </motion.p>
      </div>
    </div>
  );
};
