
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudienceArenaProps {
  brandId: string;
  onComplete: () => void;
}

interface Trait {
  id: string;
  label: string;
  category: 'demographic' | 'psychographic' | 'behavioral';
}

const AVAILABLE_TRAITS: Trait[] = [
  { id: 'age_18_24',     label: '18–24',          category: 'demographic'   },
  { id: 'age_25_34',     label: '25–34',          category: 'demographic'   },
  { id: 'age_35_44',     label: '35–44',          category: 'demographic'   },
  { id: 'age_45_plus',   label: '45+',            category: 'demographic'   },
  { id: 'entrepreneur',  label: 'Entrepreneur',   category: 'psychographic' },
  { id: 'creative',      label: 'Creative',       category: 'psychographic' },
  { id: 'tech_savvy',    label: 'Tech-savvy',     category: 'psychographic' },
  { id: 'budget_conscious', label: 'Budget-conscious', category: 'psychographic' },
  { id: 'mobile_first',  label: 'Mobile-first',   category: 'behavioral'    },
  { id: 'impulse_buyer', label: 'Impulse buyer',  category: 'behavioral'    },
  { id: 'researcher',    label: 'Researcher',     category: 'behavioral'    },
  { id: 'loyalist',      label: 'Brand loyalist', category: 'behavioral'    },
];

const CATEGORY_COLOR: Record<Trait['category'], string> = {
  demographic:   'bg-reactor/10 text-reactor border-reactor/20',
  psychographic: 'bg-classified/10 text-classified border-classified/20',
  behavioral:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export const AudienceArena: React.FC<AudienceArenaProps> = ({ brandId, onComplete }) => {
  const [traits, setTraits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleCollectTrait = (traitId: string) => {
    setTraits(prev => prev.includes(traitId) ? prev : [...prev, traitId]);
  };

  const handleRemoveTrait = (traitId: string) => {
    setTraits(prev => prev.filter(id => id !== traitId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/brands/${brandId}/audiences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ traits }),
      });
      await fetch('/api/rewards/xp/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: 50, reason: 'audience_arena_complete' }),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center px-6 safe-top">
      {/* Arena ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(30,144,255,0.05) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm space-y-5"
      >
        {/* Header */}
        <div className="text-center">
          <p className="font-display text-2xl tracking-[0.2em] text-reactor">
            AUDIENCE ARENA
          </p>
          <p className="font-classified text-xs tracking-[0.25em] text-slate-600 mt-1">
            COLLECT AUDIENCE INTEL
          </p>
        </div>

        {/* Collected traits */}
        <div className="min-h-[48px] flex flex-wrap gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <AnimatePresence>
            {traits.length === 0 && (
              <span className="text-xs text-slate-700 font-classified tracking-widest self-center">
                TAP TRAITS TO COLLECT
              </span>
            )}
            {traits.map((id) => {
              const trait = AVAILABLE_TRAITS.find(t => t.id === id);
              if (!trait) return null;
              return (
                <motion.button
                  key={id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={() => handleRemoveTrait(id)}
                  className={`
                    px-2.5 py-1 rounded-lg text-xs font-heading tracking-wider border transition-all
                    ${CATEGORY_COLOR[trait.category]}
                  `}
                >
                  {trait.label} ×
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Available traits — floating creatures */}
        <div className="space-y-3">
          {(['demographic', 'psychographic', 'behavioral'] as Trait['category'][]).map((cat) => (
            <div key={cat} className="space-y-1.5">
              <span className="font-classified text-[9px] tracking-[0.2em] text-slate-600 uppercase">
                {cat}
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TRAITS.filter(t => t.category === cat).map((trait, i) => {
                  const collected = traits.includes(trait.id);
                  return (
                    <motion.button
                      key={trait.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleCollectTrait(trait.id)}
                      disabled={collected}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-heading tracking-wider border transition-all
                        ${collected
                          ? 'opacity-30 cursor-not-allowed ' + CATEGORY_COLOR[cat]
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:border-white/[0.15] hover:text-slate-300'
                        }
                      `}
                    >
                      {trait.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Lock button */}
        <button
          onClick={handleSave}
          disabled={traits.length === 0 || saving}
          className="w-full h-12 rounded-xl font-heading text-sm tracking-[0.15em] uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #1e90ff 0%, #0066cc 100%)',
            color: '#050810',
          }}
        >
          {saving ? 'LOCKING...' : 'Lock Audience Intel'}
        </button>
      </motion.div>
    </div>
  );
};
