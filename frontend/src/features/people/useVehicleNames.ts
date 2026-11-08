import { useMemo } from 'react'

import { useVehiclesMap } from '../vehicles/queries'
import type { Vehicle } from '../vehicles/types'

/**
 * Every vehicle by ID, to show names instead of numbers. Reuses the map's cached list, so on
 * the vehicles page and here it is fetched once.
 */
export function useVehiclesById() {
  const vehicles = useVehiclesMap({ search: '', status: null })
  const byId = useMemo(
    () => new Map<number, Vehicle>((vehicles.data ?? []).map((vehicle) => [vehicle.id, vehicle])),
    [vehicles.data],
  )
  return { byId, list: vehicles.data ?? [], isPending: vehicles.isPending }
}
