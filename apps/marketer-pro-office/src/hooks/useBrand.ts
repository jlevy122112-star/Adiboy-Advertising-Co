import { useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  setBrand,
  updateBrand as updateBrandAction,
  setLoading,
  setError,
  setSetupComplete,
} from '@/store/slices/brandSlice'
import * as brandApi from '@/services/api/brand.api'
import type { Brand } from '@/types/brand.types'

type BrandCreateData = Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>
type BrandUpdateData = Partial<Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>>

export function useBrand() {
  const dispatch = useAppDispatch()
  const { brand, loading, error, setupComplete } = useAppSelector(s => s.brand)
  const workspaceId = useAppSelector(s => s.auth.user?.id)

  useEffect(() => {
    if (!workspaceId) return

    let mounted = true

    async function fetchBrand() {
      if (!workspaceId) return
      dispatch(setLoading(true))
      dispatch(setError(null))
      try {
        const result = await brandApi.getBrand(workspaceId)
        if (!mounted) return
        dispatch(setBrand(result))
        dispatch(setSetupComplete(result !== null))
      } catch (err) {
        if (mounted) dispatch(setError((err as Error).message))
      } finally {
        if (mounted) dispatch(setLoading(false))
      }
    }

    fetchBrand()

    return () => {
      mounted = false
    }
  }, [dispatch, workspaceId])

  const saveBrand = useCallback(async (data: BrandCreateData) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const created = await brandApi.createBrand(data)
      dispatch(setBrand(created))
      dispatch(setSetupComplete(true))
      return created
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const updateBrand = useCallback(async (data: BrandUpdateData) => {
    if (!brand) throw new Error('No brand to update')
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const updated = await brandApi.updateBrand(brand.id, data)
      dispatch(setBrand(updated))
      return updated
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, brand])

  return { brand, loading, error, setupComplete, saveBrand, updateBrand }
}

// re-export the action for slices that need direct dispatch
export { updateBrandAction }
