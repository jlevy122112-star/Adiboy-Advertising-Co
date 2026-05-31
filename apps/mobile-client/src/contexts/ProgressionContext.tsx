import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserProgression, OfficeState, Achievement, LootboxReward } from '../types';
import { useAuth } from './AuthContext';

interface ProgressionContextValue {
  progression: UserProgression | null;
  officeState: OfficeState | null;
  achievements: Achievement[];
  isLoading: boolean;
  awardXp: (amount: number, reason: string) => Promise<void>;
  openLootbox: () => Promise<LootboxReward[]>;
  refreshProgression: () => Promise<void>;
}

const ProgressionContext = createContext<ProgressionContextValue | null>(null);

export const ProgressionProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [progression, setProgression] = useState<UserProgression | null>(null);
  const [officeState, setOfficeState] = useState<OfficeState | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProgression = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [progRes, officeRes, achRes] = await Promise.all([
        fetch('/api/progression', { credentials: 'include' }),
        fetch('/api/progression/office', { credentials: 'include' }),
        fetch('/api/progression/achievements', { credentials: 'include' }),
      ]);
      if (progRes.ok) setProgression(await progRes.json());
      if (officeRes.ok) setOfficeState(await officeRes.json());
      if (achRes.ok) {
        const data = await achRes.json();
        setAchievements(data.achievements);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchProgression();
  }, [isAuthenticated]);

  const awardXp = async (amount: number, reason: string) => {
    const res = await fetch('/api/progression/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount, reason }),
    });
    if (res.ok) {
      const data = await res.json();
      setProgression(data.progression);
      setOfficeState(data.officeState);
    }
  };

  const openLootbox = async (): Promise<LootboxReward[]> => {
    const res = await fetch('/api/rewards/lootbox/open', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to open lootbox');
    const data = await res.json();
    return data.rewards;
  };

  return (
    <ProgressionContext.Provider
      value={{
        progression,
        officeState,
        achievements,
        isLoading,
        awardXp,
        openLootbox,
        refreshProgression: fetchProgression,
      }}
    >
      {children}
    </ProgressionContext.Provider>
  );
};

export const useProgression = (): ProgressionContextValue => {
  const ctx = useContext(ProgressionContext);
  if (!ctx) throw new Error('useProgression must be used within ProgressionProvider');
  return ctx;
};
