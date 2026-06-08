import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setPosts,
  addPost as addPostAction,
  updatePost as updatePostAction,
  deletePost as deletePostAction,
  setSelectedDate as setSelectedDateAction,
  setViewMode as setViewModeAction,
} from '@/store/slices/calendarSlice'
import { supabase } from '@/services/api/supabase.client'
import type { Post } from '@/types/campaign.types'

type ViewMode = 'month' | 'week' | 'day'
type PostCreateData = Omit<Post, 'id'>
type PostUpdateData = Partial<Omit<Post, 'id' | 'campaignId'>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPost(row: Record<string, any>): Post {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    platform: row.platform,
    contentType: row.content_type,
    caption: row.caption ?? '',
    hashtags: row.hashtags ?? [],
    mediaUrls: row.media_urls ?? [],
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    status: row.status,
    analytics: row.analytics ?? undefined,
  }
}

export function useCalendar() {
  const dispatch = useAppDispatch()
  const { posts, selectedDate, viewMode, loading } = useAppSelector(s => s.calendar)
  const workspaceId = useAppSelector(s => s.auth.user?.id)

  const fetchPosts = useCallback(async (month: number, year: number) => {
    if (!workspaceId) return

    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from('posts')
      .select('*, campaigns!inner(workspace_id)')
      .eq('campaigns.workspace_id', workspaceId)
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate)
      .order('scheduled_at', { ascending: true })

    if (error) throw new Error(error.message)
    dispatch(setPosts((data ?? []).map(mapRowToPost)))
  }, [dispatch, workspaceId])

  const addPost = useCallback(async (post: PostCreateData) => {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        campaign_id: post.campaignId,
        platform: post.platform,
        content_type: post.contentType,
        caption: post.caption,
        hashtags: post.hashtags,
        media_urls: post.mediaUrls,
        scheduled_at: post.scheduledAt ?? null,
        status: post.status,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    const created = mapRowToPost(data)
    dispatch(addPostAction(created))
    return created
  }, [dispatch])

  const updatePost = useCallback(async (id: string, data: PostUpdateData) => {
    const row: Record<string, unknown> = {}
    if (data.platform !== undefined) row.platform = data.platform
    if (data.contentType !== undefined) row.content_type = data.contentType
    if (data.caption !== undefined) row.caption = data.caption
    if (data.hashtags !== undefined) row.hashtags = data.hashtags
    if (data.mediaUrls !== undefined) row.media_urls = data.mediaUrls
    if (data.scheduledAt !== undefined) row.scheduled_at = data.scheduledAt
    if (data.status !== undefined) row.status = data.status

    const { data: updated, error } = await supabase
      .from('posts')
      .update(row)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    const mapped = mapRowToPost(updated)
    dispatch(updatePostAction(mapped))
    return mapped
  }, [dispatch])

  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    dispatch(deletePostAction(id))
  }, [dispatch])

  const setSelectedDate = useCallback((date: string | null) => {
    dispatch(setSelectedDateAction(date))
  }, [dispatch])

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch(setViewModeAction(mode))
  }, [dispatch])

  return {
    posts,
    selectedDate,
    viewMode,
    loading,
    fetchPosts,
    addPost,
    updatePost,
    deletePost,
    setSelectedDate,
    setViewMode,
  }
}
