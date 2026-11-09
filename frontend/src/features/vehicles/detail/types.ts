import type { Vehicle } from '../types'

/** Mirrors CustomField in backend/app/schemas/vehicle.py. */
export interface CustomField {
  id: number
  name: string
  value: string
  /** ISO-8601 in UTC. Sent back on save so the backend can spot edits made elsewhere (RF-22). */
  modified_at: string | null
}

export interface VehiclePassenger {
  id: string
  name: string
  code: string | null
}

export interface VehicleDetail extends Vehicle {
  passengers: VehiclePassenger[]
  custom_fields: CustomField[]
}

export interface CustomFieldInput {
  name: string
  value: string
}
