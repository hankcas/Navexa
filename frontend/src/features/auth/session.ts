import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { ApiError } from '../../shared/api/errors'
import { authApi } from './api'
import { clearSessionHint, hasSessionHint, setSessionHint } from './sessionHint'
import type { CurrentUser } from './types'

export const SESSION_QUERY_KEY = ['auth', 'session'] as const

/** The logged-in user, or null when there is no session. */
export async function loadSession(): Promise<CurrentUser | null> {
  if (!hasSessionHint()) return null
  try {
    return await authApi.me()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSessionHint()
      return null
    }
    throw error
  }
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: loadSession,
    staleTime: 5 * 60_000,
  })
}

/** Called by the API client when the session cannot be renewed. */
export function endSession(queryClient: QueryClient): void {
  clearSessionHint()
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })
  queryClient.setQueryData(SESSION_QUERY_KEY, null)
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      setSessionHint()
      queryClient.setQueryData(SESSION_QUERY_KEY, user)
    },
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (user) => queryClient.setQueryData(SESSION_QUERY_KEY, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch (error) {
        // A 401 means the session had already ended, which is what we wanted.
        if (!(error instanceof ApiError && error.status === 401)) throw error
      }
    },
    onSuccess: () => endSession(queryClient),
  })
}
