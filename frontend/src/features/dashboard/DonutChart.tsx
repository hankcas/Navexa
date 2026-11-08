import { useId } from 'react'

import { donutArcs, type Segment } from './charts'
import styles from './Dashboard.module.css'

const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface DonutChartProps {
  title: string
  segments: Segment[]
  centerLabel: string
}

/**
 * Donut chart in plain SVG. The legend lists every value with its number and percentage,
 * so the chart is never the only way to read the data (screen readers and color blindness).
 */
export function DonutChart({ title, segments, centerLabel }: DonutChartProps) {
  const titleId = useId()
  const arcs = donutArcs(segments, CIRCUMFERENCE)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <figure className={styles.chart} aria-labelledby={titleId}>
      <figcaption id={titleId} className={styles.chartTitle}>
        {title}
      </figcaption>
      <div className={styles.donutLayout}>
        <svg className={styles.donut} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
          <circle className={styles.track} cx="80" cy="80" r={RADIUS} />
          {arcs
            .filter((arc) => arc.length > 0)
            .map((arc) => (
              <circle
                key={arc.key}
                className={styles.arc}
                cx="80"
                cy="80"
                r={RADIUS}
                style={{ stroke: arc.color }}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={arc.offset}
                transform="rotate(-90 80 80)"
              />
            ))}
          <text className={styles.donutValue} x="80" y="78" textAnchor="middle">
            {total}
          </text>
          <text className={styles.donutLabel} x="80" y="98" textAnchor="middle">
            {centerLabel}
          </text>
        </svg>
        <ul className={styles.legend}>
          {arcs.map((arc) => (
            <li key={arc.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: arc.color }} aria-hidden="true" />
              <span className={styles.legendLabel}>{arc.label}</span>
              <span className={styles.legendValue}>
                {arc.value} <span className={styles.legendPercent}>({arc.percent} %)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
