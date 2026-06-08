import { useState, useCallback } from 'react'
import { useAppSelector } from '@/store'
import { getAnalytics, type DateRange } from '@/services/analytics/analytics.service'
import type { AnalyticsSnapshot } from '@/types/analytics.types'
import { format, subDays } from 'date-fns'

function defaultDateRange(): DateRange {
  const end = new Date()
  const start = subDays(end, 29)
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  }
}

export function useAnalytics() {
  const workspaceId = useAppSelector(s => s.auth.user?.id)

  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([])
  const [dateRange, setDateRangeState] = useState<DateRange>(defaultDateRange)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (
    platforms: string[],
    range: DateRange,
  ) => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAnalytics(workspaceId, platforms, range)
      setSnapshots(data)
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range)
  }, [])

  const togglePlatform = useCallback((platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform],
    )
  }, [])

  return {
    snapshots,
    dateRange,
    selectedPlatforms,
    loading,
    error,
    fetchAnalytics,
    setDateRange,
    togglePlatform,
  }
}
