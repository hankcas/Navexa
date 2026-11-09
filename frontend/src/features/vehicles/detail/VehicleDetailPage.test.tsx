import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../../app/paths'
import { json, stubFetch } from '../../../test/fetchStub'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { setSessionHint } from '../../auth/sessionHint'
import type { VehicleDetail } from './types'
import { VehicleDetailPage } from './VehicleDetailPage'

// jsdom cannot draw Leaflet; the page only needs to render something in its place.
vi.mock('../map/VehiclesMap', () => ({ VehiclesMap: () => <p>Mapa del vehículo</p> }))

const MODIFIED = '2026-11-08T15:00:00Z'

const TRUCK: VehicleDetail = {
  id: 500,
  name: 'Camión 01',
  status: 'moving',
  speed_kmh: 42.4,
  last_update: '2026-11-08T15:30:00Z',
  position: { latitude: 4.65, longitude: -74.05, altitude_m: 2600, heading: 90, satellites: 9 },
  driver: { id: '1-1', name: 'Ana Gómez', phone: '+573001234567' },
  passengers: [
    { id: '1-10', name: 'Laura', code: 'P-10' },
    { id: '1-12', name: 'Sara', code: null },
  ],
  custom_fields: [{ id: 1, name: 'Placa', value: 'ABC123', modified_at: MODIFIED }],
}

const DETAIL = '/api/v1/vehicles/500'
const FIELD = '/api/v1/vehicles/500/custom-fields/1'

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

const OPERATOR = ['vehicles:read', 'vehicles:write', 'drivers:read', 'passengers:read']
const VIEWER = ['vehicles:read', 'drivers:read', 'passengers:read']

function renderPage(path = '/panel/vehiculos/500') {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.vehicleDetail} element={<VehicleDetailPage />} />
    </Routes>,
    path,
  )
}

beforeEach(() => {
  localStorage.clear()
  setSessionHint()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VehicleDetailPage', () => {
  it('shows the transformed data, the driver and the passengers (RF-12, RF-13, RF-09)', async () => {
    stubFetch({ '/api/v1/auth/me': [me(VIEWER)], [DETAIL]: [json(200, TRUCK)] })
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Camión 01' })).toBeInTheDocument()
    expect(screen.getByText('En movimiento')).toBeInTheDocument()
    expect(screen.getByText('42 km/h')).toBeInTheDocument()
    expect(screen.getByText('Este (90°)')).toBeInTheDocument()

    const driver = screen.getByRole('region', { name: 'Conductor' })
    expect(within(driver).getByText('Ana Gómez')).toBeInTheDocument()
    expect(within(driver).getByText('+573001234567')).toBeInTheDocument()

    const passengers = screen.getByRole('region', { name: 'Pasajeros (2)' })
    expect(within(passengers).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Laura · P-10',
      'Sara',
    ])
  })

  it('says clearly when there is no driver, no passengers or no position', async () => {
    const empty = { ...TRUCK, driver: null, passengers: [], position: null, status: 'no_position' }
    stubFetch({ '/api/v1/auth/me': [me(VIEWER)], [DETAIL]: [json(200, empty)] })
    renderPage()

    expect(await screen.findByText(/Sin conductor asignado/)).toBeInTheDocument()
    expect(screen.getByText(/Sin pasajeros asignados/)).toBeInTheDocument()
    expect(screen.getByText('Este vehículo todavía no ha reportado una posición válida.')).toBeInTheDocument()
  })

  it('lets a viewer read the custom fields but not change them', async () => {
    stubFetch({ '/api/v1/auth/me': [me(VIEWER)], [DETAIL]: [json(200, TRUCK)] })
    renderPage()

    expect(await screen.findByText('ABC123')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar el campo Placa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar campo' })).not.toBeInTheDocument()
  })

  it('shows an edit at once, and puts the old value back if Wialon refuses it (RF-20, RF-21)', async () => {
    let answerPatch: (response: Response) => void = () => {}
    const patchBodies: unknown[] = []
    let detailCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/v1/auth/me') return me(OPERATOR)
        if (url === DETAIL) {
          detailCalls += 1
          // The reload after the failed save never answers: only the rollback can bring the
          // old value back, which is exactly what this test checks.
          return detailCalls === 1 ? json(200, TRUCK) : new Promise<Response>(() => {})
        }
        if (url === FIELD && init?.method === 'PATCH') {
          patchBodies.push(JSON.parse(init.body as string))
          return new Promise<Response>((resolve) => {
            answerPatch = resolve
          })
        }
        throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
      }),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Editar el campo Placa' }))
    const value = screen.getByLabelText('Valor')
    await userEvent.clear(value)
    await userEvent.type(value, 'XYZ987')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    // Optimistic: the new value and "Guardando…" before the backend answers.
    expect(await screen.findByText('XYZ987')).toBeInTheDocument()
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
    expect(patchBodies[0]).toEqual({ name: 'Placa', value: 'XYZ987', expected_modified_at: MODIFIED })

    answerPatch(
      json(409, {
        title: 'Conflicto',
        detail: 'Este campo cambió en la plataforma de rastreo mientras lo editabas.',
      }),
    )

    // Rollback: the old value is back and the failure offers a retry.
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
    expect(screen.queryByText('XYZ987')).not.toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('cambió en la plataforma de rastreo')
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('adds a field and deletes one only after confirming', async () => {
    const http = stubFetch({
      '/api/v1/auth/me': [me(OPERATOR)],
      [DETAIL]: [json(200, TRUCK)],
      'POST /api/v1/vehicles/500/custom-fields': [
        json(201, { id: 2, name: 'Marca', value: 'Volvo', modified_at: MODIFIED }),
      ],
      [`DELETE ${FIELD}`]: [json(204, null)],
    })
    renderPage()

    await userEvent.type(await screen.findByLabelText('Nombre del campo nuevo'), 'Marca')
    await userEvent.type(screen.getByLabelText('Valor del campo nuevo'), 'Volvo')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar campo' }))
    expect(await screen.findByText('Se agregó el campo «Marca».')).toBeInTheDocument()
    expect(http.requestsTo('POST', '/api/v1/vehicles/500/custom-fields')[0].body).toEqual({
      name: 'Marca',
      value: 'Volvo',
    })

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar el campo Placa' }))
    expect(http.requestsTo('DELETE', FIELD)).toHaveLength(0)
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Eliminar campo' })).getByRole('button', { name: 'Eliminar' }),
    )
    await waitFor(() => expect(http.requestsTo('DELETE', FIELD)).toHaveLength(1))
  })

  it('explains when the vehicle does not exist', async () => {
    stubFetch({
      '/api/v1/auth/me': [me(VIEWER)],
      '/api/v1/vehicles/999': [json(404, { title: 'No encontrado', detail: 'El vehículo no existe.' })],
    })
    renderPage('/panel/vehiculos/999')

    expect(await screen.findByText('No encontramos este vehículo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Volver a vehículos' })).toHaveAttribute('href', '/panel/vehiculos')
  })
})
