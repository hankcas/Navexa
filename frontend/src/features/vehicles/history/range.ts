import { z } from 'zod'

/** Same limit as TRACK_MAX_DAYS in the backend; the backend checks it again anyway. */
export const MAX_RANGE_DAYS = 7

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
// Colombia is UTC-5 all year (no daylight saving time), so a fixed offset is exact.
const BOGOTA_OFFSET = '-05:00'
const BOGOTA_OFFSET_MS = -5 * HOUR_MS
const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/**
 * `<input type="datetime-local">` gives "2026-11-08T07:00" with no time zone. Every date in
 * the app is Colombia time, so that is how it is read: 07:00 in Bogotá is 12:00 UTC.
 */
export function localInputToDate(value: string): Date | null {
  if (!LOCAL_INPUT.test(value)) return null
  const date = new Date(`${value}:00${BOGOTA_OFFSET}`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The other way: a moment as "2026-11-08T07:00" in Colombia time, for the inputs. */
export function dateToLocalInput(date: Date): string {
  return new Date(date.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 16)
}

export interface RangePreset {
  label: string
  hours: number
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  { label: 'Última hora', hours: 1 },
  { label: 'Últimas 24 horas', hours: 24 },
  { label: 'Últimos 7 días', hours: MAX_RANGE_DAYS * 24 },
]

/** From `hours` ago until now, as input values. */
export function presetRange(hours: number, now: Date = new Date()): { from: string; to: string } {
  return {
    from: dateToLocalInput(new Date(now.getTime() - hours * HOUR_MS)),
    to: dateToLocalInput(now),
  }
}

/** Same rules as backend/app/services/track_service.py, checked here first to answer at once. */
export function historyFormSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      vehicleId: z.string().min(1, 'Elige un vehículo.'),
      from: z.string().refine((value) => localInputToDate(value) !== null, 'Elige la fecha y hora inicial.'),
      to: z.string().refine((value) => localInputToDate(value) !== null, 'Elige la fecha y hora final.'),
    })
    .superRefine(({ from, to }, context) => {
      const start = localInputToDate(from)
      const end = localInputToDate(to)
      if (!start || !end) return
      if (start.getTime() >= now().getTime()) {
        context.addIssue({ code: 'custom', path: ['from'], message: 'No puede estar en el futuro.' })
      }
      if (end.getTime() <= start.getTime()) {
        context.addIssue({ code: 'custom', path: ['to'], message: 'Debe ser posterior a la fecha inicial.' })
      } else if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
        context.addIssue({
          code: 'custom',
          path: ['to'],
          message: `El rango máximo es de ${MAX_RANGE_DAYS} días.`,
        })
      }
    })
}

export type HistoryFormValues = z.infer<ReturnType<typeof historyFormSchema>>
