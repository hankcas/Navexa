import { Link } from 'react-router-dom'

import styles from './Dashboard.module.css'

interface KpiCardProps {
  label: string
  value: number
  detail?: string
  /** Color of the side mark, e.g. "var(--status-moving)". */
  accent?: string
  /** Where to see the items behind the number. */
  to?: string
}

export function KpiCard({ label, value, detail, accent = 'var(--color-primary)', to }: KpiCardProps) {
  const content = (
    <>
      <span className={styles.kpiMark} style={{ background: accent }} aria-hidden="true" />
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {detail && <span className={styles.kpiDetail}>{detail}</span>}
    </>
  )

  return to ? (
    <Link to={to} className={`${styles.kpi} ${styles.kpiLink}`}>
      {content}
    </Link>
  ) : (
    <div className={styles.kpi}>{content}</div>
  )
}
