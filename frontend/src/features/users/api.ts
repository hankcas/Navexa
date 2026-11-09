import { apiRequest } from '../../shared/api/client'
import type { Page } from '../../shared/api/types'
import type {
  ManagedUser,
  Role,
  UserCreateInput,
  UserFilters,
  UserUpdateInput,
  UserWithTemporaryPassword,
} from './types'

export function usersPath({ search, page, pageSize }: UserFilters): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  const term = search.trim()
  if (term) params.set('search', term)
  return `/users?${params}`
}

/** /api/v1/users and /roles. Every call needs users:manage, which only the admin has. */
export const usersApi = {
  list: (filters: UserFilters) => apiRequest<Page<ManagedUser>>(usersPath(filters)),
  roles: () => apiRequest<Role[]>('/roles'),
  create: (input: UserCreateInput) =>
    apiRequest<UserWithTemporaryPassword>('/users', { method: 'POST', body: input }),
  update: (id: number, input: UserUpdateInput) =>
    apiRequest<ManagedUser>(`/users/${id}`, { method: 'PATCH', body: input }),
  resetPassword: (id: number) =>
    apiRequest<UserWithTemporaryPassword>(`/users/${id}/reset-password`, { method: 'POST' }),
}
