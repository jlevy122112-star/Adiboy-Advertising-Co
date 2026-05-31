import { motion } from 'framer-motion';

export const OnboardingPage = () => (
  <div className="flex flex-col h-screen bg-void-900 items-center justify-center safe-top">
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <h1 className="font-display text-3xl tracking-wider text-classified">WELCOME</h1>
      <p className="text-sm text-slate-500 mt-2">Onboarding — Phase 1 Slice 3</p>
    </motion.div>
  </div>
);
