
import type { CinematicState } from './types';

export const CINEMATIC_TRANSITIONS: Record<CinematicState, CinematicState[]> = {
  idle:     ['vault'],
  vault:    ['reactor'],
  reactor:  ['chamber', 'idle'],
  chamber:  ['complete', 'error'],
  complete: ['idle'],
  error:    ['idle'],
};

export function canTransition(from: CinematicState, to: CinematicState): boolean {
  return CINEMATIC_TRANSITIONS[from].includes(to);
}

export function transition(
  current: CinematicState,
  next: CinematicState,
): CinematicState {
  if (!canTransition(current, next)) {
    console.warn(`[CinematicEngine] Invalid transition: ${current} → ${next}`);
    return current;
  }
  return next;
}
