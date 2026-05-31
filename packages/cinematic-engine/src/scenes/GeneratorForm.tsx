
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, X } from 'lucide-react';
import { useCinematicEngine } from '../useCinematicEngine';
import type { GenerationRequest } from '../types';

interface GeneratorFormProps {
  brandId: string;
  onClose: () => void;
}

type ContentType = GenerationRequest['contentType'];

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x'] as const;
const CONTENT_TYPES: ContentType[] = ['post', 'ad', 'script'];

export const GeneratorForm: React.FC<GeneratorFormProps> = ({ brandId, onClose }) => {
  const { startSequence, state } = useCinematicEngine();
  const [platforms, setPlatforms] = useState<string[]>(['instagram']);
  const [goal, setGoal] = useState('');
  const [contentType, setContentType] = useState<ContentType>('post');

  const isActive = state !== 'idle';

  const handleTogglePlatform = (p: string) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p],
    );
  };

  const handleFire = () => {
    if (!goal.trim() || platforms.length === 0) return;
    const req: GenerationRequest = {
      brandId,
      platforms,
      goal: goal.trim(),
      contentType,
    };
    startSequence(req);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Form panel */}
      <div className="relative z-10 w-full max-w-md panel-glass rounded-2xl border border-white/[0.08] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg tracking-[0.2em] text-classified">
              VAULT GENERATOR
            </p>
            <p className="font-body text-xs text-slate-500 mt-0.5">
              Configure your generation request
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platforms */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Platforms
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => handleTogglePlatform(p)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-heading font-medium uppercase tracking-wider transition-all
                  ${platforms.includes(p)
                    ? 'bg-classified/15 text-classified border border-classified/30'
                    : 'bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:border-white/[0.12]'
                  }
                `}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Content type */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Content type
          </label>
          <div className="flex gap-2">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setContentType(t)}
                className={`
                  flex-1 py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-all
                  ${contentType === t
                    ? 'bg-reactor/15 text-reactor border border-reactor/30'
                    : 'bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:border-white/[0.12]'
                  }
                `}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Goal / Brief
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What do you want to achieve with this content?"
            rows={3}
            className="w-full bg-desk-800 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-700 resize-none focus:outline-none focus:border-classified/30 transition-colors font-body"
          />
        </div>

        {/* Fire button */}
        <motion.button
          onClick={handleFire}
          disabled={!goal.trim() || platforms.length === 0 || isActive}
          whileTap={{ scale: 0.97 }}
          className="w-full h-12 rounded-xl font-heading text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #c9a84c 0%, #9d7c2e 100%)',
            color: '#050810',
          }}
        >
          <Wand2 className="w-4 h-4" strokeWidth={2} />
          Fire the Reactor
        </motion.button>
      </div>
    </motion.div>
  );
};
