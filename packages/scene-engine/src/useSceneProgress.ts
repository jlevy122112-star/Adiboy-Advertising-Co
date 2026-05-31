import { useState, useEffect, useCallback } from 'react';
import type { SceneId, SceneProgress } from './types';

export const useSceneProgress = () => {
  const [progress, setProgress] = useState<SceneProgress[]>([]);

  useEffect(() => {
    fetch('/api/scenes/progress', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setProgress(data.progress));
  }, []);

  const markSceneCompleted = useCallback(async (sceneId: SceneId) => {
    await fetch(`/api/scenes/${sceneId}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
    // Refetch to reflect updated masteryLevel and unlock state
    const res = await fetch('/api/scenes/progress', { credentials: 'include' });
    const data = await res.json();
    setProgress(data.progress);
  }, []);

  return { progress, markSceneCompleted };
};
