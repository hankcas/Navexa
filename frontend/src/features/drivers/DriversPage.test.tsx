import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { setSessionHint } from '../auth/sessionHint'
import type { Driver } from '../people/types'
import { DriversPage } from './DriversPage'

const ANA: Driver = {
  id: '1-1',
  name: 'Ana Gómez',
  code: 'A-100',
  phone: '+573001234567',
  description: null,
  custom_fields: { cedula: '123' },
  vehicle_id: 500,
  bound_at: '2026-11-07T15:30:00Z',
}
const LUIS: Driver = { ...ANA, id: '1-2', name: 'Luis Pérez', code: null, phone: null, custom_fields: {}, vehicle_id: null }

const TRUCK = { id: 500, name: 'Camión 01', status: 'stopped', speed_kmh: 0, last_update: null, position: null, driver: null }
const VAN = { ...TRUCK, id: 600, name: 'Van 07' }

const LIST = '/api/v1/drivers?page=1&page_size=20'
const VEHICLES = '/api/v1/vehicles?page=1&page_size=100'

function page<T>(items: T[]) {
  return json(200, { items, total: items.length, page: 1, page_size: 20, pages: 1 })
}

function me(permissions: string[]) {
  return json(200, {
    id: 9,
    email: 'u@navexa.co',
    full_name: 'Usuario',
    role: 'operator',
    permissions,
    must_change_password: false,
  })
}

const OPERATOR = ['drivers:read', 'drivers:write', 'vehicles:read']
const VIEWER = ['drivers:read', 'vehicles:read']

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.drivers} element={<DriversPage />} />
    </Routes>,
    PATHS.drivers,
  )
}

beforeEach(() => {
  localStorage.clear()
  setSessionHint()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DriversPage', () => {
  it('lists drivers with the name of their vehicle', async () => {
    stubFetch({ '/api/v1/auth/me': [me(OPERATOR)], [LIST]: [page([ANA, LUIS])], [VEHICLES]: [page([TRUCK, VAN])] })
    renderPage()

    const ana = (await screen.findByRole('rowheader', { name: 'Ana Gómez' })).closest('tr')!
    expect(await within(ana).findByText('Camión 01')).toBeInTheDocument()
    expect(within(ana).getByText('+573001234567')).toBeInTheDocument()
    expect(within(ana).getByText('1 campo')).toBeInTheDocument()

    const luis = screen.getByRole('rowheader', { name: 'Luis Pérez' }).closest('tr')!
    expect(within(luis).getByText('Sin vehículo')).toBeInTheDocument()
    expect(screen.getByText('2 conductores')).toBeInTheDocument()
  })

  it('says when the vehicle of a driver is not visible to this account', async () => {
    stubFetch({ '/api/v1/auth/me': [me(OPERATOR)], [LIST]: [page([ANA])], [VEHICLES]: [page([VAN])] })
    renderPage()

    expect(await screen.findByText('Vehículo no disponible (ID 500)')).toBeInTheDocument()
  })

  it('shows no actions to a role that can only read', async () => {
    stubFetch({ '/api/v1/auth/me': [me(VIEWER)], [LIST]: [page([ANA])], [VEHICLES]: [page([TRUCK])] })
    renderPage()

    await screen.findByRole('rowheader', { name: 'Ana Gómez' })
    expect(screen.queryByRole('button', { name: 'Nuevo conductor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()
  })

  it('creates a driver with custom fields and confirms it', async () => {
    const created = { ...LUIS, id: '1-3', name: 'Marta Ruiz', custom_fields: { cedula: '999' } }
    const http = stubFetch({
      '/api/v1/auth/me': [me(OPERATOR)],
      [LIST]: [page([ANA])],
      [VEHICLES]: [page([TRUCK])],
      'POST /api/v1/drivers': [json(201, created)],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Marta Ruiz')
    await userEvent.type(within(dialog).getByLabelText('Teléfono'), '+573009998877')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar campo' }))
    await userEvent.type(within(dialog).getByLabelText('Nombre del campo 1'), 'cedula')
    await userEvent.type(within(dialog).getByLabelText('Valor del campo 1'), '999')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    expect(await screen.findByText('Marta Ruiz fue creado.')).toBeInTheDocument()
    expect(http.requestsTo('POST', '/api/v1/drivers')[0].body).toEqual({
      name: 'Marta Ruiz',
      code: '',
      phone: '+573009998877',
      description: '',
      custom_fields: { cedula: '999' },
    })
  })

  it('validates the phone before calling the backend', async () => {
    const http = stubFetch({ '/api/v1/auth/me': [me(OPERATOR)], [LIST]: [page([ANA])], [VEHICLES]: [page([TRUCK])] })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Marta Ruiz')
    await userEvent.type(within(dialog).getByLabelText('Teléfono'), '300-123')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    expect(await within(dialog).findByText(/Entre 7 y 15 dígitos/)).toBeInTheDocument()
    expect(http.requestsTo('POST', '/api/v1/drivers')).toHaveLength(0)
  })

  it('shows the backend conflict when the phone is taken', async () => {
    stubFetch({
      '/api/v1/auth/me': [me(OPERATOR)],
      [LIST]: [page([ANA])],
      [VEHICLES]: [page([TRUCK])],
      'POST /api/v1/drivers': [json(409, { title: 'Conflicto', detail: 'Ya existe otro conductor con ese teléfono.' })],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Otra persona')
    await userEvent.type(within(dialog).getByLabelText('Teléfono'), '+573001234567')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    expect(await within(dialog).findByText('Ya existe otro conductor con ese teléfono.')).toBeInTheDocument()
  })

  it('assigns a vehicle', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [me(OPERATOR)],
      [LIST]: [page([LUIS])],
      [VEHICLES]: [page([TRUCK, VAN])],
      'PUT /api/v1/drivers/1-2/vehicle': [json(200, { ...LUIS, vehicle_id: 600 })],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Asignar vehículo a Luis Pérez' }))
    const dialog = screen.getByRole('dialog', { name: /Asignar vehículo a Luis Pérez/ })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Van 07' })).toBeInTheDocument())
    await userEvent.selectOptions(within(dialog).getByLabelText('Vehículo'), 'Van 07')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByText('Luis Pérez quedó asignado a Van 07.')).toBeInTheDocument()
    expect(http.requestsTo('PUT', '/api/v1/drivers/1-2/vehicle')[0].body).toEqual({ vehicle_id: 600 })
  })

  it('deletes only after confirming', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [me(OPERATOR)],
      [LIST]: [page([LUIS])],
      [VEHICLES]: [page([TRUCK])],
      'DELETE /api/v1/drivers/1-2': [json(204, null)],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar a Luis Pérez' }))
    expect(http.requestsTo('DELETE', '/api/v1/drivers/1-2')).toHaveLength(0)

    const dialog = screen.getByRole('dialog', { name: 'Eliminar conductor' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByText('Luis Pérez fue eliminado.')).toBeInTheDocument()
    expect(http.requestsTo('DELETE', '/api/v1/drivers/1-2')).toHaveLength(1)
  })

  it('downloads the CSV with the filters on screen (RF-25)', async () => {
    const urls: string[] = []
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:csv', revokeObjectURL: () => {} }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url === '/api/v1/auth/me') return me([...OPERATOR, 'data:export'])
        if (url.startsWith('/api/v1/drivers/export')) {
          return new Response('﻿Nombre\r\n', {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="conductores-2026-11-08.csv"',
            },
          })
        }
        return url === VEHICLES ? page([TRUCK, VAN]) : page([ANA])
      }),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Con vehículo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV de conductores' }))

    expect(await screen.findByText('Se descargó el archivo de conductores.')).toBeInTheDocument()
    expect(urls).toContain('/api/v1/drivers/export?assigned=true')
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('conductores-2026-11-08.csv')
    click.mockRestore()
  })

  it('hides the CSV button from a role without data:export', async () => {
    stubFetch({ '/api/v1/auth/me': [me(OPERATOR)], [LIST]: [page([ANA])], [VEHICLES]: [page([TRUCK])] })
    renderPage()

    await screen.findByRole('rowheader', { name: 'Ana Gómez' })
    expect(screen.queryByRole('button', { name: 'Descargar CSV de conductores' })).not.toBeInTheDocument()
  })

  it('explains why a download failed', async () => {
    stubFetch({
      '/api/v1/auth/me': [me([...OPERATOR, 'data:export'])],
      [LIST]: [page([ANA])],
      [VEHICLES]: [page([TRUCK])],
      '/api/v1/drivers/export': [json(403, { title: 'Acceso denegado', detail: 'No tienes permiso para realizar esta acción.' })],
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV de conductores' }))
    expect(await screen.findByText('No tienes permiso para realizar esta acción.')).toBeInTheDocument()
  })
})
