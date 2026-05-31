
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Hash, Image, Layers, Sparkles } from 'lucide-react';
import type { Artifact } from '../../../../backend/src/modules/artifacts/artifacts.controller';

interface ArtifactVaultSceneProps {
  onClose: () => void;
}

type ArtifactFilter = 'all' | Artifact['type'];
type ArtifactRarity = Artifact['rarity'];

const RARITY_STYLES: Record<ArtifactRarity, { border: string; glow: string; label: string; text: string }> = {
  common:    { border: 'border-white/[0.08]',    glow: '',                                         label: 'COMMON',    text: 'text-slate-500'   },
  rare:      { border: 'border-reactor/30',       glow: 'shadow-reactor',                           label: 'RARE',      text: 'text-reactor'     },
  epic:      { border: 'border-purple-500/40',    glow: '0 0 20px rgba(168,85,247,0.2)',            label: 'EPIC',      text: 'text-purple-400'  },
  legendary: { border: 'border-classified/50',    glow: '0 0 30px rgba(201,168,76,0.25)',           label: 'LEGENDARY', text: 'text-classified'  },
};

const TYPE_ICONS: Record<Artifact['type'], React.ReactNode> = {
  copy:        <FileText className="w-4 h-4" />,
  caption:     <FileText className="w-4 h-4" />,
  hashtag_set: <Hash className="w-4 h-4" />,
  variation:   <Layers className="w-4 h-4" />,
  image:       <Image className="w-4 h-4" />,
};

const FILTER_OPTIONS: { value: ArtifactFilter; label: string }[] = [
  { value: 'all',        label: 'ALL'      },
  { value: 'copy',       label: 'COPY'     },
  { value: 'caption',    label: 'CAPTIONS' },
  { value: 'hashtag_set',label: 'HASHTAGS' },
  { value: 'variation',  label: 'VARIANTS' },
  { value: 'image',      label: 'IMAGES'   },
];

export const ArtifactVaultScene: React.FC<ArtifactVaultSceneProps> = ({ onClose }) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ArtifactFilter>('all');
  const [selected, setSelected] = useState<Artifact | null>(null);

  useEffect(() => {
    fetch('/api/artifacts', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setArtifacts(data.artifacts);
        setLoading(false);
      });
  }, []);

  const filtered = filter === 'all'
    ? artifacts
    : artifacts.filter(a => a.type === filter);

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col safe-top">
      {/* Vault ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 20%, rgba(201,168,76,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <p className="font-display text-lg tracking-[0.2em] text-classified">
            ARTIFACT VAULT
          </p>
          <p className="font-classified text-[10px] tracking-[0.2em] text-slate-600">
            {artifacts.length} ARTIFACTS CLASSIFIED
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="relative z-10 flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/[0.06]">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`
              flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-heading tracking-wider transition-all
              ${filter === opt.value
                ? 'bg-classified/15 text-classified border border-classified/30'
                : 'text-slate-600 border border-white/[0.06] hover:border-white/[0.12] hover:text-slate-400'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Artifact grid — floating cards */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-classified/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-classified/40" />
            </div>
            <p className="text-sm text-slate-600 font-body">No artifacts found</p>
            <p className="text-xs text-slate-700 mt-1">Generate content to fill the vault</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((artifact, i) => {
              const rarity = RARITY_STYLES[artifact.rarity];
              return (
                <motion.button
                  key={artifact.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelected(artifact)}
                  className={`
                    relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-all
                    bg-white/[0.02] hover:bg-white/[0.04] ${rarity.border}
                  `}
                  style={artifact.rarity !== 'common' ? { boxShadow: rarity.glow } : undefined}
                >
                  {/* Rarity badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      {TYPE_ICONS[artifact.type]}
                      <span className="font-classified text-[9px] tracking-widest text-slate-600 uppercase">
                        {artifact.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className={`font-classified text-[9px] tracking-widest uppercase ${rarity.text}`}>
                      {rarity.label}
                    </span>
                  </div>

                  {/* Content preview */}
                  <p className="font-body text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {Array.isArray(artifact.content)
                      ? artifact.content[0]
                      : artifact.content}
                  </p>

                  {/* Legendary shimmer */}
                  {artifact.rarity === 'legendary' && (
                    <motion.div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      animate={{ opacity: [0, 0.06, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      style={{ background: 'linear-gradient(135deg, #c9a84c, transparent)' }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Artifact detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="absolute inset-x-0 bottom-0 z-20 panel-glass border-t border-white/[0.08] rounded-t-2xl p-6 safe-bottom"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className={`font-classified text-xs tracking-widest uppercase ${RARITY_STYLES[selected.rarity].text}`}>
                  {RARITY_STYLES[selected.rarity].label}
                </span>
                <p className="font-heading text-sm text-slate-300 mt-0.5 capitalize">
                  {selected.type.replace('_', ' ')}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm text-slate-300 font-body leading-relaxed max-h-40 overflow-y-auto">
              {Array.isArray(selected.content)
                ? selected.content.map((item, i) => (
                    <p key={i} className="mb-1">{item}</p>
                  ))
                : selected.content}
            </div>

            <div className="flex gap-2 mt-4">
              <button className="flex-1 h-10 rounded-xl bg-classified/15 text-classified border border-classified/30 text-xs font-heading tracking-wider uppercase hover:bg-classified/20 transition-colors">
                Use Artifact
              </button>
              <button className="flex-1 h-10 rounded-xl bg-white/[0.03] text-slate-400 border border-white/[0.06] text-xs font-heading tracking-wider uppercase hover:bg-white/[0.06] transition-colors">
                Schedule
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-black/50"
            onClick={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* Return to Desk */}
      {!selected && (
        <div className="relative z-10 px-4 pb-4 safe-bottom">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/[0.12] text-xs font-heading tracking-wider uppercase transition-all"
          >
            Return to Desk
          </button>
        </div>
      )}
    </div>
  );
};
