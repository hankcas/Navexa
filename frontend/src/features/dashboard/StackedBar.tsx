import { useId } from 'react'

import { percentOf, type Segment } from './charts'
import styles from './Dashboard.module.css'

interface StackedBarProps {
  title: string
  segments: Segment[]
  description?: string
}

/** Horizontal 100 % bar, e.g. vehicles with and without a driver. Same accessible legend as the donut. */
export function StackedBar({ title, segments, description }: StackedBarProps) {
  const titleId = useId()
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <figure className={styles.chart} aria-labelledby={titleId}>
      <figcaption id={titleId} className={styles.chartTitle}>
        {title}
      </figcaption>
      {description && <p className={styles.chartDescription}>{description}</p>}
      <div className={styles.bar} aria-hidden="true">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.key}
              className={styles.barSegment}
              style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
            />
          ))}
      </div>
      <ul className={styles.legend}>
        {segments.map((segment) => (
          <li key={segment.key} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: segment.color }} aria-hidden="true" />
            <span className={styles.legendLabel}>{segment.label}</span>
            <span className={styles.legendValue}>
              {segment.value}{' '}
              <span className={styles.legendPercent}>({percentOf(segment.value, total)} %)</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
