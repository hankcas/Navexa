import { PATHS } from '../../app/paths'
import { ButtonLink } from '../../shared/ui/Button'
import { Logo } from '../../shared/ui/Logo'
import { useSession } from '../auth/session'
import styles from './LandingPage.module.css'

/** Temporary landing: the full page (RF-01, RF-02) replaces this content. */
export function LandingPage() {
  const { data: user } = useSession()

  return (
    <main className={styles.page}>
      <Logo />
      <h1 className={styles.title}>Monitorea tu flota en tiempo real</h1>
      <p className={styles.text}>
        Ubicación de cada vehículo, conductores, pasajeros e historial de recorridos en un solo lugar.
      </p>
      {user ? (
        <ButtonLink to={PATHS.panel}>Ir al panel</ButtonLink>
      ) : (
        <ButtonLink to={PATHS.login}>Iniciar sesión</ButtonLink>
      )}
    </main>
  )
}
