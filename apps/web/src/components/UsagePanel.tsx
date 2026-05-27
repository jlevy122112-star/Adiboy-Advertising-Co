apps/web/src/components/UsagePanel.tsx

tsx
import React, { useEffect, useState } from 'react';
import type { UsageSnapshot } from '@adiboy/contracts';

function percent(current: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.min(100, Math.round((current / limit) * 100));
}

export const UsagePanel: React.FC = () => {
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/usage', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load usage');
        setUsage(await res.json());
      } catch (e: any) {
        setError(e.message ?? 'Error loading usage');
      }
    })();
  }, []);

  if (error) return <div className="text-red-500">{error}</div>;
  if (!usage) return <div>Loading usage…</div>;

  const { limits } = usage;

  const aiPct = percent(usage.aiGenerations, limits.aiGenerations);
  const postsPct = percent(usage.postsPublished, limits.postsPerMonth);
  const storagePct = percent(usage.storageBytes, limits.storageBytes);

  const resetDate = new Date(usage.periodStart);
  resetDate.setMonth(resetDate.getMonth() + 1);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">This month&apos;s usage</h2>

      <UsageBar
        label="AI generations"
        current={usage.aiGenerations}
        limit={limits.aiGenerations}
        percent={aiPct}
      />

      <UsageBar
        label="Posts published"
        current={usage.postsPublished}
        limit={limits.postsPerMonth}
        percent={postsPct}
      />

      <UsageBar
        label="Storage"
        current={usage.storageBytes}
        limit={limits.storageBytes}
        percent={storagePct}
        format={(v) => `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`}
      />

      <div className="text-sm text-gray-500">
        Resets on {resetDate.toLocaleDateString()}
      </div>
    </div>
  );
};

interface UsageBarProps {
  label: string;
  current: number;
  limit: number | null;
  percent: number | null;
  format?: (v: number) => string;
}

const UsageBar: React.FC<UsageBarProps> = ({
  label,
  current,
  limit,
  percent,
  format
}) => {
  const displayCurrent = format ? format(current) : current.toString();
  const displayLimit =
    limit === null ? 'Unlimited' : format ? format(limit) : limit.toString();

  const pct = percent ?? 0;
  const color =
    percent === null
      ? 'bg-gray-400'
      : pct < 70
      ? 'bg-emerald-500'
      : pct < 90
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>
          {displayCurrent} / {displayLimit}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded">
        {percent !== null && (
          <div
            className={`h-2 rounded ${color}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
};
