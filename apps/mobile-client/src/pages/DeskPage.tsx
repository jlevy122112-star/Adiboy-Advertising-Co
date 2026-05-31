import { useState } from 'react';
import { DeskLayout } from '../ui/desk/DeskLayout';
import { CinematicEngineProvider } from '@marketer-pro/cinematic-engine';

export const DeskPage = () => {
  const [generateMode, setGenerateMode] = useState(false);

  return (
    <CinematicEngineProvider onComplete={() => setGenerateMode(false)}>
      <DeskLayout
        generateMode={generateMode}
        onOpenGenerator={() => setGenerateMode(true)}
      />
    </CinematicEngineProvider>
  );
};
