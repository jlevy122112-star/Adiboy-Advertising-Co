import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Plus,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import type { PlannerTask, SocialPlatform } from '../../types';
import { useBrand } from '../../contexts/BrandContext';
import { useProgression } from '../../contexts/ProgressionContext';
import type { ActivePanel } from './DeskLayout';

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  tiktok: '#69c9d0',
  linkedin: '#0a66c2',
  x: '#94a3b8',
};

interface PlannerSurfaceProps {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}

const PRIORITY_CONFIG = {
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'HIGH' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'MED' },
  low: { color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: 'LOW' },
};

export const PlannerSurface = ({ activePanel, setActivePanel }: PlannerSurfaceProps) => {
  const { activeBrand } = useBrand();
  const { progression } = useProgression();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const loadTasks = useCallback(async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/planner/today?brandId=${activeBrand.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrand]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleStatus = async (taskId: string, currentStatus: PlannerTask['status']) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await fetch(`/api/planner/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Rollback on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t));
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !activeBrand) return;
    const tempId = `temp-${Date.now()}`;
    const newTask: PlannerTask = {
      id: tempId,
      brandId: activeBrand.id,
      campaignId: null,
      title: newTaskTitle.trim(),
      description: null,
      dueDate: null,
      status: 'todo',
      priority: 'medium',
      platform: null,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setAddingTask(false);

    try {
      const res = await fetch('/api/planner/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTask.title, brandId: activeBrand.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => prev.map(t => t.id === tempId ? data.task : t));
      }
    } catch {
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="relative flex flex-col h-full overflow-hidden z-10">
      {/* Desk surface header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="font-display text-xl tracking-wider text-slate-100">
            TODAY'S MISSION
          </h1>
          <p className="text-xs text-slate-500 font-body mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Streak & completion */}
        <div className="flex items-center gap-3">
          {progression?.currentStreak && progression.currentStreak > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-mono text-xs text-orange-400 font-medium">
                {progression.currentStreak}d
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-classified/10 border border-classified/20">
            <TrendingUp className="w-3.5 h-3.5 text-classified" />
            <span className="font-mono text-xs text-classified font-medium">
              {completionRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-3">
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-classified to-classified-light"
            animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-slate-600">{doneTasks.length} done</span>
          <span className="text-2xs text-slate-600">{tasks.length} total</span>
        </div>
      </div>

      {/* Scrollable task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {/* Add task input */}
        <AnimatePresence>
          {addingTask && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-classified/5 border border-classified/20"
            >
              <Sparkles className="w-4 h-4 text-classified flex-shrink-0" />
              <input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTask();
                  if (e.key === 'Escape') setAddingTask(false);
                }}
                placeholder="New task..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                className="text-xs text-classified font-medium hover:text-classified-light transition-colors"
              >
                Add
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-classified/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-classified/60" />
            </div>
            <p className="text-sm text-slate-500">No tasks for today</p>
            <p className="text-xs text-slate-600 mt-1">Add a task or generate content to get started</p>
          </motion.div>
        ) : (
          <>
            {/* In progress */}
            {inProgressTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-2xs font-heading tracking-widest text-reactor/60 uppercase px-1">
                  In Progress
                </span>
                {inProgressTasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onToggle={handleToggleStatus}
                  />
                ))}
              </div>
            )}

            {/* Todo */}
            {todoTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-2xs font-heading tracking-widest text-slate-600 uppercase px-1">
                  To Do
                </span>
                {todoTasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onToggle={handleToggleStatus}
                  />
                ))}
              </div>
            )}

            {/* Done */}
            {doneTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-2xs font-heading tracking-widest text-slate-600 uppercase px-1">
                  Completed
                </span>
                {doneTasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onToggle={handleToggleStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add task button */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setAddingTask(true)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-white/[0.08] text-slate-600 hover:text-slate-400 hover:border-white/[0.15] hover:bg-white/[0.02] transition-all duration-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: PlannerTask;
  index: number;
  onToggle: (id: string, status: PlannerTask['status']) => void;
}

const TaskCard = ({ task, index, onToggle }: TaskCardProps) => {
  const priority = PRIORITY_CONFIG[task.priority];
  const isDone = task.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`
        group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
        ${isDone
          ? 'bg-white/[0.02] border-white/[0.04] opacity-50'
          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]'
        }
      `}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, task.status)}
        className="flex-shrink-0 transition-transform active:scale-90"
      >
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-classified" />
        ) : task.status === 'in_progress' ? (
          <Clock className="w-5 h-5 text-reactor" />
        ) : (
          <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-body truncate ${isDone ? 'line-through text-slate-600' : 'text-slate-200'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.dueDate && (
            <span className="text-2xs text-slate-600 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.platform && (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[task.platform] }}
            />
          )}
        </div>
      </div>

      {/* Priority badge */}
      <div className={`
        flex-shrink-0 px-1.5 py-0.5 rounded text-2xs font-mono font-medium
        ${priority.bg} ${priority.color} ${priority.border} border
      `}>
        {priority.label}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
    </motion.div>
  );
};
