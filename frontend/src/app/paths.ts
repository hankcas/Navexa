/** Every route of the app in one place, so links and redirects cannot drift apart. */
export const PATHS = {
  home: '/',
  login: '/login',
  changePassword: '/cambiar-contrasena',
  panel: '/panel',
  vehicles: '/panel/vehiculos',
  drivers: '/panel/conductores',
  passengers: '/panel/pasajeros',
  users: '/panel/usuarios',
} as const
