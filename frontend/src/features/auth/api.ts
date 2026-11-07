import { apiRequest } from '../../shared/api/client'
import type { ChangePasswordInput, CurrentUser, LoginInput } from './types'

/** Calls to /api/v1/auth. The session lives in HttpOnly cookies the browser sends by itself. */
export const authApi = {
  // A wrong password must show its own message, not trigger a session refresh.
  // Logging in twice after a cold start is harmless, so it can be replayed.
  login: (input: LoginInput) =>
    apiRequest<CurrentUser>('/auth/login', {
      method: 'POST',
      body: input,
      skipSessionRefresh: true,
      retryAfterWakeUp: true,
    }),

  me: () => apiRequest<CurrentUser>('/auth/me'),

  changePassword: (input: ChangePasswordInput) =>
    apiRequest<CurrentUser>('/auth/change-password', { method: 'POST', body: input }),

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
}
