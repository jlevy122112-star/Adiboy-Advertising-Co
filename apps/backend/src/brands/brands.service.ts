import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';
import { NotFoundError } from '../common/errors';

export const brandsService = {
  // GET /brands
  async getByWorkspace(workspaceId: string) {
    const { data } = await supabase
      .from('brands')
      .select('*')
      .eq('workspace_id', workspaceId);
    return data || [];
  },

  // POST /brands
  async create(workspaceId: string, payload: {
    name: string;
    industry?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  }) {
    const { data, error } = await supabase
      .from('brands')
      .insert({ id: uuidv4(), workspace_id: workspaceId, ...payload })
      .select('*')
      .single();
    if (error) throw new Error('Failed to create brand');
    return data;
  },

  // PATCH /brands/:id
  async update(id: string, workspaceId: string, payload: Partial<{
    name: string;
    industry: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
  }>) {
    const { data: existing } = await supabase
      .from('brands')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();
    if (!existing) throw new NotFoundError('Brand');

    const { data, error } = await supabase
      .from('brands')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error('Failed to update brand');
    return data;
  },
};
