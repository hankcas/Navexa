import { useLocation } from 'react-router-dom'

import type { PanelLocationState } from '../auth/ChangePasswordPage'
import { roleLabel } from '../auth/roles'
import { useSession } from '../auth/session'
import { DashboardOverview } from '../dashboard/DashboardOverview'
import styles from './PanelHome.module.css'

/** Panel home: greeting and the fleet dashboard (RF-23). */
export function PanelHome() {
  const { data: user } = useSession()
  const location = useLocation()
  const passwordChanged = (location.state as PanelLocationState | null)?.passwordChanged

  if (!user) return null
  const firstName = user.full_name.split(' ')[0]

  return (
    <>
      <title>Panel · Navexa</title>
      <div role="status">
        {passwordChanged && <p className={styles.success}>Tu contraseña se cambió correctamente.</p>}
      </div>
      <header className={styles.welcome}>
        <h1 className={styles.title}>Hola, {firstName}</h1>
        <p className={styles.text}>
          Entraste como <strong>{roleLabel(user.role)}</strong>. Este es el estado de tu flota.
        </p>
      </header>
      <DashboardOverview />
    </>
  )
}
