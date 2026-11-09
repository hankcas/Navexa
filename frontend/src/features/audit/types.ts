/** Mirrors backend/app/schemas/audit.py. */
export type AuditCategory = 'auth' | 'users' | 'vehicles' | 'drivers' | 'passengers'

export interface AuditEntry {
  id: number
  /** ISO-8601 in UTC. */
  created_at: string
  actor_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
}

export interface AuditFilters {
  category: AuditCategory | null
  search: string
  page: number
}
