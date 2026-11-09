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
  /** The CSV download with the same search and assignment filter as the list (RF-25). */
  exportPath: (filters: Pick<PeopleFilters, 'search' | 'assignment'>) => string
}

function filterParams({ search, assignment }: Pick<PeopleFilters, 'search' | 'assignment'>): URLSearchParams {
  const params = new URLSearchParams()
  const term = search.trim()
  if (term) params.set('search', term)
  if (assignment !== 'all') params.set('assigned', String(assignment === 'assigned'))
  return params
}

export function peopleListPath(basePath: string, filters: PeopleFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), page_size: String(filters.pageSize) })
  for (const [name, value] of filterParams(filters)) params.set(name, value)
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
    exportPath: (filters) => {
      const query = filterParams(filters).toString()
      return `${basePath}/export${query ? `?${query}` : ''}`
    },
  }
}
