/** Every route of the app in one place, so links and redirects cannot drift apart. */
export const PATHS = {
  home: '/',
  login: '/login',
  changePassword: '/cambiar-contrasena',
  panel: '/panel',
  vehicles: '/panel/vehiculos',
  vehicleDetail: '/panel/vehiculos/:vehicleId',
  drivers: '/panel/conductores',
  passengers: '/panel/pasajeros',
  users: '/panel/usuarios',
} as const

/** Link to one vehicle's page, e.g. /panel/vehiculos/30498948. */
export function vehiclePath(vehicleId: number): string {
  return PATHS.vehicleDetail.replace(':vehicleId', String(vehicleId))
}
