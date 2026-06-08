import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setCampaigns,
  addCampaign,
  updateCampaign as updateCampaignAction,
  deleteCampaign as deleteCampaignAction,
  setActiveCampaign as setActiveCampaignAction,
  setLoading,
  setError,
} from '@/store/slices/campaignSlice'
import * as campaignApi from '@/services/api/campaign.api'
import type { Campaign } from '@/types/campaign.types'

type CampaignCreateData = Omit<Campaign, 'id' | 'posts' | 'createdAt' | 'updatedAt'>
type CampaignUpdateData = Partial<Omit<Campaign, 'id' | 'posts' | 'createdAt' | 'updatedAt'>>

export function useCampaigns() {
  const dispatch = useAppDispatch()
  const { campaigns, activeCampaign, loading, error } = useAppSelector(s => s.campaigns)
  const workspaceId = useAppSelector(s => s.auth.user?.id)

  const fetchCampaigns = useCallback(async () => {
    if (!workspaceId) return
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const data = await campaignApi.getCampaigns(workspaceId)
      dispatch(setCampaigns(data))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, workspaceId])

  const createCampaign = useCallback(async (data: CampaignCreateData) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const created = await campaignApi.createCampaign(data)
      dispatch(addCampaign(created))
      return created
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const updateCampaign = useCallback(async (id: string, data: CampaignUpdateData) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const updated = await campaignApi.updateCampaign(id, data)
      dispatch(updateCampaignAction(updated))
      return updated
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const deleteCampaign = useCallback(async (id: string) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      await campaignApi.deleteCampaign(id)
      dispatch(deleteCampaignAction(id))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const setActiveCampaign = useCallback((campaign: Campaign | null) => {
    dispatch(setActiveCampaignAction(campaign))
  }, [dispatch])

  return {
    campaigns,
    activeCampaign,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    setActiveCampaign,
  }
}
