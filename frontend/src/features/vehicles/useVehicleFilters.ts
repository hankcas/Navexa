import { useSearchParams } from 'react-router-dom'

import { VEHICLE_STATUSES, type VehicleFilters, type VehicleStatus } from './types'

export const PAGE_SIZE = 20

function parseStatus(value: string | null): VehicleStatus | null {
  return VEHICLE_STATUSES.find((status) => status === value) ?? null
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/**
 * Filters live in the URL (?buscar=&estado=&pagina=), so the back button, a reload or a shared
 * link keep the same view. Invalid values in the URL fall back to the defaults.
 */
export function useVehicleFilters() {
  const [params, setParams] = useSearchParams()

  const filters: VehicleFilters = {
    search: params.get('buscar') ?? '',
    status: parseStatus(params.get('estado')),
    page: parsePage(params.get('pagina')),
    pageSize: PAGE_SIZE,
  }

  function update(changes: Partial<Omit<VehicleFilters, 'pageSize'>>) {
    const next = { ...filters, ...changes }
    // A new search or filter starts again on page 1.
    if (changes.search !== undefined || changes.status !== undefined) next.page = changes.page ?? 1

    const nextParams = new URLSearchParams()
    // Saved as typed: trimming here would delete the space between words while typing.
    // The API call trims it before sending.
    if (next.search.trim()) nextParams.set('buscar', next.search)
    if (next.status) nextParams.set('estado', next.status)
    if (next.page > 1) nextParams.set('pagina', String(next.page))
    setParams(nextParams, { replace: true })
  }

  return { filters, update }
}
