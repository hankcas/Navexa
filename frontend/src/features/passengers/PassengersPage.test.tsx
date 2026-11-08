import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { setSessionHint } from '../auth/sessionHint'
import type { Passenger } from '../people/types'
import { PassengersPage } from './PassengersPage'

const LAURA: Passenger = {
  id: '1-12',
  name: 'Laura Ríos',
  code: 'P-12',
  custom_fields: { documento: '1020', ruta: 'Norte' },
  vehicle_id: null,
  bound_at: null,
}

const LIST = '/api/v1/passengers?page=1&page_size=20'
const VEHICLES = '/api/v1/vehicles?page=1&page_size=100'

function page<T>(items: T[]) {
  return json(200, { items, total: items.length, page: 1, page_size: 20, pages: 1 })
}

const ME = json(200, {
  id: 9,
  email: 'u@navexa.co',
  full_name: 'Usuario',
  role: 'operator',
  permissions: ['passengers:read', 'passengers:write', 'vehicles:read'],
  must_change_password: false,
})

beforeEach(() => {
  localStorage.clear()
  setSessionHint()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage(entry: string = PATHS.passengers) {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.passengers} element={<PassengersPage />} />
    </Routes>,
    entry,
  )
}

describe('PassengersPage', () => {
  it('has no phone column and explains why in the form', async () => {
    stubFetch({ '/api/v1/auth/me': [ME], [LIST]: [page([LAURA])], [VEHICLES]: [page([])] })
    renderPage()

    await screen.findByRole('rowheader', { name: 'Laura Ríos' })
    expect(screen.queryByRole('columnheader', { name: 'Teléfono' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo pasajero' }))
    expect(screen.getByText(/no guarda teléfono para los pasajeros/)).toBeInTheDocument()
  })

  it('edits custom fields keeping the ones not touched and removing the deleted one', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [ME],
      [LIST]: [page([LAURA])],
      [VEHICLES]: [page([])],
      'PATCH /api/v1/passengers/1-12': [json(200, { ...LAURA, custom_fields: { documento: '1020' } })],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Editar a Laura Ríos' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar a Laura Ríos' })
    expect(within(dialog).getByLabelText('Valor del campo 2')).toHaveValue('Norte')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar campo 2' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Se guardaron los cambios de Laura Ríos.')).toBeInTheDocument()
    expect(http.requestsTo('PATCH', '/api/v1/passengers/1-12')[0].body).toEqual({
      name: 'Laura Ríos',
      code: 'P-12',
      custom_fields: { documento: '1020' },
    })
  })

  it('filters by assignment on the server', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [ME],
      [LIST]: [page([LAURA])],
      [`${LIST}&assigned=false`]: [page([LAURA])],
      [VEHICLES]: [page([])],
    })
    renderPage()
    await screen.findByRole('rowheader', { name: 'Laura Ríos' })

    await userEvent.click(screen.getByRole('button', { name: 'Sin vehículo' }))

    expect(await screen.findByRole('button', { name: 'Sin vehículo' })).toHaveAttribute('aria-pressed', 'true')
    expect(http.callsTo(`${LIST}&assigned=false`)).toBeGreaterThan(0)
  })
})
