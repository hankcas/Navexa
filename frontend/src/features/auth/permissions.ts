import type { CurrentUser } from './types'

/** Mirrors PermissionCode in backend/app/domain/permissions.py. */
export const PERMISSIONS = {
  vehiclesRead: 'vehicles:read',
  vehiclesWrite: 'vehicles:write',
  driversRead: 'drivers:read',
  driversWrite: 'drivers:write',
  passengersRead: 'passengers:read',
  passengersWrite: 'passengers:write',
  historyRead: 'history:read',
  dataExport: 'data:export',
  usersManage: 'users:manage',
  auditRead: 'audit:read',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * The UI asks "can this user do X?", never "is this user an admin?", so a new role only needs
 * new permissions in the backend. The backend enforces the same permissions on every endpoint.
 */
export function hasPermission(user: CurrentUser | null | undefined, permission: Permission): boolean {
  return user?.permissions.includes(permission) ?? false
}
