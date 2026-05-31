import type { createContext } from 'react';

export type CinematicState =
  | 'idle'
  | 'vault'
  | 'reactor'
  | 'chamber'
  | 'complete'
  | 'error';

export interface GenerationRequest {
  brandId: string;
  audienceId?: string;
  platforms: string[];
  goal: string;
  contentType: 'ad' | 'post' | 'script';
}

export interface GenerationResult {
  id: string;
  copy: string[];
  images: string[];
  captions: string[];
  hashtags: string[];
  variations: string[];
}

export interface CinematicEngineContextValue {
  state: CinematicState;
  startSequence: (req: GenerationRequest) => void;
  result: GenerationResult | null;
  error: string | null;
}
