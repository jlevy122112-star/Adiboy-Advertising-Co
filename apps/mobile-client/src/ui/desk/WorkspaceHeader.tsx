import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  CalendarDays,
  PanelLeft,
  Zap,
  Shield,
  Trophy,
} from 'lucide-react';
import { useBrand } from '../../contexts/BrandContext';
import { useProgression } from '../../contexts/ProgressionContext';
import { useAuth } from '../../contexts/AuthContext';

interface WorkspaceHeaderProps {
  onToggleCalendar: () => void;
  onToggleTools: () => void;
  calendarOpen: boolean;
  toolsOpen: boolean;
}

export const WorkspaceHeader = ({
  onToggleCalendar,
  onToggleTools,
  calendarOpen,
  toolsOpen,
}: WorkspaceHeaderProps) => {
  const { activeBrand, brands, setActiveBrand } = useBrand();
  const { progression } = useProgression();
  const { user } = useAuth();
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);

  const level = progression?.level ?? 1;
  const xp = progression?.totalXp ?? 0;

  // XP needed for next level (simple formula)
  const xpForNextLevel = level * 1000;
  const xpProgress = Math.min((xp % xpForNextLevel) / xpForNextLevel, 1);

  return (
    <header className="relative z-10 flex items-center justify-between px-3 h-12 border-b border-white/[0.06] bg-void-900/80 backdrop-blur-md safe-top">
      {/* Left: Tools toggle + brand switcher */}
      <div className="flex items-center gap-2">
        {/* Tools panel toggle */}
        <button
          onClick={onToggleTools}
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 md:hidden
            ${toolsOpen
              ? 'bg-classified/20 text-classified border border-classified/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Brand switcher */}
        <div className="relative">
          <button
            onClick={() => setBrandMenuOpen(prev => !prev)}
            className="flex items-center gap-2 h-8 px-2 rounded-lg hover:bg-white/5 transition-colors group"
          >
            {/* Brand color dot */}
            <div
              className="w-2 h-2 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: activeBrand?.colors?.primary ?? '#c9a84c' }}
            />
            <span className="font-heading text-sm font-medium text-slate-200 max-w-[120px] truncate">
              {activeBrand?.name ?? "Expert Marketer's Desk"}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-500 transition-transform ${brandMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Brand dropdown */}
          <AnimatePresence>
            {brandMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full left-0 mt-1 w-56 panel-glass rounded-xl border border-white/[0.08] shadow-desk py-1 z-50"
              >
                <div className="px-3 py-1.5">
                  <span className="text-2xs font-heading tracking-widest text-slate-500 uppercase">
                    Workspaces
                  </span>
                </div>
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => {
                      setActiveBrand(brand);
                      setBrandMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <div
                      className="w-2 h-2 rounded-full ring-1 ring-white/20 flex-shrink-0"
                      style={{ backgroundColor: brand.colors?.primary ?? '#c9a84c' }}
                    />
                    <span className="text-sm text-slate-300 truncate">{brand.name}</span>
                    {activeBrand?.id === brand.id && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-classified" />
                    )}
                  </button>
                ))}
                <div className="h-px bg-white/[0.06] my-1" />
                <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                  <div className="w-2 h-2 rounded-full ring-1 ring-dashed ring-slate-600 flex-shrink-0" />
                  <span className="text-sm text-slate-500">+ New Brand</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center: App identity (hidden on small screens) */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2">
        <Shield className="w-3 h-3 text-classified/60" />
        <span className="font-display text-xs tracking-[0.25em] text-classified/60 uppercase">
          Office Edition
        </span>
      </div>

      {/* Right: Level indicator, notifications, profile */}
      <div className="flex items-center gap-1.5">
        {/* Level badge */}
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <Trophy className="w-3 h-3 text-classified" />
          <span className="font-mono text-xs text-classified font-medium">
            LV.{level}
          </span>
          {/* Mini XP bar */}
          <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-classified rounded-full"
              style={{ width: `${xpProgress * 100}%` }}
              animate={{ width: `${xpProgress * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Calendar toggle */}
        <button
          onClick={onToggleCalendar}
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
            ${calendarOpen
              ? 'bg-classified/20 text-classified border border-classified/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          <CalendarDays className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
          <Bell className="w-4 h-4" />
          {/* Notification dot */}
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-classified" />
        </button>

        {/* User avatar */}
        <button className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-classified/40 transition-all">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-classified/30 to-reactor/30 flex items-center justify-center">
              <span className="font-heading text-xs font-semibold text-classified">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
