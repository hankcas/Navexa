import { describe, expect, it } from 'vitest'

import { dateToLocalInput, historyFormSchema, localInputToDate, presetRange } from './range'

const NOW = new Date('2026-11-08T17:00:00Z') // 12:00 in Bogotá
const schema = historyFormSchema(() => NOW)

function errorsOf(values: { vehicleId: string; from: string; to: string }) {
  const result = schema.safeParse(values)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]))
}

describe('Colombia time in the date inputs', () => {
  it('reads an input value as Bogotá time (UTC-5, all year)', () => {
    expect(localInputToDate('2026-11-08T07:00')?.toISOString()).toBe('2026-11-08T12:00:00.000Z')
    expect(localInputToDate('2026-07-01T23:30')?.toISOString()).toBe('2026-07-02T04:30:00.000Z')
  })

  it('writes a moment as the Bogotá value the input expects', () => {
    expect(dateToLocalInput(new Date('2026-11-08T12:00:00Z'))).toBe('2026-11-08T07:00')
  })

  it('rejects anything that is not a full date and time', () => {
    expect(localInputToDate('')).toBeNull()
    expect(localInputToDate('2026-11-08')).toBeNull()
    expect(localInputToDate('ayer')).toBeNull()
  })

  it('builds the quick ranges back from now', () => {
    expect(presetRange(24, NOW)).toEqual({ from: '2026-11-07T12:00', to: '2026-11-08T12:00' })
  })
})

describe('history form rules', () => {
  it('accepts a vehicle and a valid range', () => {
    expect(errorsOf({ vehicleId: '500', from: '2026-11-08T08:00', to: '2026-11-08T11:00' })).toEqual({})
  })

  it('asks for a vehicle and both dates', () => {
    expect(errorsOf({ vehicleId: '', from: '', to: '' })).toEqual({
      vehicleId: 'Elige un vehículo.',
      from: 'Elige la fecha y hora inicial.',
      to: 'Elige la fecha y hora final.',
    })
  })

  it('needs the end after the start', () => {
    expect(errorsOf({ vehicleId: '500', from: '2026-11-08T10:00', to: '2026-11-08T10:00' })).toEqual({
      to: 'Debe ser posterior a la fecha inicial.',
    })
  })

  it('allows 7 days and no more', () => {
    expect(errorsOf({ vehicleId: '500', from: '2026-11-01T12:00', to: '2026-11-08T12:00' })).toEqual({})
    expect(errorsOf({ vehicleId: '500', from: '2026-11-01T11:59', to: '2026-11-08T12:00' })).toEqual({
      to: 'El rango máximo es de 7 días.',
    })
  })

  it('does not start in the future', () => {
    expect(errorsOf({ vehicleId: '500', from: '2026-11-08T12:00', to: '2026-11-08T13:00' })).toEqual({
      from: 'No puede estar en el futuro.',
    })
  })
})
