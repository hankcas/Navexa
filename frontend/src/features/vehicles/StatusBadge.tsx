import { STATUS_LABELS } from './format'
import styles from './StatusBadge.module.css'
import type { VehicleStatus } from './types'

/** The color is a visual aid only; the text always says the status, for color-blind users too. */
export function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}
