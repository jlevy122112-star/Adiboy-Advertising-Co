// ─── User & Auth ───────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

// ─── Brand ─────────────────────────────────────────────────────────────────
export interface Brand {
  id: string;
  userId: string;
  name: string;
  logoUrl: string | null;
  colors: BrandColors;
  tone: BrandTone;
  industry: string | null;
  website: string | null;
  createdAt: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

export type BrandTone =
  | 'professional'
  | 'casual'
  | 'humorous'
  | 'inspirational'
  | 'authoritative'
  | 'playful';

// ─── Platform ──────────────────────────────────────────────────────────────
export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'x';

// ─── Campaign ──────────────────────────────────────────────────────────────
export interface Campaign {
  id: string;
  brandId: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'paused' | 'completed' | 'draft';
}

// ─── Planner Task ──────────────────────────────────────────────────────────
export interface PlannerTask {
  id: string;
  brandId: string;
  campaignId: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  platform: SocialPlatform | null;
  createdAt: string;
}

// ─── Calendar Post ─────────────────────────────────────────────────────────
export interface CalendarPost {
  id: string;
  brandId: string;
  campaignId: string | null;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'draft' | 'failed';
  platform: SocialPlatform;
  caption: string | null;
  imageUrls: string[];
  hashtags: string[];
}

// ─── Content Generation ────────────────────────────────────────────────────
export interface GenerationRequest {
  brandId: string;
  audienceId: string | null;
  tone: BrandTone;
  platforms: SocialPlatform[];
  goals: string[];
  contentType: 'post' | 'story' | 'reel' | 'ad' | 'email';
  topic: string;
  keywords: string[];
}

export interface GenerationResult {
  id: string;
  copy: string[];
  images: string[];
  captions: string[];
  hashtags: string[];
  variations: string[];
  generatedAt: string;
}

// ─── Progression / Rewards ─────────────────────────────────────────────────
export interface UserProgression {
  userId: string;
  totalXp: number;
  level: number;
  prestigeRank: number;
  currentStreak: number;
  longestStreak: number;
  generationsCount: number;
  updatedAt: string;
}

export interface OfficeState {
  userId: string;
  level: number;
  generationsCount: number;
  prestigeRank: number;
  cosmetics: Record<string, string>;
  unlockedScenes: string[];
  updatedAt: string;
}

export interface Achievement {
  id: string;
  userId: string;
  achievementKey: string;
  title: string;
  description: string;
  iconUrl: string | null;
  unlockedAt: string;
}

export interface LootboxReward {
  type: 'cosmetic' | 'xp_boost' | 'scene_unlock' | 'template' | 'badge';
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  value: string | number;
}

// ─── Scene ─────────────────────────────────────────────────────────────────
export type SceneId =
  | 'brand_identity_chamber'
  | 'audience_arena'
  | 'content_forge'
  | 'artifact_vault'
  | 'scheduler_tower'
  | 'observatory'
  | 'creator_hub'
  | 'prestige_sanctum'
  | 'archive_depths'
  | 'command_bridge';

export interface SceneProgress {
  sceneId: SceneId;
  userId: string;
  isUnlocked: boolean;
  completionPercent: number;
  lastVisited: string | null;
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  totalPosts: number;
  totalReach: number;
  avgEngagementRate: number;
  topPlatform: SocialPlatform;
  growthPercent: number;
  period: '7d' | '30d' | '90d';
}

// ─── API Response ──────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
