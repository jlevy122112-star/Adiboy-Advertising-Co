import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkspaceHeader } from './WorkspaceHeader';
import { PlannerSurface } from './PlannerSurface';
import { CalendarDrawer } from './CalendarDrawer';
import { ToolsPanel } from './ToolsPanel';
import { QuickActionsBar } from './QuickActionsBar';
import { DeskBackground } from './DeskBackground';

interface DeskLayoutProps {
  generateMode: boolean;
  onOpenGenerator: () => void;
}

export type ActivePanel = 'planner' | 'calendar' | 'tools' | null;

export const DeskLayout = ({ generateMode, onOpenGenerator }: DeskLayoutProps) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const toggleCalendar = () => {
    setCalendarOpen(prev => !prev);
    setToolsOpen(false);
  };

  const toggleTools = () => {
    setToolsOpen(prev => !prev);
    setCalendarOpen(false);
  };

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-void-900 safe-top">
      {/* Atmospheric background */}
      <DeskBackground />

      {/* Header */}
      <WorkspaceHeader
        onToggleCalendar={toggleCalendar}
        onToggleTools={toggleTools}
        calendarOpen={calendarOpen}
        toolsOpen={toolsOpen}
      />

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Tools panel — slides in from left on mobile */}
        <AnimatePresence>
          {toolsOpen && (
            <motion.div
              key="tools"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="absolute inset-y-0 left-0 z-30 md:relative md:translate-x-0 md:block"
            >
              <ToolsPanel
                onClose={() => setToolsOpen(false)}
                onOpenGenerator={() => {
                  setToolsOpen(false);
                  onOpenGenerator();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tablet/Desktop: always-visible tools */}
        <div className="hidden md:block flex-shrink-0">
          <ToolsPanel
            onClose={() => {}}
            onOpenGenerator={onOpenGenerator}
          />
        </div>

        {/* Planner — main center surface */}
        <div className="flex-1 overflow-hidden">
          <PlannerSurface activePanel={activePanel} setActivePanel={setActivePanel} />
        </div>

        {/* Calendar drawer — slides in from right */}
        <AnimatePresence>
          {calendarOpen && (
            <motion.div
              key="calendar"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="absolute inset-y-0 right-0 z-30 md:relative md:translate-x-0"
            >
              <CalendarDrawer onClose={() => setCalendarOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tablet/Desktop: always-visible calendar */}
        <div className="hidden lg:block flex-shrink-0">
          <CalendarDrawer onClose={() => {}} />
        </div>
      </div>

      {/* Quick actions bar */}
      <QuickActionsBar
        onOpenGenerator={onOpenGenerator}
        onToggleCalendar={toggleCalendar}
        onToggleTools={toggleTools}
      />

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {(calendarOpen || toolsOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => {
              setCalendarOpen(false);
              setToolsOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
