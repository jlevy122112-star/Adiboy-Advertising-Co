import type { SceneId, SceneProgress } from './types';

interface SceneManagerProps {
  sceneId: SceneId;
  progress: SceneProgress[];
  brandId: string;
  onComplete: () => void;
  onClose: () => void;
}

export const SceneManager: React.FC<SceneManagerProps> = ({
  sceneId,
  progress,
  brandId,
  onComplete,
  onClose,
}) => {
  const sceneProgress = progress.find(p => p.sceneId === sceneId);

  if (!sceneProgress?.unlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
        <p className="font-display text-xl tracking-[0.2em] text-slate-500">
          SCENE LOCKED
        </p>
        <p className="font-classified text-xs tracking-[0.2em] text-slate-700">
          {sceneId.replace(/_/g, ' ').toUpperCase()}
        </p>
        <button
          onClick={onClose}
          className="font-classified text-[10px] tracking-[0.25em] text-slate-700 hover:text-slate-500 uppercase transition-colors"
        >
          Return to Desk
        </button>
      </div>
    );
  }

  switch (sceneId) {
    case 'brand_chamber':
      return (
        <LazyBrandIdentityChamber brandId={brandId} onComplete={onComplete} />
      );
    case 'audience_arena':
      return (
        <LazyAudienceArena brandId={brandId} onComplete={onComplete} />
      );
    case 'content_forge':
      return (
        <LazyContentForgeScene generationId="" onComplete={onComplete} />
      );
    default:
      return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
          <p className="font-display text-xl tracking-[0.2em] text-slate-400">
            {sceneId.replace(/_/g, ' ').toUpperCase()}
          </p>
          <p className="font-classified text-xs tracking-[0.2em] text-slate-600">
            COMING SOON
          </p>
          <button
            onClick={onClose}
            className="font-classified text-[10px] tracking-[0.25em] text-slate-700 hover:text-slate-500 uppercase transition-colors"
          >
            Return to Desk
          </button>
        </div>
      );
  }
};

// Lazy wrappers — components live in apps/mobile-client/src/scenes
// These are imported at runtime to keep the package dependency-free
const LazyBrandIdentityChamber: React.FC<{ brandId: string; onComplete: () => void }> = (props) => {
  // Resolved by the consuming app's bundler via alias
  const { BrandIdentityChamber } = require('../../apps/mobile-client/src/scenes/BrandIdentityChamber');
  return <BrandIdentityChamber {...props} />;
};

const LazyAudienceArena: React.FC<{ brandId: string; onComplete: () => void }> = (props) => {
  const { AudienceArena } = require('../../apps/mobile-client/src/scenes/AudienceArena');
  return <AudienceArena {...props} />;
};

const LazyContentForgeScene: React.FC<{ generationId: string; onComplete: () => void }> = (props) => {
  const { ContentForgeScene } = require('../../apps/mobile-client/src/scenes/ContentForgeScene');
  return <ContentForgeScene {...props} />;
};
