import { useQuery } from '@tanstack/react-query'

import { apiRequest } from '../../../shared/api/client'
import { vehicleKeys } from '../queries'
import type { TrackRequest, VehicleTrack } from './types'

const FIVE_MINUTES_MS = 5 * 60_000

export function trackPath({ vehicleId, from, to }: TrackRequest): string {
  return `/vehicles/${vehicleId}/track?${new URLSearchParams({ from, to })}`
}

/**
 * A past route does not change, so it is not refreshed on a timer like the live positions.
 * Asking for the same vehicle and range again within 5 minutes reuses the answer.
 */
export function useVehicleTrack(request: TrackRequest | null) {
  return useQuery({
    queryKey: [...vehicleKeys.all, 'track', request] as const,
    queryFn: () => apiRequest<VehicleTrack>(trackPath(request!)),
    enabled: request !== null,
    staleTime: FIVE_MINUTES_MS,
  })
}
