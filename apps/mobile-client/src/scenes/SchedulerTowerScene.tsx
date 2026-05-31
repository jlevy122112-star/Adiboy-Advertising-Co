
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addHours, addDays } from 'date-fns';
import { Clock, Zap, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface SchedulerTowerSceneProps {
  artifactId: string;
  onScheduled: () => void;
}

type ScheduleMode = 'select' | 'confirm';

const QUICK_OPTIONS = [
  { label: 'In 2 hours',    getValue: () => addHours(new Date(), 2)   },
  { label: 'Tonight 8pm',   getValue: () => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; } },
  { label: 'Tomorrow 9am',  getValue: () => { const d = addDays(new Date(), 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'Tomorrow noon', getValue: () => { const d = addDays(new Date(), 1); d.setHours(12, 0, 0, 0); return d; } },
];

export const SchedulerTowerScene: React.FC<SchedulerTowerSceneProps> = ({
  artifactId,
  onScheduled,
}) => {
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [mode, setMode] = useState<ScheduleMode>('select');
  const [autoReason, setAutoReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAutoSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artifactId }),
      });
      const data = await res.json();
      setScheduledAt(new Date(data.scheduledAt));
      setAutoReason(data.reason);
      setMode('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTime = (date: Date) => {
    setScheduledAt(date);
    setMode('confirm');
  };

  const handleConfirm = async () => {
    if (!scheduledAt) return;
    setLoading(true);
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artifactId,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      onScheduled();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center px-6 safe-top">
      {/* Tower ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 40%, rgba(30,144,255,0.06) 0%, transparent 65%)',
        }}
      />

      <AnimatePresence mode="wait">

        {/* ── SELECT MODE ── */}
        {mode === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <p className="font-display text-2xl tracking-[0.2em] text-reactor">
                SCHEDULER TOWER
              </p>
              <p className="font-classified text-[10px] tracking-[0.25em] text-slate-600 mt-1">
                SELECT DEPLOYMENT WINDOW
              </p>
            </div>

            {/* Time-dial device — clock face */}
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border border-reactor/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                />
                {/* Tick marks */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 flex items-start justify-center"
                    style={{ transform: `rotate(${i * 30}deg)` }}
                  >
                    <div className={`w-px mt-2 ${i % 3 === 0 ? 'h-3 bg-reactor/50' : 'h-1.5 bg-white/10'}`} />
                  </div>
                ))}
                {/* Center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-reactor/40" />
                </div>
              </div>
            </div>

            {/* Auto-schedule */}
            <motion.button
              onClick={handleAutoSchedule}
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-12 rounded-xl border border-reactor/30 bg-reactor/10 text-reactor font-heading text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 hover:bg-reactor/15 transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {loading ? 'CALCULATING...' : 'Auto-Schedule'}
            </motion.button>

            {/* Quick options */}
            <div className="space-y-2">
              <p className="font-classified text-[10px] tracking-[0.2em] text-slate-600 uppercase">
                Quick select
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleSelectTime(opt.getValue())}
                    className="py-2.5 px-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-slate-400 text-xs font-body hover:border-white/[0.15] hover:text-slate-200 hover:bg-white/[0.04] transition-all text-left"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── CONFIRM MODE ── */}
        {mode === 'confirm' && scheduledAt && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <p className="font-display text-2xl tracking-[0.2em] text-reactor">
                CONFIRM DEPLOYMENT
              </p>
            </div>

            {/* Calendar hologram */}
            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-reactor/20 bg-reactor/5">
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <p className="font-display text-4xl tracking-widest text-reactor text-center">
                  {format(scheduledAt, 'd')}
                </p>
                <p className="font-heading text-sm text-reactor/70 tracking-[0.2em] text-center uppercase">
                  {format(scheduledAt, 'MMMM yyyy')}
                </p>
              </motion.div>
              <div className="h-px w-full bg-reactor/10 my-1" />
              <p className="font-mono text-lg text-reactor/80">
                {format(scheduledAt, 'h:mm a')}
              </p>
              {autoReason && (
                <p className="font-classified text-[9px] tracking-[0.2em] text-slate-600 uppercase mt-1">
                  {autoReason.replace(/_/g, ' ')}
                </p>
              )}
            </div>

            {/* Confirm button */}
            <motion.button
              onClick={handleConfirm}
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-12 rounded-xl font-heading text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              style={{
                background: 'linear-gradient(135deg, #1e90ff 0%, #0066cc 100%)',
                color: '#050810',
              }}
            >
              <Check className="w-4 h-4" />
              {loading ? 'SCHEDULING...' : 'Confirm Schedule'}
            </motion.button>

            {/* Back */}
            <button
              onClick={() => setMode('select')}
              className="w-full flex items-center justify-center gap-1 text-xs font-classified tracking-[0.2em] text-slate-700 hover:text-slate-500 uppercase transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              Change time
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
