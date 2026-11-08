import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { Vehicle } from './types'
import { VehiclesPage } from './VehiclesPage'

const truck: Vehicle = {
  id: 1,
  name: 'Camión 01',
  status: 'moving',
  speed_kmh: 42.4,
  last_update: '2026-11-07T15:30:00Z',
  position: { latitude: 4.65, longitude: -74.05, altitude_m: 2600, heading: 90, satellites: 9 },
}

const van: Vehicle = {
  id: 2,
  name: 'Van 07',
  status: 'no_position',
  speed_kmh: null,
  last_update: null,
  position: null,
}

function page(items: Vehicle[], overrides: Partial<{ page: number; pages: number; total: number }> = {}) {
  return json(200, { items, total: items.length, page: 1, page_size: 20, pages: 1, ...overrides })
}

const BASE = '/api/v1/vehicles?page=1&page_size=20'

function renderPage(initialEntry: string = PATHS.vehicles) {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.vehicles} element={<VehiclesPage />} />
    </Routes>,
    initialEntry,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VehiclesPage', () => {
  it('lists vehicles with their transformed data', async () => {
    stubFetch({ [BASE]: [page([truck, van])] })
    renderPage()

    const row = (await screen.findByRole('rowheader', { name: 'Camión 01' })).closest('tr')!
    expect(within(row).getByText('En movimiento')).toBeInTheDocument()
    expect(within(row).getByText('42 km/h')).toBeInTheDocument()
    expect(within(row).getByTitle('Este')).toHaveTextContent('E')

    const emptyRow = screen.getByRole('rowheader', { name: 'Van 07' }).closest('tr')!
    expect(within(emptyRow).getByText('Sin posición')).toBeInTheDocument()
    expect(within(emptyRow).getAllByText('Sin dato')).toHaveLength(3)
    expect(screen.getByText('2 vehículos')).toBeInTheDocument()
  })

  it('asks the server for one status when a filter is chosen', async () => {
    const http = stubFetch({
      [BASE]: [page([truck, van])],
      [`${BASE}&status=moving`]: [page([truck])],
    })
    renderPage()
    await screen.findByText('Van 07')

    await userEvent.click(screen.getByRole('button', { name: 'En movimiento' }))

    expect(await screen.findByText('1 vehículo')).toBeInTheDocument()
    expect(screen.queryByText('Van 07')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'En movimiento' })).toHaveAttribute('aria-pressed', 'true')
    expect(http.callsTo(`${BASE}&status=moving`)).toBe(1)
  })

  it('searches on the server once the user stops typing', async () => {
    const http = stubFetch({
      [BASE]: [page([truck, van])],
      [`${BASE}&search=van+07`]: [page([van])],
    })
    renderPage()
    await screen.findByText('Camión 01')

    await userEvent.type(screen.getByLabelText('Buscar por nombre'), 'van 07')

    expect(await screen.findByText('1 vehículo')).toBeInTheDocument()
    expect(http.callsTo(`${BASE}&search=van+07`)).toBe(1)
  })

  it('guides the user when no vehicle matches the filters', async () => {
    stubFetch({ ['/api/v1/vehicles?page=1&page_size=20&search=zzz']: [page([])] })
    renderPage(`${PATHS.vehicles}?buscar=zzz`)

    expect(await screen.findByText('Ningún vehículo coincide con tu búsqueda')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('moves between pages', async () => {
    stubFetch({
      [BASE]: [page([truck], { pages: 2, total: 21 })],
      ['/api/v1/vehicles?page=2&page_size=20']: [page([van], { page: 2, pages: 2, total: 21 })],
    })
    renderPage()
    await screen.findByText('Camión 01')

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Van 07')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  })

  it('offers a retry when the vehicles cannot be loaded', async () => {
    stubFetch({
      [BASE]: [json(503, { title: 'Servicio externo no disponible', detail: 'No pudimos comunicarnos con la plataforma de rastreo.' })],
    })
    renderPage()

    expect(await screen.findByText('No pudimos cargar los vehículos')).toBeInTheDocument()
    expect(screen.getByText('No pudimos comunicarnos con la plataforma de rastreo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
