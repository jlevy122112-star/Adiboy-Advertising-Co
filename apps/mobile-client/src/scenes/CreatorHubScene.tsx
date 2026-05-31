import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Flame, Trophy, Star, Lock } from 'lucide-react';

interface CreatorHubSceneProps {
  onClose: () => void;
}

interface CreatorProfile {
  userId: string;
  name: string;
  rank: string;
  level: number;
  prestigeRank: number;
  currentStreak: number;
  longestStreak: number;
  generationsCount: number;
  achievements: Achievement[];
  officeLevel: number;
  unlockedScenes: string[];
}

interface Achievement {
  key: string;
  title: string;
  description: string;
  unlockedAt: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const RARITY_COLOR: Record<Achievement['rarity'], string> = {
  common:    'text-slate-500  border-white/[0.08]    bg-white/[0.02]',
  rare:      'text-reactor    border-reactor/30       bg-reactor/5',
  epic:      'text-purple-400 border-purple-500/30    bg-purple-500/5',
  legendary: 'text-classified border-classified/40   bg-classified/5',
};

const RANK_LABELS: Record<number, string> = {
  0: 'Apprentice Marketer',
  1: 'Junior Strategist',
  2: 'Senior Strategist',
  3: 'Campaign Director',
  4: 'Brand Architect',
  5: 'Marketing Commander',
};

export const CreatorHubScene: React.FC<CreatorHubSceneProps> = ({ onClose }) => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/creator/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col safe-top">
      {/* Creator Hub ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(201,168,76,0.05) 0%, transparent 65%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <p className="font-display text-lg tracking-[0.2em] text-classified">
            CREATOR HUB
          </p>
          <p className="font-classified text-[10px] tracking-[0.2em] text-slate-600">
            YOUR MARKETER IDENTITY
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
            <div className="h-28 rounded-xl bg-white/[0.03] animate-pulse" />
            <div className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
            <div className="h-48 rounded-xl bg-white/[0.03] animate-pulse" />
          </div>
        ) : profile ? (
          <>
            {/* Rank + level card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="p-4 rounded-xl border border-classified/20 bg-classified/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-classified text-[9px] tracking-widest text-classified/60 uppercase">
                    Rank
                  </p>
                  <p className="font-heading text-base font-semibold text-slate-200 mt-0.5">
                    {RANK_LABELS[profile.prestigeRank] ?? profile.rank}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-classified/10 border border-classified/20">
                  <Trophy className="w-3.5 h-3.5 text-classified" />
                  <span className="font-mono text-sm font-medium text-classified">
                    LV.{profile.level}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Streak */}
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <div>
                    <p className="font-mono text-sm font-medium text-orange-400">
                      {profile.currentStreak}d
                    </p>
                    <p className="font-classified text-[8px] tracking-widest text-slate-600 uppercase">
                      streak
                    </p>
                  </div>
                </div>
                {/* Generations */}
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-classified/60" />
                  <div>
                    <p className="font-mono text-sm font-medium text-classified">
                      {profile.generationsCount}
                    </p>
                    <p className="font-classified text-[8px] tracking-widest text-slate-600 uppercase">
                      generated
                    </p>
                  </div>
                </div>
                {/* Best streak */}
                <div>
                  <p className="font-mono text-sm font-medium text-slate-400">
                    {profile.longestStreak}d
                  </p>
                  <p className="font-classified text-[8px] tracking-widest text-slate-600 uppercase">
                    best
                  </p>
                </div>
              </div>
            </motion.div>

            {/* VR room evolution */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                  Office Evolution
                </span>
                <span className="font-classified text-[9px] text-classified/60 tracking-wider">
                  LEVEL {profile.officeLevel}
                </span>
              </div>
              {/* Office level progress bar */}
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-classified"
                    initial={{ width: 0 }}
                    animate={{ width: `${((profile.officeLevel % 5) / 5) * 100}%` }}
                    transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <p className="font-classified text-[9px] text-slate-700 tracking-wider">
                  {profile.officeLevel < 20
                    ? `Next upgrade at level ${profile.officeLevel + 1}`
                    : 'PRESTIGE UNLOCKED'}
                </p>
              </div>

              {/* Unlocked scenes */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['vault', 'brand_chamber', 'audience_arena', 'content_forge', 'artifact_vault',
                  'scheduler_tower', 'observatory', 'creator_hub', 'multiverse_gate'].map((scene) => {
                  const unlocked = profile.unlockedScenes.includes(scene);
                  return (
                    <div
                      key={scene}
                      className={`
                        px-2 py-1 rounded-md text-[9px] font-classified tracking-wider uppercase flex items-center gap-1
                        ${unlocked
                          ? 'bg-classified/10 text-classified/70 border border-classified/20'
                          : 'bg-white/[0.02] text-slate-700 border border-white/[0.04]'
                        }
                      `}
                    >
                      {!unlocked && <Lock className="w-2 h-2" />}
                      {scene.replace(/_/g, ' ')}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Achievements */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2"
            >
              <span className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                Achievements ({profile.achievements.filter(a => a.unlockedAt).length}/{profile.achievements.length})
              </span>
              <div className="space-y-2">
                {profile.achievements.map((achievement, i) => {
                  const locked = !achievement.unlockedAt;
                  return (
                    <motion.div
                      key={achievement.key}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.04 }}
                      className={`
                        flex items-center gap-3 p-3 rounded-xl border transition-all
                        ${locked ? 'opacity-40' : ''}
                        ${RARITY_COLOR[achievement.rarity]}
                      `}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        {locked
                          ? <Lock className="w-3.5 h-3.5 text-slate-600" />
                          : <Trophy className="w-3.5 h-3.5" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-heading text-slate-300 truncate">
                          {achievement.title}
                        </p>
                        <p className="text-[10px] font-body text-slate-600 truncate mt-0.5">
                          {achievement.description}
                        </p>
                      </div>
                      <span className="font-classified text-[8px] tracking-widest uppercase flex-shrink-0">
                        {achievement.rarity}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
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
