import { Link, NavLink, Outlet } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { Button } from '../../shared/ui/Button'
import { FormAlert } from '../../shared/ui/FormAlert'
import { Logo } from '../../shared/ui/Logo'
import { hasPermission } from '../auth/permissions'
import { roleLabel } from '../auth/roles'
import { useLogout, useSession } from '../auth/session'
import { NAV_ITEMS } from './navigation'
import styles from './PanelLayout.module.css'

/** Frame of the private area. The menu shows only the modules the user's permissions allow. */
export function PanelLayout() {
  const { data: user } = useSession()
  const logout = useLogout()

  if (!user) return null

  return (
    <div className={styles.layout}>
      <a href="#contenido" className={styles.skipLink}>
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <Link to={PATHS.panel} className={styles.logoLink} aria-label="Navexa, ir al panel">
          <Logo />
        </Link>
        <nav aria-label="Principal" className={styles.nav}>
          {NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission)).map(
            (item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={styles.navLink}>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className={styles.account}>
          <p className={styles.user}>
            <span className={styles.userName}>{user.full_name}</span>
            <span className={styles.userRole}>{roleLabel(user.role)}</span>
          </p>
          <Link to={PATHS.changePassword} className={styles.accountLink}>
            Cambiar contraseña
          </Link>
          <Button
            variant="secondary"
            loading={logout.isPending}
            loadingText="Cerrando…"
            onClick={() => logout.mutate()}
          >
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main id="contenido" className={styles.main}>
        <FormAlert error={logout.error} title="No pudimos cerrar la sesión" />
        <Outlet />
      </main>
    </div>
  )
}
