import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';

// XP awards per event type as defined in the document
const XP_MAP: Record<string, number> = {
  published_post: 50,
  created_campaign: 100,
  completed_generation: 75,
  connected_platform: 150,
  completed_onboarding: 200,
  opened_loot_box: 25,
  completed_scene: 60,
};

export const progressionService = {
  // GET /progression
  async getProfile(userId: string) {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('level, xp')
      .eq('user_id', userId)
      .single();

    const { data: unlocks } = await supabase
      .from('unlocks')
      .select('*')
      .eq('user_id', userId);

    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId);

    const { data: cosmetics } = await supabase
      .from('cosmetics')
      .select('*')
      .eq('user_id', userId);

    return { progress, unlocks: unlocks || [], achievements: achievements || [], cosmetics: cosmetics || [] };
  },

  // POST /progression/event
  // Event types: published_post, created_campaign, etc.
  async addEvent(userId: string, eventType: string) {
    const xpAmount = XP_MAP[eventType] || 10;

    const { data: current } = await supabase
      .from('user_progress')
      .select('level, xp')
      .eq('user_id', userId)
      .single();

    if (!current) return;

    const newXp = current.xp + xpAmount;
    const newLevel = Math.floor(newXp / 500) + 1;

    await supabase
      .from('user_progress')
      .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    // Check and award unlocks based on new level
    await this.checkUnlocks(userId, newLevel);

    return { xpAdded: xpAmount, newXp, newLevel };
  },

  async checkUnlocks(userId: string, level: number) {
    // Unlock thresholds as defined in the document
    const unlockMap: Record<number, string> = {
      2: 'brand_identity_chamber',
      4: 'audience_arena',
      6: 'tone_lab',
      8: 'content_forge',
      10: 'artifact_vault',
      12: 'analytics_observatory',
      15: 'scheduler_tower',
      18: 'ppc_command_center',
      20: 'multiverse_gate',
    };

    for (const [threshold, sceneKey] of Object.entries(unlockMap)) {
      if (level >= parseInt(threshold)) {
        await supabase.from('unlocks').upsert({
          id: uuidv4(),
          user_id: userId,
          scene_key: sceneKey,
          unlocked_at: new Date().toISOString(),
        }, { onConflict: 'user_id,scene_key' });
      }
    }
  },
};
