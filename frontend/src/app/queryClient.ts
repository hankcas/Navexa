import { QueryClient } from '@tanstack/react-query'

import { endSession } from '../features/auth/session'
import { onSessionExpired } from '../shared/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    // The API client already waits for cold starts and renews the session, so React Query
    // must not retry on top of it.
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

// When the session cannot be renewed, forget the user so the guards send them to the login.
onSessionExpired(() => endSession(queryClient))
