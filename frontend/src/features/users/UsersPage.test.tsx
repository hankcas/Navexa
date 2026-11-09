import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { setSessionHint } from '../auth/sessionHint'
import type { ManagedUser } from './types'
import { UsersPage } from './UsersPage'

const ADMIN: ManagedUser = {
  id: 1,
  email: 'admin@navexa.co',
  full_name: 'Eyder Castro',
  role: 'admin',
  is_active: true,
  must_change_password: false,
  is_locked: false,
  created_at: '2026-11-06T15:00:00Z',
}
const OPERATOR: ManagedUser = {
  ...ADMIN,
  id: 2,
  email: 'ope@navexa.co',
  full_name: 'Olga Operadora',
  role: 'operator',
  must_change_password: true,
}

const LIST = '/api/v1/users?page=1&page_size=20'
const ROLES = json(200, [
  { name: 'admin', permissions: [] },
  { name: 'operator', permissions: [] },
  { name: 'viewer', permissions: [] },
])
const ME = json(200, {
  id: 1,
  email: 'admin@navexa.co',
  full_name: 'Eyder Castro',
  role: 'admin',
  permissions: ['users:manage'],
  must_change_password: false,
})

function page(items: ManagedUser[]) {
  return json(200, { items, total: items.length, page: 1, page_size: 20, pages: 1 })
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.users} element={<UsersPage />} />
    </Routes>,
    PATHS.users,
  )
}

beforeEach(() => {
  localStorage.clear()
  setSessionHint()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UsersPage', () => {
  it('lists users with role and status, and protects the admin from deactivating themself', async () => {
    stubFetch({ '/api/v1/auth/me': [ME], [LIST]: [page([ADMIN, OPERATOR])], '/api/v1/roles': [ROLES] })
    renderPage()

    const operator = (await screen.findByRole('rowheader', { name: 'Olga Operadora' })).closest('tr')!
    expect(within(operator).getByText('Operador')).toBeInTheDocument()
    expect(within(operator).getByText('Debe cambiar contraseña')).toBeInTheDocument()
    expect(within(operator).getByRole('button', { name: 'Desactivar a Olga Operadora' })).toBeInTheDocument()

    const self = screen.getByRole('rowheader', { name: /Eyder Castro/ }).closest('tr')!
    expect(within(self).getByText('(tú)')).toBeInTheDocument()
    expect(within(self).queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
  })

  it('creates a user and shows the temporary password once', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [ME],
      [LIST]: [page([ADMIN])],
      '/api/v1/roles': [ROLES],
      'POST /api/v1/users': [
        json(201, { user: { ...OPERATOR, id: 3 }, temporary_password: 'Tmp-9xQ!w2Lk7Pz' }),
      ],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const form = screen.getByRole('dialog', { name: 'Nuevo usuario' })
    await userEvent.type(within(form).getByLabelText('Correo electrónico'), 'ope@navexa.co')
    await userEvent.type(within(form).getByLabelText('Nombre completo'), 'Olga Operadora')
    await userEvent.selectOptions(within(form).getByLabelText('Rol'), 'Operador')
    await userEvent.click(within(form).getByRole('button', { name: 'Crear usuario' }))

    const result = await screen.findByRole('dialog', { name: 'Usuario creado' })
    expect(within(result).getByText('Tmp-9xQ!w2Lk7Pz')).toBeInTheDocument()
    expect(http.requestsTo('POST', '/api/v1/users')[0].body).toEqual({
      email: 'ope@navexa.co',
      full_name: 'Olga Operadora',
      role: 'operator',
    })

    await userEvent.click(within(result).getByRole('button', { name: 'Ya la guardé' }))
    expect(screen.queryByText('Tmp-9xQ!w2Lk7Pz')).not.toBeInTheDocument()
  })

  it('resets a password only after confirming', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [ME],
      [LIST]: [page([ADMIN, OPERATOR])],
      '/api/v1/roles': [ROLES],
      'POST /api/v1/users/2/reset-password': [
        json(200, { user: OPERATOR, temporary_password: 'Nueva-Tmp-123!' }),
      ],
    })
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Restablecer la contraseña de Olga Operadora' }),
    )
    expect(http.requestsTo('POST', '/api/v1/users/2/reset-password')).toHaveLength(0)

    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Restablecer contraseña' })).getByRole('button', {
        name: 'Restablecer',
      }),
    )

    expect(await screen.findByText('Nueva-Tmp-123!')).toBeInTheDocument()
  })

  it('cannot change its own role', async () => {
    stubFetch({ '/api/v1/auth/me': [ME], [LIST]: [page([ADMIN])], '/api/v1/roles': [ROLES] })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Editar a Eyder Castro' }))
    const form = screen.getByRole('dialog', { name: 'Editar a Eyder Castro' })
    expect(within(form).getByLabelText('Rol')).toBeDisabled()
    expect(within(form).getByText('No puedes cambiar tu propio rol.')).toBeInTheDocument()
  })
})
