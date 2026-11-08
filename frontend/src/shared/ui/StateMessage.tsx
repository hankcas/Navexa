import type { ReactNode } from 'react'

import { Spinner } from './Spinner'
import styles from './StateMessage.module.css'

export interface StateMessageProps {
  title: string
  detail?: ReactNode
  loading?: boolean
  action?: ReactNode
  /** Heading level, so the message fits the outline of the page that contains it. */
  headingLevel?: 1 | 2
}

/** Loading, error, empty or "no access" message. Every view with data uses it (ARQ-12). */
export function StateMessage({ title, detail, loading = false, action, headingLevel = 2 }: StateMessageProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className={styles.box} role={loading ? 'status' : undefined}>
      {loading && <Spinner />}
      <Heading className={styles.title}>{title}</Heading>
      {detail && <p className={styles.detail}>{detail}</p>}
      {action}
    </div>
  )
}
