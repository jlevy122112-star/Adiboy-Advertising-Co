export type SceneId =
  | 'vault'
  | 'brand_chamber'
  | 'audience_arena'
  | 'tone_lab'
  | 'content_forge'
  | 'artifact_vault'
  | 'creator_hub'
  | 'observatory'
  | 'scheduler_tower'
  | 'multiverse_gate';

export interface SceneProgress {
  sceneId: SceneId;
  unlocked: boolean;
  masteryLevel: number;
}
