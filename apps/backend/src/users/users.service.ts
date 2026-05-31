import { supabase } from '../config/db';
import { NotFoundError } from '../common/errors';

export const usersService = {
  // GET /me — returns user + workspace + brand + progression
  async getMe(userId: string) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', userId)
      .single();

    if (!user) throw new NotFoundError('User');

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_user_id', userId)
      .single();

    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, industry, logo_url, primary_color, secondary_color')
      .eq('workspace_id', workspace?.id)
      .single();

    const { data: progression } = await supabase
      .from('user_progress')
      .select('level, xp')
      .eq('user_id', userId)
      .single();

    return { user, workspace, brand, progression };
  },

  // PATCH /me
  async updateMe(userId: string, updates: { name?: string; role?: string }) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, email, name, role')
      .single();

    if (error) throw new Error('Failed to update user');
    return data;
  },
};
