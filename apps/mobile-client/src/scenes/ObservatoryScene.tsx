
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Users, Eye, Zap } from 'lucide-react';

interface ObservatorySceneProps {
  onClose: () => void;
}

interface AnalyticsOverview {
  totalPosts: number;
  totalReach: number;
  avgEngagementRate: number;
  topPlatform: string;
  growthPercent: number;
  weeklyReach: number[];
  platformBreakdown: Record<string, number>;
}

const METRIC_ICONS = [TrendingUp, Users, Eye, Zap];

export const ObservatoryScene: React.FC<ObservatorySceneProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/overview', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setMetrics(data);
        setLoading(false);
      });
  }, []);

  const metricCards = metrics ? [
    { label: 'Total Posts',    value: metrics.totalPosts.toLocaleString(),               icon: TrendingUp },
    { label: 'Total Reach',    value: metrics.totalReach.toLocaleString(),                icon: Users      },
    { label: 'Engagement',     value: `${metrics.avgEngagementRate.toFixed(1)}%`,         icon: Eye        },
    { label: 'Growth',         value: `+${metrics.growthPercent.toFixed(1)}%`,            icon: Zap        },
  ] : [];

  const weeklyMax = metrics?.weeklyReach
    ? Math.max(...metrics.weeklyReach, 1)
    : 1;

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col safe-top">
      {/* Observatory ambient glow — holographic teal */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(29,158,117,0.06) 0%, transparent 65%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <p className="font-display text-lg tracking-[0.2em] text-emerald-400">
            OBSERVATORY
          </p>
          <p className="font-classified text-[10px] tracking-[0.2em] text-slate-600">
            PERFORMANCE INTELLIGENCE
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
            <div className="h-40 rounded-xl bg-white/[0.03] animate-pulse" />
          </div>
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              {metricCards.map(({ label, value, icon: Icon }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-classified text-[9px] tracking-widest text-slate-600 uppercase">
                      {label}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-emerald-400/50" />
                  </div>
                  <motion.p
                    className="font-display text-2xl tracking-wider text-emerald-400"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                  >
                    {value}
                  </motion.p>
                </motion.div>
              ))}
            </div>

            {/* Weekly reach — holographic bar chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                  Weekly Reach
                </span>
                <span className="font-classified text-[9px] text-emerald-400/60 tracking-wider">
                  LAST 7 DAYS
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {(metrics?.weeklyReach ?? []).map((val, i) => {
                  const heightPct = (val / weeklyMax) * 100;
                  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${heightPct}%`,
                          minHeight: 2,
                          background: 'linear-gradient(to top, rgba(29,158,117,0.6), rgba(29,158,117,0.2))',
                          boxShadow: '0 0 8px rgba(29,158,117,0.2)',
                        }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.4 + i * 0.06, duration: 0.4, ease: 'easeOut' }}
                        style={{ transformOrigin: 'bottom', height: `${heightPct}%`, minHeight: 2, background: 'linear-gradient(to top, rgba(29,158,117,0.6), rgba(29,158,117,0.2))' }}
                      />
                      <span className="font-classified text-[8px] text-slate-700">{days[i]}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Platform breakdown */}
            {metrics?.platformBreakdown && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3"
              >
                <span className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                  Platform Breakdown
                </span>
                <div className="space-y-2">
                  {Object.entries(metrics.platformBreakdown).map(([platform, pct], i) => (
                    <div key={platform} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-heading text-xs text-slate-400 capitalize">{platform}</span>
                        <span className="font-mono text-xs text-slate-500">{pct}%</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-emerald-500/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Telescope — future performance stub */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-xl border border-dashed border-white/[0.06] flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Eye className="w-4 h-4 text-emerald-400/60" />
              </div>
              <div>
                <p className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                  Future Performance Telescope
                </p>
                <p className="font-body text-xs text-slate-700 mt-0.5">
                  Unlocks at Level 10
                </p>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Return to Desk */}
      <div className="relative z-10 px-4 pb-4 safe-bottom border-t border-white/[0.06] pt-3">
        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl border border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/[0.12] text-xs font-heading tracking-wider uppercase transition-all"
        >
          Return to Desk
        </button>
      </div>
    </div>
  );
};
