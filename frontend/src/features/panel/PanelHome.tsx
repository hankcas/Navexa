import { useLocation } from 'react-router-dom'

import type { PanelLocationState } from '../auth/ChangePasswordPage'
import { roleLabel } from '../auth/roles'
import { useSession } from '../auth/session'
import styles from './PanelHome.module.css'

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
      <section className={styles.welcome}>
        <h1 className={styles.title}>Hola, {firstName}</h1>
        <p className={styles.text}>
          Entraste como <strong>{roleLabel(user.role)}</strong>. Aquí verás el mapa, los vehículos y los
          indicadores de tu flota.
        </p>
      </section>
    </>
  )
}
