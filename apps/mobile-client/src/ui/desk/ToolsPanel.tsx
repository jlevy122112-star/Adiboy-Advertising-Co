import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2,
  LayoutGrid,
  Users,
  BarChart3,
  Image,
  BookTemplate,
  Globe,
  Settings,
  X,
  Lock,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { useProgression } from '../../contexts/ProgressionContext';

interface ToolsPanelProps {
  onClose: () => void;
  onOpenGenerator: () => void;
}

interface ToolItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  bgColor: string;
  action?: () => void;
  route?: string;
  requiredLevel?: number;
  isNew?: boolean;
  isHot?: boolean;
}

export const ToolsPanel = ({ onClose, onOpenGenerator }: ToolsPanelProps) => {
  const { progression } = useProgression();
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const level = progression?.level ?? 1;

  const tools: ToolItem[] = [
    {
      id: 'generator',
      icon: <Wand2 className="w-5 h-5" />,
      label: 'Vault Generator',
      sublabel: 'AI content engine',
      color: 'text-classified',
      bgColor: 'bg-classified/10',
      action: onOpenGenerator,
      isHot: true,
    },
    {
      id: 'campaigns',
      icon: <LayoutGrid className="w-5 h-5" />,
      label: 'Campaigns',
      sublabel: 'Manage campaigns',
      color: 'text-reactor',
      bgColor: 'bg-reactor/10',
      route: '/campaigns',
    },
    {
      id: 'audience',
      icon: <Users className="w-5 h-5" />,
      label: 'Audiences',
      sublabel: 'Define targets',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      route: '/audiences',
    },
    {
      id: 'analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Observatory',
      sublabel: 'Analytics & insights',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      route: '/analytics',
      requiredLevel: 3,
    },
    {
      id: 'assets',
      icon: <Image className="w-5 h-5" />,
      label: 'Asset Vault',
      sublabel: 'Media library',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      route: '/assets',
    },
    {
      id: 'templates',
      icon: <BookTemplate className="w-5 h-5" />,
      label: 'Templates',
      sublabel: 'Content templates',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
      route: '/templates',
      requiredLevel: 2,
      isNew: true,
    },
    {
      id: 'integrations',
      icon: <Globe className="w-5 h-5" />,
      label: 'Integrations',
      sublabel: 'Social connections',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      route: '/integrations',
      requiredLevel: 4,
    },
  ];

  return (
    <aside className="flex flex-col w-72 md:w-64 h-full bg-desk-900/95 border-r border-white/[0.06] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="font-display text-base tracking-[0.15em] text-classified">
          ARSENAL
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {tools.map((tool, i) => {
          const isLocked = tool.requiredLevel ? level < tool.requiredLevel : false;

          return (
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => {
                if (isLocked) return;
                setActiveToolId(tool.id);
                tool.action?.();
              }}
              disabled={isLocked}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group
                ${activeToolId === tool.id
                  ? 'bg-white/[0.07] border border-white/[0.1]'
                  : 'hover:bg-white/[0.04] border border-transparent'
                }
                ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Icon */}
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                ${isLocked ? 'bg-white/[0.04] text-slate-600' : `${tool.bgColor} ${tool.color}`}
              `}>
                {isLocked ? <Lock className="w-4 h-4" /> : tool.icon}
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`
                    text-sm font-body font-medium truncate
                    ${isLocked ? 'text-slate-600' : 'text-slate-300 group-hover:text-slate-100'}
                  `}>
                    {tool.label}
                  </span>
                  {tool.isNew && !isLocked && (
                    <span className="px-1 py-px rounded text-[9px] font-mono bg-reactor/20 text-reactor border border-reactor/30">
                      NEW
                    </span>
                  )}
                  {tool.isHot && !isLocked && (
                    <Flame className="w-3 h-3 text-orange-400" />
                  )}
                </div>
                {tool.sublabel && (
                  <span className="text-2xs text-slate-600 truncate block">
                    {isLocked ? `Unlock at Level ${tool.requiredLevel}` : tool.sublabel}
                  </span>
                )}
              </div>

              {/* Arrow */}
              {!isLocked && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom: Settings */}
      <div className="border-t border-white/[0.06] p-2">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left group">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors">
            <Settings className="w-4 h-4" />
          </div>
          <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
};
