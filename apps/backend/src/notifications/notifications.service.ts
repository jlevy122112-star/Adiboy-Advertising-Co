import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';

export const notificationsService = {
  async getAll(userId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  },

  async create(userId: string, payload: {
    type: string;
    title: string;
    message: string;
    priority?: string;
  }) {
    const { data } = await supabase
      .from('notifications')
      .insert({
        id: uuidv4(),
        user_id: userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: payload.priority || 'routine',
        read: false,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    return data;
  },

  async markRead(id: string, userId: string) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
  },

  async getPreferences(userId: string) {
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data;
  },
};
