import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from './guards'
import { PERMISSIONS } from './permissions'
import { hasSessionHint, setSessionHint } from './sessionHint'
import type { CurrentUser } from './types'

const admin: CurrentUser = {
  id: 1,
  email: 'admin@navexa.co',
  full_name: 'Ana Admin',
  role: 'admin',
  permissions: ['users:manage', 'vehicles:read'],
  must_change_password: false,
}

const unauthorized = json(401, { title: 'No autenticado', detail: 'La sesión expiró.' })

/** Same route shape as App.tsx, with plain text instead of the real pages. */
function renderRoutes(initialEntry: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route path={PATHS.login} element={<p>Página de login</p>} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path={PATHS.changePassword} element={<p>Página de cambio de contraseña</p>} />
        <Route path={PATHS.panel} element={<p>Página del panel</p>} />
        <Route path="/panel/usuarios" element={<p>Página de usuarios</p>} />
      </Route>
    </Routes>,
    initialEntry,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequireAuth', () => {
  it('sends a visitor who never logged in to the login without calling the backend', async () => {
    const http = stubFetch({})

    renderRoutes(PATHS.panel)

    expect(await screen.findByText('Página de login')).toBeInTheDocument()
    expect(http.callsTo('/api/v1/auth/me')).toBe(0)
  })

  it('shows the private page to a logged-in user', async () => {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [json(200, admin)] })

    renderRoutes(PATHS.panel)

    expect(await screen.findByText('Página del panel')).toBeInTheDocument()
  })

  it('forces a user with a temporary password to change it first', async () => {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [json(200, { ...admin, must_change_password: true })] })

    renderRoutes(PATHS.panel)

    expect(await screen.findByText('Página de cambio de contraseña')).toBeInTheDocument()
  })

  it('logs out when the session cannot be renewed', async () => {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [unauthorized], '/api/v1/auth/refresh': [unauthorized] })

    renderRoutes(PATHS.panel)

    expect(await screen.findByText('Página de login')).toBeInTheDocument()
    expect(hasSessionHint()).toBe(false)
  })

  it('offers a retry when the session cannot be checked', async () => {
    setSessionHint()
    stubFetch({
      '/api/v1/auth/me': [json(500, { title: 'Error interno', detail: 'Ocurrió un error inesperado.' })],
    })

    renderRoutes(PATHS.panel)

    expect(await screen.findByText('No pudimos verificar tu sesión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('RedirectIfAuthenticated', () => {
  it('returns a logged-in user to the page they were trying to open', async () => {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [json(200, admin)] })

    renderRoutes({ pathname: PATHS.login, state: { from: '/panel/usuarios' } })

    expect(await screen.findByText('Página de usuarios')).toBeInTheDocument()
  })

  it('ignores a redirect to another site', async () => {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [json(200, admin)] })

    renderRoutes({ pathname: PATHS.login, state: { from: '//sitio-malicioso.com' } })

    expect(await screen.findByText('Página del panel')).toBeInTheDocument()
  })
})

describe('RequirePermission', () => {
  function renderModule(permissions: string[]) {
    setSessionHint()
    stubFetch({ '/api/v1/auth/me': [json(200, { ...admin, role: 'viewer', permissions })] })
    return renderWithProviders(
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<RequirePermission permission={PERMISSIONS.usersManage} />}>
            <Route path="/panel/usuarios" element={<p>Página de usuarios</p>} />
          </Route>
        </Route>
      </Routes>,
      '/panel/usuarios',
    )
  }

  it('shows the module when the role has the permission', async () => {
    renderModule(['users:manage'])
    expect(await screen.findByText('Página de usuarios')).toBeInTheDocument()
  })

  it('shows "no access" when the role lacks the permission', async () => {
    renderModule(['vehicles:read'])
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
    expect(screen.queryByText('Página de usuarios')).not.toBeInTheDocument()
  })
})
