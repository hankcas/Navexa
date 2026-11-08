import { describe, expect, it } from 'vitest'

import { donutArcs, percentOf } from './charts'

const CIRCUMFERENCE = 100

describe('donutArcs', () => {
  it('splits the ring in proportion and chains each arc after the previous one', () => {
    const arcs = donutArcs(
      [
        { key: 'a', label: 'A', value: 1, color: 'red' },
        { key: 'b', label: 'B', value: 3, color: 'blue' },
      ],
      CIRCUMFERENCE,
    )

    expect(arcs.map((arc) => [arc.length, arc.offset, arc.percent])).toEqual([
      [25, -0, 25],
      [75, -25, 75],
    ])
  })

  it('draws nothing and shows 0 % when every value is zero', () => {
    const arcs = donutArcs([{ key: 'a', label: 'A', value: 0, color: 'red' }], CIRCUMFERENCE)
    expect(arcs[0]).toMatchObject({ length: 0, percent: 0 })
  })
})

describe('percentOf', () => {
  it('rounds and never divides by zero', () => {
    expect(percentOf(9, 62)).toBe(15)
    expect(percentOf(3, 0)).toBe(0)
  })
})
