import { useContext } from 'react';
import { CinematicEngineContext } from './CinematicEngineProvider';
import type { CinematicEngineContextValue } from './types';

export const useCinematicEngine = (): CinematicEngineContextValue => {
  const ctx = useContext(CinematicEngineContext);
  if (!ctx) throw new Error('useCinematicEngine must be used within CinematicEngineProvider');
  return ctx;
};
