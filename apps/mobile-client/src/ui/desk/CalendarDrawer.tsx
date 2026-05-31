import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Plus,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns';
import type { CalendarPost, SocialPlatform } from '../../types';
import { useBrand } from '../../contexts/BrandContext';

interface CalendarDrawerProps {
  onClose: () => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <Instagram className="w-2.5 h-2.5" />,
  facebook: <Facebook className="w-2.5 h-2.5" />,
  tiktok: <span className="text-[8px] font-bold">TT</span>,
  linkedin: <Linkedin className="w-2.5 h-2.5" />,
  x: <Twitter className="w-2.5 h-2.5" />,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  tiktok: '#69c9d0',
  linkedin: '#0a66c2',
  x: '#94a3b8',
};

const STATUS_DOT: Record<CalendarPost['status'], string> = {
  scheduled: 'bg-classified',
  sent: 'bg-success',
  draft: 'bg-slate-600',
  failed: 'bg-danger',
};

export const CalendarDrawer = ({ onClose }: CalendarDrawerProps) => {
  const { activeBrand } = useBrand();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      const res = await fetch(
        `/api/calendar?brandId=${activeBrand.id}&month=${month}&year=${year}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrand, currentMonth]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleReschedule = async (postId: string, newDate: Date) => {
    // Optimistic update
    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, scheduledAt: newDate.toISOString() } : p,
      ),
    );
    try {
      await fetch(`/api/calendar/posts/${postId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      });
    } catch {
      loadPosts();
    }
  };

  // Generate calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start
  const startPadding = monthStart.getDay(); // 0 = Sunday
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...days,
  ];

  const getPostsForDay = (date: Date) =>
    posts.filter(p => isSameDay(parseISO(p.scheduledAt), date));

  const selectedDayPosts = selectedDate ? getPostsForDay(selectedDate) : [];

  return (
    <aside className="flex flex-col w-full md:w-80 h-full bg-desk-900/95 border-l border-white/[0.06] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-heading text-sm font-semibold text-slate-200 min-w-[100px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 px-3 pt-2 pb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-2xs text-slate-600 font-heading tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
        {paddedDays.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const dayPosts = getPostsForDay(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`
                relative flex flex-col items-center p-1 rounded-lg transition-all duration-150 min-h-[36px]
                ${isSelected ? 'bg-classified/15 ring-1 ring-classified/40' : 'hover:bg-white/[0.04]'}
              `}
            >
              <span className={`
                text-xs font-body leading-none mb-1
                ${today ? 'font-semibold text-classified' : isSelected ? 'text-slate-200' : 'text-slate-500'}
              `}>
                {format(day, 'd')}
              </span>
              {/* Post dots */}
              {dayPosts.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center max-w-full">
                  {dayPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className={`w-1 h-1 rounded-full ${STATUS_DOT[post.status]}`}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="w-1 h-1 rounded-full bg-slate-600" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mx-4" />

      {/* Selected day posts */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-heading tracking-widest text-slate-500 uppercase">
            {selectedDate ? format(selectedDate, 'MMM d') : 'Select a day'}
          </span>
          <button className="w-6 h-6 rounded-md flex items-center justify-center bg-classified/10 text-classified hover:bg-classified/20 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : selectedDayPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center mb-2">
              <Plus className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-xs text-slate-600">No posts scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDayPosts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                {/* Platform icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${PLATFORM_COLORS[post.platform]}20` }}
                >
                  <span style={{ color: PLATFORM_COLORS[post.platform] }}>
                    {PLATFORM_ICONS[post.platform]}
                  </span>
                </div>

                {/* Post info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">
                    {post.caption ?? 'Draft post'}
                  </p>
                  <p className="text-2xs text-slate-600 mt-0.5">
                    {format(parseISO(post.scheduledAt), 'h:mm a')}
                  </p>
                </div>

                {/* Status */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[post.status]}`} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
