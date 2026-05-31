
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VaultDoorSceneProps {
  onDone: () => void;
}

type ScanPhase = 'idle' | 'scanning' | 'unlocking' | 'opening';

export const VaultDoorScene: React.FC<VaultDoorSceneProps> = ({ onDone }) => {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [lockAngles, setLockAngles] = useState([0, 0, 0, 0]);

  const handleScan = () => {
    if (phase !== 'idle') return;
    setPhase('scanning');

    // Biometric scan animation
    setTimeout(() => {
      setPhase('unlocking');
      // Rotate locks
      setLockAngles([90, -90, 135, -135]);
    }, 300);

    // After ~0.6s total, call onDone
    setTimeout(onDone, 600);
  };

  // Auto-trigger for non-interactive environments
  useEffect(() => {
    const timer = setTimeout(handleScan, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Fog overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: phase === 'scanning'
            ? 'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, rgba(0,0,0,0.95) 70%)'
            : 'radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 70%)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Vault door frame */}
      <div className="relative flex items-center justify-center w-72 h-72">

        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-classified/20"
          animate={{ rotate: phase === 'unlocking' ? 180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />

        {/* Inner ring */}
        <motion.div
          className="absolute inset-4 rounded-full border border-classified/30"
          animate={{ rotate: phase === 'unlocking' ? -180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />

        {/* Lock bolts — 4 positions */}
        {([0, 90, 180, 270] as const).map((angle, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-8 bg-classified/40 rounded-sm origin-bottom"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: -6,
              marginTop: -120,
              transformOrigin: '50% 120px',
              rotate: `${angle}deg`,
            }}
            animate={{
              rotate: `${angle + lockAngles[i]}deg`,
              opacity: phase === 'unlocking' ? 0.8 : 0.4,
            }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: i * 0.04 }}
          />
        ))}

        {/* Biometric scanner — center */}
        <motion.button
          onClick={handleScan}
          disabled={phase !== 'idle'}
          className="relative z-10 w-24 h-24 rounded-full border border-classified/40 flex flex-col items-center justify-center gap-1 cursor-pointer"
          animate={{
            boxShadow: phase === 'scanning'
              ? '0 0 40px rgba(201,168,76,0.5), 0 0 80px rgba(201,168,76,0.2)'
              : '0 0 20px rgba(201,168,76,0.15)',
            borderColor: phase === 'scanning'
              ? 'rgba(201,168,76,0.8)'
              : 'rgba(201,168,76,0.4)',
          }}
          transition={{ duration: 0.2 }}
          whileTap={{ scale: 0.96 }}
        >
          {/* Scan lines */}
          <AnimatePresence>
            {phase === 'scanning' && (
              <motion.div
                className="absolute inset-0 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute inset-x-0 h-0.5 bg-classified/60"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 0.3, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fingerprint icon lines */}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            {[20, 28, 32, 28, 20].map((w, i) => (
              <motion.div
                key={i}
                className="h-0.5 rounded-full bg-classified"
                style={{ width: w }}
                animate={{ opacity: phase === 'scanning' ? [0.4, 1, 0.4] : 0.5 }}
                transition={{ duration: 0.3, delay: i * 0.05, repeat: phase === 'scanning' ? Infinity : 0 }}
              />
            ))}
          </div>

          <span className="font-classified text-[9px] tracking-[0.2em] text-classified/70 mt-1">
            {phase === 'idle' ? 'SCAN' : phase === 'scanning' ? 'READING' : 'GRANTED'}
          </span>
        </motion.button>

        {/* Corner brackets */}
        {[
          'top-0 left-0 border-t border-l',
          'top-0 right-0 border-t border-r',
          'bottom-0 left-0 border-b border-l',
          'bottom-0 right-0 border-b border-r',
        ].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-6 h-6 border-classified/30 ${cls}`}
          />
        ))}
      </div>

      {/* Status text */}
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-1">
        <motion.p
          className="font-classified text-xs tracking-[0.3em] text-classified/60 uppercase"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {phase === 'idle' ? 'AWAITING AUTHORIZATION' : phase === 'scanning' ? 'SCANNING...' : 'ACCESS GRANTED'}
        </motion.p>
      </div>

      {/* Authorize Access fallback button */}
      <button
        onClick={handleScan}
        className="absolute bottom-6 font-classified text-[10px] tracking-[0.25em] text-classified/30 hover:text-classified/60 transition-colors uppercase"
      >
        Authorize Access
      </button>
    </div>
  );
};
