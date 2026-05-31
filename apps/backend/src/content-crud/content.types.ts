export interface ContentItem {
  id: string;
  campaign_id: string;
  channel: string;
  type: string;
  title: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentVariant {
  id: string;
  content_id: string;
  copy: string;
  media_url?: string;
  created_at: string;
}

export interface ContentStatusHistory {
  id: string;
  content_id: string;
  status: string;
  changed_at: string;
  changed_by: string;
}

export type CreateContentPayload = Pick<ContentItem,
  'channel' | 'type' | 'title' | 'status'
> & { variants?: { copy: string; media_url?: string }[] };

export type UpdateContentPayload = Partial<Pick<ContentItem,
  'title' | 'status' | 'scheduled_at'
>>;
