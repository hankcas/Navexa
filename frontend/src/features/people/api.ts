import { apiRequest } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type { PeopleFilters, Person } from './types'

export interface PeopleApi<T extends Person, Input> {
  list: (filters: PeopleFilters) => Promise<Page<T>>
  create: (input: Input) => Promise<T>
  update: (id: string, input: Partial<Input>) => Promise<T>
  remove: (id: string) => Promise<void>
  assignVehicle: (id: string, vehicleId: number) => Promise<T>
  unassignVehicle: (id: string) => Promise<T>
}

export function peopleListPath(basePath: string, filters: PeopleFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), page_size: String(filters.pageSize) })
  const term = filters.search.trim()
  if (term) params.set('search', term)
  if (filters.assignment !== 'all') params.set('assigned', String(filters.assignment === 'assigned'))
  return `${basePath}?${params}`
}

/**
 * One API client for both /drivers and /passengers: the endpoints have the same shape, only the
 * path and the body change (the IDs are validated by the backend before reaching Wialon).
 */
export function createPeopleApi<T extends Person, Input>(basePath: string): PeopleApi<T, Input> {
  const itemPath = (id: string) => `${basePath}/${encodeURIComponent(id)}`
  return {
    list: (filters) => apiRequest<Page<T>>(peopleListPath(basePath, filters)),
    create: (input) => apiRequest<T>(basePath, { method: 'POST', body: input }),
    update: (id, input) => apiRequest<T>(itemPath(id), { method: 'PATCH', body: input }),
    remove: (id) => apiRequest<void>(itemPath(id), { method: 'DELETE' }),
    assignVehicle: (id, vehicleId) =>
      apiRequest<T>(`${itemPath(id)}/vehicle`, { method: 'PUT', body: { vehicle_id: vehicleId } }),
    unassignVehicle: (id) => apiRequest<T>(`${itemPath(id)}/vehicle`, { method: 'DELETE' }),
  }
}
