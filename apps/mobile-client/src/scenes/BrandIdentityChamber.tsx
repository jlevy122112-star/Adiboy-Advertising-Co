
import { useState } from 'react';
import { motion } from 'framer-motion';

interface BrandIdentityChamberProps {
  brandId: string;
  onComplete: () => void;
}

const TONE_OPTIONS = [
  'professional',
  'casual',
  'humorous',
  'inspirational',
  'authoritative',
  'playful',
] as const;

type Tone = typeof TONE_OPTIONS[number];

const DEFAULT_COLORS = ['#c9a84c', '#1e90ff', '#ef4444', '#22c55e', '#a855f7', '#f59e0b'];

export const BrandIdentityChamber: React.FC<BrandIdentityChamberProps> = ({
  brandId,
  onComplete,
}) => {
  const [logo, setLogo] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>('professional');
  const [saving, setSaving] = useState(false);

  const handleToggleColor = (color: string) => {
    setColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color],
    );
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logo, colors, tone }),
      });
      await fetch('/api/rewards/xp/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: 50, reason: 'brand_chamber_complete' }),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center px-6 safe-top">
      {/* Floating hologram ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <p className="font-display text-2xl tracking-[0.2em] text-classified">
            BRAND IDENTITY
          </p>
          <p className="font-classified text-xs tracking-[0.25em] text-slate-600 mt-1">
            CHAMBER — DEFINE YOUR PRESENCE
          </p>
        </div>

        {/* Logo upload */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Brand Logo
          </label>
          <label className="flex items-center justify-center w-full h-20 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] hover:border-classified/30 hover:bg-classified/5 transition-all cursor-pointer">
            {logo ? (
              <img src={logo} alt="Brand logo" className="max-h-16 max-w-full object-contain" />
            ) : (
              <span className="font-classified text-xs text-slate-600 tracking-widest uppercase">
                Upload logo
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </label>
        </div>

        {/* Color orbs */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Brand Colors
          </label>
          <div className="flex gap-3 flex-wrap">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleToggleColor(color)}
                className="relative w-9 h-9 rounded-full transition-all"
                style={{ backgroundColor: color }}
              >
                {colors.includes(color) && (
                  <motion.div
                    layoutId={`color-ring-${color}`}
                    className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-2 ring-offset-void-900"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tone dial */}
        <div className="space-y-2">
          <label className="font-classified text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            Brand Tone
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`
                  py-2 rounded-lg text-xs font-heading uppercase tracking-wider transition-all
                  ${tone === t
                    ? 'bg-classified/15 text-classified border border-classified/30'
                    : 'bg-white/[0.03] text-slate-600 border border-white/[0.06] hover:border-white/[0.12]'
                  }
                `}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl font-heading text-sm tracking-[0.15em] uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #c9a84c 0%, #9d7c2e 100%)',
            color: '#050810',
          }}
        >
          {saving ? 'LOCKING...' : 'Lock Brand Identity'}
        </button>
      </motion.div>
    </div>
  );
};
