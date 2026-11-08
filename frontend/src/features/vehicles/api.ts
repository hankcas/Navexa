import { apiRequest } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type { Vehicle, VehicleFilters } from './types'

/** Largest page the backend accepts. */
const MAX_PAGE_SIZE = 100

function vehiclesPath({ search, status, page, pageSize }: VehicleFilters): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  const term = search.trim()
  if (term) params.set('search', term)
  if (status) params.set('status', status)
  return `/vehicles?${params}`
}

export const vehiclesApi = {
  /** One page for the list. Search, filter and pagination happen on the server (RF-10). */
  list: (filters: VehicleFilters) => apiRequest<Page<Vehicle>>(vehiclesPath(filters)),

  /**
   * Every vehicle that matches the search and status, for the map. Walks the pages in case the
   * fleet outgrows one page.
   */
  async listAll({ search, status }: Pick<VehicleFilters, 'search' | 'status'>): Promise<Vehicle[]> {
    const filters: VehicleFilters = { search, status, page: 1, pageSize: MAX_PAGE_SIZE }
    const first = await vehiclesApi.list(filters)
    const vehicles = [...first.items]
    for (let page = 2; page <= first.pages; page++) {
      const next = await vehiclesApi.list({ ...filters, page })
      vehicles.push(...next.items)
    }
    return vehicles
  },
}
