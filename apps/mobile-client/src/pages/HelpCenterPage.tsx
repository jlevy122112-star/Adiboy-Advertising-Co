import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Search, ChevronRight,
  Wand2, LayoutDashboard, Shield, Users,
  CalendarDays, Archive, Globe, Trophy,
  BarChart3, Star, CreditCard, HelpCircle,
} from 'lucide-react';

interface HelpArticle {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  category: string;
  keywords: string[];
}

const ARTICLES: HelpArticle[] = [
  {
    id: '00',
    icon: <Star className="w-4 h-4" />,
    title: 'Getting Started',
    description: 'Account setup, creating your first brand, and running your first generation.',
    category: 'Basics',
    keywords: ['start', 'setup', 'account', 'first', 'onboard', 'begin', 'new'],
  },
  {
    id: '01',
    icon: <LayoutDashboard className="w-4 h-4" />,
    title: 'The Desk Workspace',
    description: 'How the five Desk zones work — header, tools, planner, calendar, and quick actions.',
    category: 'Basics',
    keywords: ['desk', 'workspace', 'planner', 'layout', 'header', 'zones', 'navigation'],
  },
  {
    id: '02',
    icon: <Wand2 className="w-4 h-4" />,
    title: 'Vault Generator',
    description: 'The cinematic generation flow — Vault Door, Reactor Control, and Presentation Chamber.',
    category: 'Core Features',
    keywords: ['generate', 'vault', 'reactor', 'chamber', 'cinematic', 'content', 'ai', 'artifacts'],
  },
  {
    id: '03',
    icon: <Shield className="w-4 h-4" />,
    title: 'Brand Identity Chamber',
    description: 'Set up your brand logo, colours, and tone to get better AI-generated content.',
    category: 'Core Features',
    keywords: ['brand', 'identity', 'logo', 'colours', 'tone', 'chamber'],
  },
  {
    id: '04',
    icon: <Users className="w-4 h-4" />,
    title: 'Audience Arena',
    description: 'Define your target audience with demographic, psychographic, and behavioural traits.',
    category: 'Core Features',
    keywords: ['audience', 'traits', 'arena', 'targeting', 'demographic', 'psychographic'],
  },
  {
    id: '05',
    icon: <CalendarDays className="w-4 h-4" />,
    title: 'Calendar & Scheduling',
    description: 'The Calendar Drawer and Scheduler Tower — auto-schedule or set your own times.',
    category: 'Core Features',
    keywords: ['calendar', 'schedule', 'post', 'time', 'publish', 'tower', 'auto'],
  },
  {
    id: '06',
    icon: <Archive className="w-4 h-4" />,
    title: 'Artifact Vault',
    description: 'Your permanent library of AI-generated content — rarities, filters, and usage.',
    category: 'Core Features',
    keywords: ['artifact', 'vault', 'library', 'rarity', 'legendary', 'copy', 'captions', 'hashtags'],
  },
  {
    id: '07',
    icon: <Globe className="w-4 h-4" />,
    title: 'Social Integrations',
    description: 'Connect Instagram, Facebook, TikTok, LinkedIn, and X to publish directly.',
    category: 'Integrations',
    keywords: ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'connect', 'publish', 'integration'],
  },
  {
    id: '08',
    icon: <Trophy className="w-4 h-4" />,
    title: 'Progression & Rewards',
    description: 'XP, levels, streaks, lootboxes, office evolution, and prestige.',
    category: 'Progression',
    keywords: ['xp', 'level', 'streak', 'lootbox', 'reward', 'office', 'prestige', 'achievement'],
  },
  {
    id: '09',
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Observatory Analytics',
    description: 'Performance metrics, weekly reach charts, and platform breakdown.',
    category: 'Analytics',
    keywords: ['analytics', 'observatory', 'metrics', 'reach', 'engagement', 'performance', 'chart'],
  },
  {
    id: '10',
    icon: <Star className="w-4 h-4" />,
    title: 'Creator Hub',
    description: 'Your rank, achievements, office evolution progress, and prestige profile.',
    category: 'Progression',
    keywords: ['creator', 'hub', 'rank', 'achievement', 'profile', 'prestige', 'evolution'],
  },
  {
    id: '11',
    icon: <CreditCard className="w-4 h-4" />,
    title: 'Billing & Plans',
    description: 'Free, Pro, and Enterprise plans — upgrading, cancelling, and refunds.',
    category: 'Account',
    keywords: ['billing', 'plan', 'pro', 'enterprise', 'upgrade', 'cancel', 'refund', 'price'],
  },
  {
    id: '12',
    icon: <HelpCircle className="w-4 h-4" />,
    title: 'Troubleshooting & FAQ',
    description: 'Common issues, error messages, and how to contact support.',
    category: 'Support',
    keywords: ['help', 'problem', 'error', 'bug', 'crash', 'troubleshoot', 'faq', 'support', 'contact'],
  },
];

const CATEGORY_ORDER = ['Basics', 'Core Features', 'Integrations', 'Progression', 'Analytics', 'Account', 'Support'];

const CATEGORY_COLORS: Record<string, string> = {
  Basics:        'text-classified border-classified/20 bg-classified/5',
  'Core Features': 'text-reactor border-reactor/20 bg-reactor/5',
  Integrations:  'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  Progression:   'text-purple-400 border-purple-500/20 bg-purple-500/5',
  Analytics:     'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
  Account:       'text-amber-400 border-amber-500/20 bg-amber-500/5',
  Support:       'text-slate-400 border-slate-500/20 bg-slate-500/5',
};

export const HelpCenterPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = query.trim().length === 0
    ? ARTICLES
    : ARTICLES.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()) ||
        a.keywords.some(k => k.includes(query.toLowerCase())),
      );

  const grouped = CATEGORY_ORDER.reduce<Record<string, HelpArticle[]>>((acc, cat) => {
    const articles = filtered.filter(a => a.category === cat);
    if (articles.length > 0) acc[cat] = articles;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-void-900 safe-top">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-void-900/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="font-display text-base tracking-[0.15em] text-classified">HELP CENTER</p>
            <p className="font-classified text-[9px] tracking-[0.2em] text-slate-600">
              {ARTICLES.length} ARTICLES
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative px-4 pb-3">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help articles..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-desk-800 border border-white/[0.06] text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-classified/30 transition-colors font-body"
          />
        </div>
      </div>

      {/* Article list */}
      <div className="px-4 py-4 space-y-6 safe-bottom">
        <AnimatePresence>
          {Object.entries(grouped).map(([category, articles]) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <span className={`
                inline-flex items-center px-2 py-0.5 rounded text-[9px] font-classified tracking-widest uppercase border
                ${CATEGORY_COLORS[category] ?? 'text-slate-500 border-slate-500/20 bg-slate-500/5'}
              `}>
                {category}
              </span>

              <div className="space-y-1.5">
                {articles.map((article, i) => (
                  <motion.button
                    key={article.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/help/${article.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors">
                      {article.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-heading text-slate-300 group-hover:text-slate-100 transition-colors">
                        {article.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-1 font-body">
                        {article.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-600">No articles found for "{query}"</p>
            <p className="text-xs text-slate-700 mt-1">Try a different search term or contact support</p>
            <button
              onClick={() => {}}
              className="mt-4 text-xs text-classified font-classified tracking-widest uppercase hover:text-classified-light transition-colors"
            >
              Contact Support
            </button>
          </div>
        )}

        {/* Contact support footer */}
        <div className="p-4 rounded-xl border border-dashed border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-sm font-heading text-slate-400">Can't find what you need?</p>
            <p className="text-xs text-slate-600 mt-0.5">Our support team replies within 2 business days</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-classified/10 text-classified border border-classified/20 text-xs font-heading tracking-wider uppercase hover:bg-classified/20 transition-colors">
            Contact
          </button>
        </div>
      </div>
    </div>
  );
};
