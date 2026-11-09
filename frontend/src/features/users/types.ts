/** Mirrors backend/app/schemas/user.py. */
export type RoleName = 'admin' | 'operator' | 'viewer'

export interface ManagedUser {
  id: number
  email: string
  full_name: string
  role: RoleName
  is_active: boolean
  /** Created by an admin or reset: must change the password on the next login (RF-06). */
  must_change_password: boolean
  /** Too many failed logins: blocked for 15 minutes. */
  is_locked: boolean
  /** ISO-8601 in UTC. */
  created_at: string
}

export interface UserWithTemporaryPassword {
  user: ManagedUser
  /** Shown once to the admin, never stored by the frontend. */
  temporary_password: string
}

export interface Role {
  name: RoleName
  permissions: string[]
}

export interface UserCreateInput {
  email: string
  full_name: string
  role: RoleName
}

export interface UserUpdateInput {
  full_name?: string
  role?: RoleName
  is_active?: boolean
}

export interface UserFilters {
  search: string
  page: number
  pageSize: number
}
