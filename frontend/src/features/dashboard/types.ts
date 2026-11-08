import type { VehicleStatus } from '../vehicles/types'

/** Mirrors backend/app/schemas/dashboard.py. */
export interface PeopleSummary {
  total: number
  assigned: number
}

export interface DashboardSummary {
  vehicles: {
    total: number
    by_status: Record<VehicleStatus, number>
    with_driver: number
    without_driver: number
  }
  drivers: PeopleSummary
  passengers: PeopleSummary
  /** ISO-8601 in UTC. */
  generated_at: string
}
