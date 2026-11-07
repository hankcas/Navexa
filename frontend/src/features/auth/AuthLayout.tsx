import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { Logo } from '../../shared/ui/Logo'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}

/** Two-column layout shared by the login and change password pages. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <Link to={PATHS.home} className={styles.brandLink} aria-label="Navexa, volver al inicio">
          <Logo tone="dark" />
        </Link>
        <div className={styles.brandDetails}>
          <p className={styles.tagline}>Tu flota, en tiempo real y bajo control.</p>
          <ul className={styles.legend} aria-label="Estados de los vehículos">
            <li>
              <span className={`${styles.dot} ${styles.moving}`} aria-hidden="true" />
              En movimiento
            </li>
            <li>
              <span className={`${styles.dot} ${styles.stopped}`} aria-hidden="true" />
              Detenido
            </li>
            <li>
              <span className={`${styles.dot} ${styles.offline}`} aria-hidden="true" />
              Sin señal
            </li>
          </ul>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
