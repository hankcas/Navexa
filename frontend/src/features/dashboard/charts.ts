export interface Segment {
  key: string
  label: string
  value: number
  /** CSS custom property with the color, e.g. "var(--status-moving)". */
  color: string
}

export interface ArcSegment extends Segment {
  /** Length of the arc along the circle. */
  length: number
  /** Where the arc starts, as a negative dash offset. */
  offset: number
  percent: number
}

/**
 * Turns values into arcs of a donut drawn with one SVG circle per segment: each circle shows
 * a dash of `length` starting at `offset`, so the dashes follow each other around the ring.
 */
export function donutArcs(segments: Segment[], circumference: number): ArcSegment[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let start = 0
  return segments.map((segment) => {
    const fraction = total === 0 ? 0 : segment.value / total
    const arc = {
      ...segment,
      length: fraction * circumference,
      offset: -start,
      percent: Math.round(fraction * 100),
    }
    start += arc.length
    return arc
  })
}

export function percentOf(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100)
}
