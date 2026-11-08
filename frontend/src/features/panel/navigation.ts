import { PATHS } from '../../app/paths'
import { PERMISSIONS, type Permission } from '../auth/permissions'

export interface NavItem {
  to: string
  label: string
  /** Hidden for users without this permission. No permission means everyone sees it. */
  permission?: Permission
  /** Active only on the exact path, not on its children. */
  end?: boolean
}

/** The panel menu. Each new module adds one line here with the permission it needs (UX-05). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: PATHS.panel, label: 'Inicio', end: true },
  { to: PATHS.vehicles, label: 'Vehículos', permission: PERMISSIONS.vehiclesRead },
  { to: PATHS.drivers, label: 'Conductores', permission: PERMISSIONS.driversRead },
  { to: PATHS.passengers, label: 'Pasajeros', permission: PERMISSIONS.passengersRead },
]
