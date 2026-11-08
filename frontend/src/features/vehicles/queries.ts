import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { vehiclesApi } from './api'
import type { VehicleFilters } from './types'

/** Positions refresh every 30 s. React Query pauses the timer while the tab is hidden (RF-14). */
export const POLL_INTERVAL_MS = 30_000

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (filters: VehicleFilters) => ['vehicles', 'list', filters] as const,
  map: ['vehicles', 'map'] as const,
}

export function useVehiclesPage(filters: VehicleFilters) {
  return useQuery({
    queryKey: vehicleKeys.list(filters),
    queryFn: () => vehiclesApi.list(filters),
    // Keeps the current rows on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
    refetchInterval: POLL_INTERVAL_MS,
  })
}
