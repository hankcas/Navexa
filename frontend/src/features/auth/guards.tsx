import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { ApiError } from '../../shared/api/errors'
import { Button } from '../../shared/ui/Button'
import { FullPageState } from '../../shared/ui/FullPageState'
import { useSession } from './session'

interface LoginRedirectState {
  from?: string
}

/** Only internal paths, so a crafted link cannot send the user to another site after login. */
function safeRedirect(path: string | undefined): string | undefined {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : undefined
}

/**
 * Route guard for private pages. The backend checks permissions on every request anyway;
 * this only avoids showing pages the user cannot use.
 */
export function RequireAuth() {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) return <FullPageState loading title="Verificando tu sesión…" />

  if (session.isError) {
    return (
      <FullPageState
        title="No pudimos verificar tu sesión"
        detail={session.error instanceof ApiError ? session.error.detail : undefined}
        action={<Button onClick={() => void session.refetch()}>Reintentar</Button>}
      />
    )
  }

  if (!session.data) {
    const state: LoginRedirectState = { from: location.pathname + location.search }
    return <Navigate to={PATHS.login} replace state={state} />
  }

  // A temporary password must be replaced before anything else (RF-06).
  if (session.data.must_change_password && location.pathname !== PATHS.changePassword) {
    return <Navigate to={PATHS.changePassword} replace />
  }

  return <Outlet />
}

/** Wraps the login page: a logged-in user goes back to where they were heading. */
export function RedirectIfAuthenticated() {
  const session = useSession()
  const location = useLocation()

  if (session.data) {
    const from = safeRedirect((location.state as LoginRedirectState | null)?.from)
    const target = session.data.must_change_password ? PATHS.changePassword : (from ?? PATHS.panel)
    return <Navigate to={target} replace />
  }

  return <Outlet />
}
