import { motion } from 'framer-motion';
import {
  Wand2,
  FilePlus,
  LayoutGrid,
  CalendarDays,
  PanelLeft,
} from 'lucide-react';
import { useProgression } from '../../contexts/ProgressionContext';

interface QuickActionsBarProps {
  onOpenGenerator: () => void;
  onToggleCalendar: () => void;
  onToggleTools: () => void;
}

export const QuickActionsBar = ({
  onOpenGenerator,
  onToggleCalendar,
  onToggleTools,
}: QuickActionsBarProps) => {
  const { progression } = useProgression();
  const generationsCount = progression?.generationsCount ?? 0;

  return (
    <div className="relative z-10 flex items-center justify-around px-2 h-16 border-t border-white/[0.06] bg-void-900/90 backdrop-blur-md safe-bottom">
      {/* Tools */}
      <ActionButton
        icon={<PanelLeft className="w-5 h-5" />}
        label="Tools"
        onClick={onToggleTools}
        className="md:hidden"
      />

      {/* New Post */}
      <ActionButton
        icon={<FilePlus className="w-5 h-5" />}
        label="New Post"
        onClick={() => {}}
      />

      {/* GENERATE — center hero button */}
      <div className="relative -mt-5">
        <motion.button
          onClick={onOpenGenerator}
          whileTap={{ scale: 0.94 }}
          className="relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-classified shadow-classified border border-classified/40 group"
          style={{
            background: 'linear-gradient(135deg, #c9a84c 0%, #9d7c2e 100%)',
          }}
        >
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-classified opacity-20 blur-lg scale-110 group-hover:opacity-30 transition-opacity" />

          <Wand2 className="w-6 h-6 text-void-900 relative z-10" strokeWidth={2} />

          {/* Generation count badge */}
          {generationsCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-reactor text-white flex items-center justify-center px-1">
              <span className="text-[9px] font-mono font-bold">{generationsCount}</span>
            </div>
          )}
        </motion.button>

        {/* Label below */}
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-heading tracking-widest text-classified whitespace-nowrap uppercase">
          Generate
        </span>
      </div>

      {/* Campaigns */}
      <ActionButton
        icon={<LayoutGrid className="w-5 h-5" />}
        label="Campaign"
        onClick={() => {}}
      />

      {/* Calendar */}
      <ActionButton
        icon={<CalendarDays className="w-5 h-5" />}
        label="Calendar"
        onClick={onToggleCalendar}
        className="md:hidden"
      />
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

const ActionButton = ({ icon, label, onClick, className = '' }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center gap-1 w-12 py-1
      text-slate-500 hover:text-slate-300 transition-colors active:scale-95 transform
      ${className}
    `}
  >
    {icon}
    <span className="text-[9px] font-heading tracking-wider uppercase">{label}</span>
  </button>
);
