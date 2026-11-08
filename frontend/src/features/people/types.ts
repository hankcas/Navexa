/**
 * Drivers and passengers share most of their shape: both live inside a Wialon resource, have
 * custom fields and can be bound to a vehicle. Mirrors backend/app/schemas/driver.py and
 * backend/app/schemas/passenger.py.
 */
export interface Person {
  /** "<resource>-<item>", e.g. "27668776-7". */
  id: string
  name: string
  code: string | null
  custom_fields: Record<string, string>
  vehicle_id: number | null
  /** ISO-8601 in UTC. */
  bound_at: string | null
}

export interface Driver extends Person {
  phone: string | null
  description: string | null
}

export type Passenger = Person

/** "all", only people with a vehicle, or only people without one. */
export type AssignmentFilter = 'all' | 'assigned' | 'unassigned'

export interface PeopleFilters {
  search: string
  assignment: AssignmentFilter
  page: number
  pageSize: number
}
