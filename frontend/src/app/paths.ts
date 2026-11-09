/** Every route of the app in one place, so links and redirects cannot drift apart. */
export const PATHS = {
  home: '/',
  login: '/login',
  changePassword: '/cambiar-contrasena',
  panel: '/panel',
  vehicles: '/panel/vehiculos',
  vehicleDetail: '/panel/vehiculos/:vehicleId',
  history: '/panel/historial',
  drivers: '/panel/conductores',
  passengers: '/panel/pasajeros',
  users: '/panel/usuarios',
  audit: '/panel/auditoria',
} as const

/** Link to one vehicle's page, e.g. /panel/vehiculos/30498948. */
export function vehiclePath(vehicleId: number): string {
  return PATHS.vehicleDetail.replace(':vehicleId', String(vehicleId))
}

/** Route history of one vehicle; the page fills in the last 24 hours. */
export function historyPath(vehicleId: number): string {
  return `${PATHS.history}?${new URLSearchParams({ vehiculo: String(vehicleId) })}`
}
