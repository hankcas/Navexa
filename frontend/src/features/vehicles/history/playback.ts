import type { TrackPoint } from './types'

/** Where the vehicle was at one moment of the playback. */
export interface PlaybackFrame {
  time: number
  latitude: number
  longitude: number
  speed_kmh: number
  heading: number | null
  moving: boolean
}

/** Same threshold as the vehicle status in the backend (STATUS_MOVING_SPEED_KMH). */
export const MOVING_SPEED_KMH = 5

/** Index of the last point at or before `time` (binary search: the points are sorted by time). */
function pointBefore(times: readonly number[], time: number): number {
  let low = 0
  let high = times.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (times[middle] <= time) low = middle
    else high = middle - 1
  }
  return low
}

/**
 * The vehicle's position at any moment, not only at the recorded points: between two points it
 * moves in a straight line at the pace the times say (linear interpolation). That is what lets
 * the playback run smoothly at any speed.
 */
export function frameAt(points: readonly TrackPoint[], times: readonly number[], time: number): PlaybackFrame {
  const index = pointBefore(times, time)
  const current = points[index]
  const next = points[index + 1]
  const span = next ? times[index + 1] - times[index] : 0
  const progress = span > 0 ? Math.min(1, Math.max(0, (time - times[index]) / span)) : 0
  const along = (from: number, to: number) => from + (to - from) * progress

  const speed = next ? along(current.speed_kmh, next.speed_kmh) : current.speed_kmh
  return {
    time: Math.max(time, times[0]),
    latitude: next ? along(current.latitude, next.latitude) : current.latitude,
    longitude: next ? along(current.longitude, next.longitude) : current.longitude,
    speed_kmh: speed,
    heading: current.heading,
    moving: speed > MOVING_SPEED_KMH,
  }
}

export type SpeedBand = 'stopped' | 'normal' | 'fast'

export const FAST_SPEED_KMH = 60

/** The map legend; colors come from the same tokens as the vehicle status. */
export const SPEED_BANDS: readonly { band: SpeedBand; label: string }[] = [
  { band: 'stopped', label: `Detenido (hasta ${MOVING_SPEED_KMH} km/h)` },
  { band: 'normal', label: `En marcha (${MOVING_SPEED_KMH} a ${FAST_SPEED_KMH} km/h)` },
  { band: 'fast', label: `Rápido (más de ${FAST_SPEED_KMH} km/h)` },
]

export function speedBand(speedKmh: number): SpeedBand {
  if (speedKmh <= MOVING_SPEED_KMH) return 'stopped'
  return speedKmh <= FAST_SPEED_KMH ? 'normal' : 'fast'
}

export interface SpeedRun {
  band: SpeedBand
  positions: [number, number][]
}

/**
 * The route cut into pieces of the same speed band, so the map can color each one. Each piece
 * starts where the previous one ended, so the line has no gaps. A stretch takes the band of the
 * speed at its first point.
 */
export function speedRuns(points: readonly TrackPoint[]): SpeedRun[] {
  const runs: SpeedRun[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const band = speedBand(points[i].speed_kmh)
    const next: [number, number] = [points[i + 1].latitude, points[i + 1].longitude]
    const last = runs.at(-1)
    if (last && last.band === band) last.positions.push(next)
    else runs.push({ band, positions: [[points[i].latitude, points[i].longitude], next] })
  }
  return runs
}
