import { useQuery } from '@tanstack/react-query'

import { apiRequest } from '../../shared/api/client'
import type { DashboardSummary } from './types'

/** The KPIs move slower than positions; once a minute is enough (paused in hidden tabs). */
const REFRESH_MS = 60_000

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiRequest<DashboardSummary>('/dashboard/summary'),
    refetchInterval: REFRESH_MS,
  })
}
