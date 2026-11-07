import type { ReactNode } from 'react'

import styles from './FullPageState.module.css'
import { Spinner } from './Spinner'

interface FullPageStateProps {
  title: string
  detail?: string
  loading?: boolean
  action?: ReactNode
}

/** Whole-screen loading, error or empty state, so no view is ever left blank. */
export function FullPageState({ title, detail, loading = false, action }: FullPageStateProps) {
  return (
    <main className={styles.page}>
      <div className={styles.box} role={loading ? 'status' : undefined}>
        {loading && <Spinner />}
        <h1 className={styles.title}>{title}</h1>
        {detail && <p className={styles.detail}>{detail}</p>}
        {action}
      </div>
    </main>
  )
}
