import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { RedirectIfAuthenticated } from './guards'
import { LoginPage } from './LoginPage'
import { hasSessionHint } from './sessionHint'

const user = {
  id: 1,
  email: 'admin@navexa.co',
  full_name: 'Ana Admin',
  role: 'admin',
  permissions: ['users:manage'],
  must_change_password: false,
}

const healthy = json(200, { status: 'ok' })

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route path={PATHS.login} element={<LoginPage />} />
      </Route>
      <Route path={PATHS.panel} element={<p>Página del panel</p>} />
    </Routes>,
    PATHS.login,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage', () => {
  it('validates the form before calling the backend', async () => {
    const http = stubFetch({ '/api/health': [healthy] })
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Escribe tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
    expect(http.callsTo('/api/v1/auth/login')).toBe(0)
  })

  it('shows the backend message when the credentials are wrong', async () => {
    stubFetch({
      '/api/health': [healthy],
      '/api/v1/auth/login': [
        json(401, { title: 'No autenticado', detail: 'Correo o contraseña incorrectos.' }),
      ],
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@navexa.co')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'equivocada')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos iniciar sesión')
    expect(alert).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(hasSessionHint()).toBe(false)
  })

  it('opens the panel after a successful login', async () => {
    stubFetch({ '/api/health': [healthy], '/api/v1/auth/login': [json(200, user)] })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@navexa.co')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Correcta-2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Página del panel')).toBeInTheDocument()
    expect(hasSessionHint()).toBe(true)
  })

  it('lets the user show the password they typed', async () => {
    stubFetch({ '/api/health': [healthy] })
    renderLogin()

    const password = screen.getByLabelText('Contraseña')
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: /mostrar/i }))

    expect(password).toHaveAttribute('type', 'text')
  })
})
