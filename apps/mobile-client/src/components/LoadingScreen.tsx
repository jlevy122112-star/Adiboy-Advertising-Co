import { motion } from 'framer-motion';

export const LoadingScreen = () => (
  <div className="fixed inset-0 bg-void-900 flex flex-col items-center justify-center z-50">
    {/* Animated logo mark */}
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-6"
    >
      {/* Logo */}
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border border-classified/30 absolute inset-0"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border border-dashed border-reactor/20 absolute inset-0"
        />
        <div className="w-16 h-16 flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-6 bg-classified rounded-sm"
            style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
          />
        </div>
      </div>

      {/* Brand name */}
      <div className="text-center">
        <div className="font-display text-2xl tracking-widest text-classified">
          MARKETER PRO
        </div>
        <div className="font-heading text-xs tracking-[0.3em] text-slate-500 uppercase mt-1">
          Office Edition
        </div>
      </div>

      {/* Loading dots */}
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-classified/60"
          />
        ))}
      </div>
    </motion.div>
  </div>
);
