/** Mirrors backend/app/schemas/vehicle.py and backend/app/domain/vehicle_status.py. */
export type VehicleStatus = 'moving' | 'stopped' | 'offline' | 'no_position'

export const VEHICLE_STATUSES: readonly VehicleStatus[] = ['moving', 'stopped', 'offline', 'no_position']

export interface Position {
  latitude: number
  longitude: number
  altitude_m: number | null
  /** Degrees clockwise from north, 0 to 359. */
  heading: number | null
  satellites: number | null
}

/** The driver bound to a vehicle in Wialon (RF-13). */
export interface VehicleDriver {
  id: string
  name: string
  phone: string | null
}

export interface Vehicle {
  id: number
  name: string
  status: VehicleStatus
  speed_kmh: number | null
  /** ISO-8601 in UTC. */
  last_update: string | null
  position: Position | null
  /** null when no driver is bound to the vehicle. */
  driver: VehicleDriver | null
}

export interface VehicleFilters {
  search: string
  status: VehicleStatus | null
  page: number
  pageSize: number
}
