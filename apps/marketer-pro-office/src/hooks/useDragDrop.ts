import { useState, useCallback } from 'react'
import { useAppDispatch } from '@/store'
import { updatePost as updatePostAction } from '@/store/slices/calendarSlice'
import { supabase } from '@/services/api/supabase.client'
import type { Post } from '@/types/campaign.types'

export function useDragDrop() {
  const dispatch = useAppDispatch()
  const [dragging, setDragging] = useState(false)
  const [dragPost, setDragPost] = useState<Post | null>(null)

  const onDragStart = useCallback((post: Post) => {
    setDragging(true)
    setDragPost(post)
  }, [])

  const onDragEnd = useCallback(async (targetDate: string) => {
    if (!dragPost) {
      setDragging(false)
      return
    }

    const sourceDate = dragPost.scheduledAt
    if (sourceDate === targetDate) {
      setDragging(false)
      setDragPost(null)
      return
    }

    const updatedPost: Post = {
      ...dragPost,
      scheduledAt: targetDate,
      status: 'scheduled',
    }

    // Optimistic update
    dispatch(updatePostAction(updatedPost))
    setDragging(false)
    setDragPost(null)

    try {
      const { data, error } = await supabase
        .from('posts')
        .update({ scheduled_at: targetDate, status: 'scheduled' })
        .eq('id', dragPost.id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      const persisted: Post = {
        ...updatedPost,
        scheduledAt: data.scheduled_at ?? targetDate,
        status: data.status,
      }
      dispatch(updatePostAction(persisted))
    } catch {
      // Rollback optimistic update on failure
      dispatch(updatePostAction(dragPost))
    }
  }, [dispatch, dragPost])

  const onDrop = useCallback((date: string) => {
    onDragEnd(date)
  }, [onDragEnd])

  return {
    dragging,
    dragPost,
    onDragStart,
    onDragEnd,
    onDrop,
  }
}
