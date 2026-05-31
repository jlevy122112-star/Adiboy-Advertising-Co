
import { useState, useEffect } from 'react';

export interface OfficeState {
  level: number;
  generationsCount: number;
  prestigeRank: number;
  cosmetics: Record<string, string>;
}

export const useOfficeEvolution = () => {
  const [office, setOffice] = useState<OfficeState | null>(null);

  useEffect(() => {
    fetch('/api/office/state', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setOffice(data.office));
  }, []);

  const applyGeneration = async () => {
    const res = await fetch('/api/office/generation', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    setOffice(data.office);
  };

  return { office, applyGeneration };
};
