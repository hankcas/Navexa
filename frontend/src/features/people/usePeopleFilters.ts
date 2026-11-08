import { useSearchParams } from 'react-router-dom'

import type { AssignmentFilter, PeopleFilters } from './types'

export const PAGE_SIZE = 20

const ASSIGNMENT_IN_URL: Record<AssignmentFilter, string | null> = {
  all: null,
  assigned: 'con-vehiculo',
  unassigned: 'sin-vehiculo',
}

function parseAssignment(value: string | null): AssignmentFilter {
  if (value === ASSIGNMENT_IN_URL.assigned) return 'assigned'
  if (value === ASSIGNMENT_IN_URL.unassigned) return 'unassigned'
  return 'all'
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Filters live in the URL (?buscar=&vehiculo=&pagina=), like on the vehicles page. */
export function usePeopleFilters() {
  const [params, setParams] = useSearchParams()

  const filters: PeopleFilters = {
    search: params.get('buscar') ?? '',
    assignment: parseAssignment(params.get('vehiculo')),
    page: parsePage(params.get('pagina')),
    pageSize: PAGE_SIZE,
  }

  function update(changes: Partial<Omit<PeopleFilters, 'pageSize'>>) {
    const next = { ...filters, ...changes }
    if (changes.search !== undefined || changes.assignment !== undefined) next.page = changes.page ?? 1

    const nextParams = new URLSearchParams()
    // Saved as typed, so the space between words survives; the API call trims it.
    if (next.search.trim()) nextParams.set('buscar', next.search)
    const assignment = ASSIGNMENT_IN_URL[next.assignment]
    if (assignment) nextParams.set('vehiculo', assignment)
    if (next.page > 1) nextParams.set('pagina', String(next.page))
    setParams(nextParams, { replace: true })
  }

  return { filters, update }
}
