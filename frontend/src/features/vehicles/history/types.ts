/** Mirrors backend/app/schemas/track.py. */
export interface TrackPoint {
  /** ISO-8601 in UTC. */
  time: string
  latitude: number
  longitude: number
  speed_kmh: number
  /** Degrees clockwise from north, 0 to 359. */
  heading: number | null
}

export interface TrackSummary {
  distance_km: number
  max_speed_kmh: number
  /** Average while moving; null if the vehicle never moved in the range. */
  average_speed_kmh: number | null
  started_at: string | null
  ended_at: string | null
}

export interface VehicleTrack {
  vehicle_id: number
  start: string
  end: string
  /** Valid positions Wialon had in the range. */
  total_points: number
  /** True when `points` keeps fewer positions than `total_points`. */
  simplified: boolean
  points: TrackPoint[]
  summary: TrackSummary
}

/** What the user asked for, as it travels in the URL (?vehiculo=…&desde=…&hasta=…). */
export interface TrackRequest {
  vehicleId: number
  /** ISO-8601 in UTC. */
  from: string
  to: string
}
