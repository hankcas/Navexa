import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../../app/paths'
import { json, stubFetch } from '../../../test/fetchStub'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { Vehicle } from '../types'
import { HistoryPage } from './HistoryPage'
import type { TrackMapProps } from './TrackMap'
import type { VehicleTrack } from './types'

// jsdom cannot draw Leaflet. The stand-in says how many points it got and where the vehicle is.
vi.mock('./TrackMap', () => ({
  TrackMap: ({ points, frame }: TrackMapProps) => (
    <p>
      Mapa con {points.length} puntos{frame && `, vehículo en ${frame.latitude.toFixed(3)}`}
    </p>
  ),
}))

function vehicle(id: number, name: string): Vehicle {
  return { id, name, status: 'stopped', speed_kmh: 0, last_update: null, position: null, driver: null }
}

const VEHICLES = '/api/v1/vehicles?page=1&page_size=100'
const FLEET = json(200, {
  items: [vehicle(600, 'Van 07'), vehicle(500, 'Camión 01')],
  total: 2,
  page: 1,
  page_size: 100,
  pages: 1,
})

// 07:00 to 09:00 in Bogotá is 12:00 to 14:00 UTC.
const QUERY = '?vehiculo=500&desde=2026-11-08T07:00&hasta=2026-11-08T09:00'
const TRACK = `/api/v1/vehicles/500/track?${new URLSearchParams({
  from: '2026-11-08T12:00:00.000Z',
  to: '2026-11-08T14:00:00.000Z',
})}`

const ROUTE: VehicleTrack = {
  vehicle_id: 500,
  start: '2026-11-08T12:00:00Z',
  end: '2026-11-08T14:00:00Z',
  total_points: 1200,
  simplified: true,
  points: [
    { time: '2026-11-08T12:00:00Z', latitude: 4.6, longitude: -74.1, speed_kmh: 20, heading: 0 },
    { time: '2026-11-08T12:10:00Z', latitude: 4.7, longitude: -74.1, speed_kmh: 60, heading: 0 },
    { time: '2026-11-08T12:20:00Z', latitude: 4.7, longitude: -74.1, speed_kmh: 0, heading: null },
  ],
  summary: {
    distance_km: 11.12,
    max_speed_kmh: 72,
    average_speed_kmh: 38.5,
    started_at: '2026-11-08T12:00:00Z',
    ended_at: '2026-11-08T12:20:00Z',
  },
}

function renderPage(search = '') {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.history} element={<HistoryPage />} />
    </Routes>,
    `${PATHS.history}${search}`,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HistoryPage', () => {
  it('asks for a vehicle, listed by name, before loading anything', async () => {
    const http = stubFetch({ [VEHICLES]: [FLEET] })
    renderPage()

    expect(screen.getByText('Elige un vehículo y un rango')).toBeInTheDocument()
    const select = screen.getByLabelText('Vehículo')
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3))
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Elige un vehículo',
      'Camión 01',
      'Van 07',
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }))
    expect(await screen.findByText('Elige un vehículo.')).toBeInTheDocument()
    expect(http.callsTo(TRACK)).toBe(0)
  })

  it('asks the backend for the range in UTC and shows the summary (RF-24)', async () => {
    const http = stubFetch({ [VEHICLES]: [FLEET], [TRACK]: [json(200, ROUTE)] })
    renderPage(QUERY)

    expect(await screen.findByRole('heading', { name: 'Resumen de Camión 01' })).toBeInTheDocument()
    expect(http.callsTo(TRACK)).toBe(1)
    const summary = screen.getByRole('region', { name: 'Resumen de Camión 01' })
    expect(within(summary).getByText('11,1 km')).toBeInTheDocument()
    expect(within(summary).getByText('72 km/h')).toBeInTheDocument()
    expect(within(summary).getByText(/El mapa muestra 3 de 1\.200 posiciones/)).toBeInTheDocument()
    expect(await screen.findByText('Mapa con 3 puntos, vehículo en 4.600')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Colores de la línea' })).toBeInTheDocument()
  })

  it('moves the vehicle and its speed when the timeline is dragged', async () => {
    stubFetch({ [VEHICLES]: [FLEET], [TRACK]: [json(200, ROUTE)] })
    renderPage(QUERY)

    const timeline = await screen.findByRole('slider', { name: 'Momento del recorrido' })
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument()

    // Halfway between the first two points: 12:05 UTC, 40 km/h.
    fireEvent.change(timeline, { target: { value: String(Date.parse('2026-11-08T12:05:00Z')) } })
    const readout = within(screen.getByRole('group', { name: 'Reproducción del recorrido' }))
    expect(readout.getByText('40 km/h')).toBeInTheDocument()
    expect(readout.getByText('Norte')).toBeInTheDocument()
    expect(await screen.findByText('Mapa con 3 puntos, vehículo en 4.650')).toBeInTheDocument()

    // At the end the vehicle is parked.
    fireEvent.change(timeline, { target: { value: String(Date.parse('2026-11-08T12:20:00Z')) } })
    expect(readout.getByText('Detenido')).toBeInTheDocument()
  })

  it('opens a vehicle from its page with the last 24 hours', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return url === VEHICLES ? FLEET.clone() : json(200, { ...ROUTE, points: [] })
      }),
    )
    renderPage('?vehiculo=500')

    expect(await screen.findByText('No hay posiciones en este rango')).toBeInTheDocument()
    const track = urls.find((url) => url.startsWith('/api/v1/vehicles/500/track?'))!
    const params = new URL(track, 'http://x').searchParams
    const hours = (Date.parse(params.get('to')!) - Date.parse(params.get('from')!)) / 3_600_000
    expect(hours).toBe(24)
  })

  it('shows the reason when the backend refuses the range', async () => {
    stubFetch({
      [VEHICLES]: [FLEET],
      [TRACK]: [json(422, { title: 'Solicitud no válida', detail: 'Ese rango tiene 60.000 posiciones.' })],
    })
    renderPage(QUERY)

    expect(await screen.findByText('No pudimos cargar el recorrido')).toBeInTheDocument()
    expect(screen.getByText('Ese rango tiene 60.000 posiciones.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
