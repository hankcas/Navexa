import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { DashboardOverview } from './DashboardOverview'

const SUMMARY = {
  vehicles: {
    total: 62,
    by_status: { moving: 8, stopped: 25, offline: 28, no_position: 1 },
    with_driver: 9,
    without_driver: 53,
  },
  drivers: { total: 16, assigned: 12 },
  passengers: { total: 101, assigned: 0 },
  generated_at: new Date().toISOString(),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardOverview', () => {
  it('shows the KPIs, each linking to its list', async () => {
    stubFetch({ '/api/v1/dashboard/summary': [json(200, SUMMARY)] })
    renderWithProviders(<DashboardOverview />)

    const kpis = await screen.findByRole('list', { name: 'Indicadores principales' })
    expect(within(kpis).getByRole('link', { name: /Vehículos\s*62/ })).toHaveAttribute('href', '/panel/vehiculos')
    expect(within(kpis).getByRole('link', { name: /Sin señal\s*28/ })).toHaveAttribute(
      'href',
      '/panel/vehiculos?estado=offline',
    )
    expect(within(kpis).getByText('12 con vehículo')).toBeInTheDocument()
  })

  it('gives every chart value in text, not only as a color', async () => {
    stubFetch({ '/api/v1/dashboard/summary': [json(200, SUMMARY)] })
    renderWithProviders(<DashboardOverview />)

    const byStatus = await screen.findByRole('figure', { name: 'Vehículos por estado' })
    expect(within(byStatus).getByText('Detenidos').closest('li')).toHaveTextContent('25 (40 %)')

    const coverage = screen.getByRole('figure', { name: 'Vehículos con conductor asignado' })
    expect(within(coverage).getByText('Con conductor').closest('li')).toHaveTextContent('9 (15 %)')
  })

  it('offers a retry when the summary fails', async () => {
    stubFetch({
      '/api/v1/dashboard/summary': [json(503, { title: 'Servicio externo no disponible', detail: 'Wialon no responde.' })],
    })
    renderWithProviders(<DashboardOverview />)

    expect(await screen.findByText('No pudimos cargar los indicadores')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
