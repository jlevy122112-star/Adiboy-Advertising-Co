
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReactorSceneProps {
  onDone: () => void;
  onAbort: () => void;
}

type SwitchKey = 'a' | 'b' | 'c';

const SWITCH_LABELS: Record<SwitchKey, string> = {
  a: 'BRAND INTEL',
  b: 'AUDIENCE',
  c: 'AI CORE',
};

export const ReactorScene: React.FC<ReactorSceneProps> = ({ onDone, onAbort }) => {
  const [switches, setSwitches] = useState<Record<SwitchKey, boolean>>({
    a: false,
    b: false,
    c: false,
  });
  const [leverPulled, setLeverPulled] = useState(false);

  const allSwitchesOn = switches.a && switches.b && switches.c;
  const switchesOnCount = Object.values(switches).filter(Boolean).length;

  const handleToggleSwitch = (key: SwitchKey) => {
    if (leverPulled) return;
    setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePullLever = () => {
    if (!allSwitchesOn || leverPulled) return;
    setLeverPulled(true);
    // Lever animation ~0.4s + reactor animation ~0.3s = ~0.9s total
    setTimeout(onDone, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center">
      {/* Reactor core glow — intensifies with each switch */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: leverPulled
            ? 'radial-gradient(ellipse at center, rgba(30,144,255,0.3) 0%, rgba(0,0,0,0) 60%)'
            : `radial-gradient(ellipse at center, rgba(30,144,255,${switchesOnCount * 0.06}) 0%, rgba(0,0,0,0) 60%)`,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Title */}
      <div className="mb-10 text-center">
        <p className="font-display text-2xl tracking-[0.3em] text-reactor">
          REACTOR CONTROL
        </p>
        <p className="font-classified text-xs tracking-[0.25em] text-slate-600 mt-1">
          {allSwitchesOn ? 'SYSTEMS ARMED — PULL LEVER' : `ARM ALL SYSTEMS (${switchesOnCount}/3)`}
        </p>
      </div>

      {/* Switches A / B / C */}
      <div className="flex items-end gap-10 mb-12">
        {(['a', 'b', 'c'] as SwitchKey[]).map((key) => (
          <div key={key} className="flex flex-col items-center gap-3">
            {/* Switch label */}
            <span className="font-classified text-[9px] tracking-[0.2em] text-slate-500 uppercase">
              {SWITCH_LABELS[key]}
            </span>

            {/* Switch track */}
            <button
              onClick={() => handleToggleSwitch(key)}
              disabled={leverPulled}
              className="relative w-10 h-20 rounded-full border flex items-center justify-center transition-all duration-200"
              style={{
                borderColor: switches[key] ? 'rgba(30,144,255,0.6)' : 'rgba(255,255,255,0.1)',
                background: switches[key]
                  ? 'rgba(30,144,255,0.08)'
                  : 'rgba(255,255,255,0.02)',
              }}
            >
              {/* Switch knob */}
              <motion.div
                className="w-7 h-7 rounded-full border"
                animate={{
                  y: switches[key] ? -20 : 20,
                  borderColor: switches[key] ? 'rgba(30,144,255,0.8)' : 'rgba(255,255,255,0.2)',
                  backgroundColor: switches[key] ? 'rgba(30,144,255,0.4)' : 'rgba(255,255,255,0.05)',
                  boxShadow: switches[key]
                    ? '0 0 12px rgba(30,144,255,0.5)'
                    : 'none',
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            </button>

            {/* On/off indicator */}
            <div className={`
              w-1.5 h-1.5 rounded-full transition-colors duration-300
              ${switches[key] ? 'bg-reactor' : 'bg-slate-700'}
            `} />
          </div>
        ))}
      </div>

      {/* Lever */}
      <div className="flex flex-col items-center gap-3">
        <span className="font-classified text-[9px] tracking-[0.2em] text-slate-500 uppercase">
          {leverPulled ? 'FIRED' : allSwitchesOn ? 'PULL TO FIRE' : 'LOCKED'}
        </span>

        {/* Lever track */}
        <div className="relative w-8 h-28 rounded-full border border-white/10 bg-white/[0.02] flex items-start justify-center pt-2">
          <motion.button
            onClick={handlePullLever}
            disabled={!allSwitchesOn || leverPulled}
            className="w-6 h-10 rounded-full border flex items-center justify-center"
            animate={{
              y: leverPulled ? 64 : 0,
              borderColor: allSwitchesOn && !leverPulled
                ? 'rgba(201,168,76,0.8)'
                : leverPulled
                  ? 'rgba(30,144,255,0.8)'
                  : 'rgba(255,255,255,0.15)',
              backgroundColor: allSwitchesOn && !leverPulled
                ? 'rgba(201,168,76,0.15)'
                : 'rgba(255,255,255,0.03)',
              boxShadow: allSwitchesOn && !leverPulled
                ? '0 0 16px rgba(201,168,76,0.4)'
                : leverPulled
                  ? '0 0 20px rgba(30,144,255,0.6)'
                  : 'none',
            }}
            transition={{ duration: 0.4, ease: 'easeIn' }}
            whileTap={{ scale: 0.94 }}
          >
            <div className={`
              w-2 h-2 rounded-full transition-colors duration-300
              ${leverPulled ? 'bg-reactor' : allSwitchesOn ? 'bg-classified' : 'bg-slate-700'}
            `} />
          </motion.button>
        </div>
      </div>

      {/* Reactor firing flash */}
      <AnimatePresence>
        {leverPulled && (
          <motion.div
            className="absolute inset-0 bg-reactor pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 0.3, delay: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Abort button */}
      <button
        onClick={onAbort}
        disabled={leverPulled}
        className="absolute bottom-8 font-classified text-[10px] tracking-[0.25em] text-slate-700 hover:text-slate-500 transition-colors uppercase disabled:opacity-0"
      >
        Abort
      </button>
    </div>
  );
};
