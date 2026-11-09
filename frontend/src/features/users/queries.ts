import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usersApi } from './api'
import type { UserFilters, UserUpdateInput } from './types'

const USERS_KEY = ['users'] as const

export function useUsersPage(filters: UserFilters) {
  return useQuery({
    queryKey: [...USERS_KEY, 'list', filters],
    queryFn: () => usersApi.list(filters),
    placeholderData: keepPreviousData,
  })
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: usersApi.roles, staleTime: Infinity })
}

/** After any change the user list is fetched again, so badges and counts stay right. */
export function useUserMutations() {
  const queryClient = useQueryClient()
  const options = { onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }) }
  return {
    create: useMutation({ mutationFn: usersApi.create, ...options }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: number; input: UserUpdateInput }) => usersApi.update(id, input),
      ...options,
    }),
    resetPassword: useMutation({ mutationFn: usersApi.resetPassword, ...options }),
  }
}
