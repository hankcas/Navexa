import { describe, expect, it } from 'vitest'

import { formatDateTime, formatRelative, formatSpeed, headingToCardinal } from './format'

describe('headingToCardinal', () => {
  it.each([
    [0, 'N'],
    [22, 'N'],
    [23, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SO'],
    [270, 'O'],
    [315, 'NO'],
    [338, 'N'],
    [359, 'N'],
    [360, 'N'],
    [-90, 'O'],
  ])('maps %i degrees to %s', (degrees, expected) => {
    expect(headingToCardinal(degrees)?.short).toBe(expected)
  })

  it('returns null when there is no heading', () => {
    expect(headingToCardinal(null)).toBeNull()
  })
})

describe('formatSpeed', () => {
  it('rounds to whole km/h', () => {
    expect(formatSpeed(42.6)).toBe('43 km/h')
  })

  it('handles a missing value without breaking', () => {
    expect(formatSpeed(null)).toBe('Sin dato')
  })
})

describe('formatDateTime', () => {
  it('shows UTC instants in Bogota time (UTC-5)', () => {
    // 2026-11-07 15:30 UTC is 10:30 a. m. in Bogota.
    const formatted = formatDateTime('2026-11-07T15:30:00Z')
    expect(formatted).toMatch(/\b7\b.*nov.*2026/)
    expect(formatted).toMatch(/10:30/)
    expect(formatted).not.toMatch(/15:30/)
  })

  it('handles missing or invalid dates', () => {
    expect(formatDateTime(null)).toBe('Sin dato')
    expect(formatDateTime('no es fecha')).toBe('Sin dato')
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-11-07T15:30:00Z')

  it.each([
    ['2026-11-07T15:29:40Z', 'hace un momento'],
    ['2026-11-07T15:25:00Z', 'hace 5 minutos'],
    ['2026-11-07T12:30:00Z', 'hace 3 horas'],
    ['2026-11-06T15:30:00Z', 'ayer'],
  ])('describes %s as "%s"', (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected)
  })

  it('handles a missing value', () => {
    expect(formatRelative(null, now)).toBe('Sin dato')
  })
})
