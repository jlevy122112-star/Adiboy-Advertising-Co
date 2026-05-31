
import { createContext, useState, type PropsWithChildren } from 'react';
import type { CinematicState, GenerationRequest, GenerationResult, CinematicEngineContextValue } from './types';
import { transition } from './stateMachine';
import { VaultDoorScene } from './scenes/VaultDoorScene';
import { ReactorScene } from './scenes/ReactorScene';
import { PresentationChamberScene } from './scenes/PresentationChamberScene';

export const CinematicEngineContext = createContext<CinematicEngineContextValue | null>(null);

interface CinematicEngineProviderProps extends PropsWithChildren {
  onComplete?: () => void;
}

export const CinematicEngineProvider: React.FC<CinematicEngineProviderProps> = ({
  children,
  onComplete,
}) => {
  const [state, setState] = useState<CinematicState>('idle');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSequence = (req: GenerationRequest) => {
    setError(null);
    setResult(null);
    setState(transition('idle', 'vault'));

    // Kick off backend generation in parallel with the cinematic sequence
    void (async () => {
      try {
        const res = await fetch('/api/content/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(req),
        });
        const data = (await res.json()) as GenerationResult;
        setResult(data);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Generation failed';
        setError(message);
      }
    })();
  };

  const value: CinematicEngineContextValue = {
    state,
    startSequence,
    result,
    error,
  };

  return (
    <CinematicEngineContext.Provider value={value}>
      {children}

      {/* Overlay scenes based on state */}
      {state === 'vault' && (
        <VaultDoorScene onDone={() => setState(transition(state, 'reactor'))} />
      )}
      {state === 'reactor' && (
        <ReactorScene
          onDone={() => setState(transition(state, 'chamber'))}
          onAbort={() => setState(transition(state, 'idle'))}
        />
      )}
      {state === 'chamber' && (
        <PresentationChamberScene
          result={result}
          error={error}
          onDone={() => {
            setState(transition(state, error ? 'error' : 'complete'));
            onComplete?.();
          }}
        />
      )}
    </CinematicEngineContext.Provider>
  );
};
