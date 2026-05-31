import { motion } from 'framer-motion';
import { useProgression } from '../../contexts/ProgressionContext';

const OFFICE_BACKGROUNDS: Record<number, { gradient: string; particles: string; label: string }> = {
  1:  { gradient: 'from-void-950 via-void-900 to-desk-900', particles: 'opacity-20', label: 'Starter Office' },
  2:  { gradient: 'from-void-950 via-desk-800 to-desk-900', particles: 'opacity-30', label: 'Junior Suite' },
  5:  { gradient: 'from-void-950 via-desk-700 to-desk-800', particles: 'opacity-40', label: 'Senior Suite' },
  10: { gradient: 'from-void-950 via-[#0a1428] to-desk-700', particles: 'opacity-50', label: 'Executive Floor' },
  15: { gradient: 'from-void-950 via-[#080d1a] to-[#0d1520]', particles: 'opacity-60', label: 'Director\'s Office' },
  20: { gradient: 'from-void-950 via-[#060910] to-[#0a0f1a]', particles: 'opacity-70', label: 'C-Suite Penthouse' },
};

const getBackground = (level: number) => {
  const keys = Object.keys(OFFICE_BACKGROUNDS).map(Number).sort((a, b) => b - a);
  const key = keys.find(k => level >= k) ?? 1;
  return OFFICE_BACKGROUNDS[key];
};

// Floating particles for atmosphere
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 8 + 6,
  delay: Math.random() * 4,
}));

export const DeskBackground = () => {
  const { officeState } = useProgression();
  const level = officeState?.level ?? 1;
  const bg = getBackground(level);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bg.gradient}`} />

      {/* Radial glow from center-top */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Bottom depth gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 50% at 50% 110%, rgba(30,144,255,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Scanline texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
          backgroundSize: '100% 4px',
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      <div className={`absolute inset-0 ${bg.particles}`}>
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-classified/40"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Corner accent — top right */}
      <div
        className="absolute top-0 right-0 w-64 h-64 opacity-[0.04]"
        style={{
          background: 'conic-gradient(from 180deg at 100% 0%, rgba(201,168,76,0.8) 0deg, transparent 90deg)',
        }}
      />

      {/* Corner accent — bottom left */}
      <div
        className="absolute bottom-0 left-0 w-48 h-48 opacity-[0.04]"
        style={{
          background: 'conic-gradient(from 0deg at 0% 100%, rgba(30,144,255,0.8) 0deg, transparent 90deg)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,4,8,0.7) 100%)',
        }}
      />
    </div>
  );
};
