import { describe, expect, it } from 'vitest'

import { frameAt, speedBand, speedRuns } from './playback'
import type { TrackPoint } from './types'

function point(minute: number, latitude: number, speed: number, heading: number | null = 0): TrackPoint {
  return {
    time: new Date(Date.UTC(2026, 10, 8, 12, minute)).toISOString(),
    latitude,
    longitude: -74,
    speed_kmh: speed,
    heading,
  }
}

const ROUTE = [point(0, 4.0, 20, 0), point(10, 4.1, 40, 90), point(20, 4.1, 0, null)]
const TIMES = ROUTE.map((p) => new Date(p.time).getTime())
const minute = (m: number) => TIMES[0] + m * 60_000

describe('frameAt', () => {
  it('is exactly on a recorded point at its time', () => {
    expect(frameAt(ROUTE, TIMES, minute(10))).toMatchObject({ latitude: 4.1, speed_kmh: 40, heading: 90 })
  })

  it('moves in a straight line between two points, at the pace of their times', () => {
    const halfway = frameAt(ROUTE, TIMES, minute(5))
    expect(halfway.latitude).toBeCloseTo(4.05)
    expect(halfway.speed_kmh).toBeCloseTo(30)
    expect(halfway.heading).toBe(0)
    expect(halfway.moving).toBe(true)
  })

  it('stays at the ends outside the route', () => {
    expect(frameAt(ROUTE, TIMES, minute(-5))).toMatchObject({ latitude: 4.0, time: TIMES[0] })
    expect(frameAt(ROUTE, TIMES, minute(30))).toMatchObject({ latitude: 4.1, speed_kmh: 0, moving: false })
  })

  it('works with a single point', () => {
    expect(frameAt([ROUTE[0]], [TIMES[0]], minute(3))).toMatchObject({ latitude: 4.0, speed_kmh: 20 })
  })
})

describe('speed bands', () => {
  it('uses the same 5 km/h threshold as the vehicle status', () => {
    expect([0, 5, 5.1, 60, 61].map(speedBand)).toEqual(['stopped', 'stopped', 'normal', 'normal', 'fast'])
  })

  it('cuts the line where the band changes, with no gaps between pieces', () => {
    const route = [point(0, 4.0, 30), point(1, 4.1, 30), point(2, 4.2, 80), point(3, 4.3, 0), point(4, 4.4, 0)]
    expect(speedRuns(route)).toEqual([
      { band: 'normal', positions: [[4.0, -74], [4.1, -74], [4.2, -74]] },
      { band: 'fast', positions: [[4.2, -74], [4.3, -74]] },
      { band: 'stopped', positions: [[4.3, -74], [4.4, -74]] },
    ])
  })

  it('has nothing to draw with fewer than two points', () => {
    expect(speedRuns([ROUTE[0]])).toEqual([])
  })
})
