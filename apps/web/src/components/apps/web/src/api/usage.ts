ts
import type { UsageSnapshot } from '@adiboy/contracts';

export async function fetchUsage(): Promise<UsageSnapshot> {
  const res = await fetch('/api/usage', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load usage');
  return res.json();
}
