import type { VehicleStatus } from './types'

/** All dates are shown in Colombia time, whatever the timezone of the user's device. */
const TIME_ZONE = 'America/Bogota'
const LOCALE = 'es-CO'

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  offline: 'Sin señal',
  no_position: 'Sin posición',
}

const CARDINAL_POINTS = [
  { short: 'N', long: 'Norte' },
  { short: 'NE', long: 'Noreste' },
  { short: 'E', long: 'Este' },
  { short: 'SE', long: 'Sureste' },
  { short: 'S', long: 'Sur' },
  { short: 'SO', long: 'Suroeste' },
  { short: 'O', long: 'Oeste' },
  { short: 'NO', long: 'Noroeste' },
] as const

export type CardinalPoint = (typeof CARDINAL_POINTS)[number]

/** Translates a heading in degrees to one of 8 compass points; each covers 45 degrees. */
export function headingToCardinal(degrees: number | null): CardinalPoint | null {
  if (degrees === null || !Number.isFinite(degrees)) return null
  const normalized = ((degrees % 360) + 360) % 360
  return CARDINAL_POINTS[Math.round(normalized / 45) % CARDINAL_POINTS.length]
}

const speedFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

export function formatSpeed(kmh: number | null): string {
  return kmh === null ? 'Sin dato' : `${speedFormat.format(kmh)} km/h`
}

// Month as text ("7 nov 2026") so the date cannot be read as 11 July.
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Sin dato'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Sin dato' : dateTimeFormat.format(date)
}

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "hace 5 minutos", "ayer"… Useful to see at a glance how fresh a position is. */
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Sin dato'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Sin dato'

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return 'hace un momento'
}
