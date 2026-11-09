import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../app/paths'
import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { AuditPage } from './AuditPage'
import type { AuditEntry } from './types'

const LOGIN_FAILED: AuditEntry = {
  id: 2,
  created_at: '2026-11-08T15:30:00Z',
  actor_email: 'intruso@example.com',
  action: 'auth.login_failed',
  entity_type: null,
  entity_id: null,
  details: { reason: 'unknown_email' },
  ip_address: '203.0.113.7',
}
const DRIVER_CREATED: AuditEntry = {
  id: 1,
  created_at: '2026-11-08T14:00:00Z',
  actor_email: 'admin@navexa.co',
  action: 'drivers.created',
  entity_type: 'driver',
  entity_id: '1-7',
  details: { name: 'Ana Gómez' },
  ip_address: '10.0.0.1',
}

const FIRST_PAGE = '/api/v1/audit?page=1&page_size=20'

function page(items: AuditEntry[], overrides: Record<string, number> = {}) {
  return json(200, { items, total: items.length, page: 1, page_size: 20, pages: 1, ...overrides })
}

function renderPage(search = '') {
  return renderWithProviders(
    <Routes>
      <Route path={PATHS.audit} element={<AuditPage />} />
    </Routes>,
    `${PATHS.audit}${search}`,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuditPage', () => {
  it('lists who did what and when, in plain Spanish (RF-26)', async () => {
    stubFetch({ [FIRST_PAGE]: [page([LOGIN_FAILED, DRIVER_CREATED])] })
    renderPage()

    const failed = (await screen.findByRole('rowheader', { name: 'Intento fallido de inicio de sesión' })).closest('tr')!
    expect(within(failed).getByText('intruso@example.com')).toBeInTheDocument()
    expect(within(failed).getByText('Motivo: el correo no existe')).toBeInTheDocument()
    expect(within(failed).getByText('203.0.113.7')).toBeInTheDocument()
    expect(within(failed).getByText('8 de nov de 2026, 10:30 a. m.')).toBeInTheDocument()

    const created = screen.getByRole('rowheader', { name: 'Creó un conductor' }).closest('tr')!
    expect(within(created).getByText(/«Ana Gómez»/)).toBeInTheDocument()
    expect(within(created).getByText(/ID 1-7/)).toBeInTheDocument()
    expect(screen.getByText('2 registros')).toBeInTheDocument()
  })

  it('filters by type and keeps the filter in the URL', async () => {
    const http = stubFetch({
      [FIRST_PAGE]: [page([LOGIN_FAILED, DRIVER_CREATED])],
      '/api/v1/audit?page=1&page_size=20&category=drivers': [page([DRIVER_CREATED])],
    })
    renderPage()

    await screen.findByRole('rowheader', { name: 'Creó un conductor' })
    await userEvent.click(screen.getByRole('button', { name: 'Conductores' }))

    expect(await screen.findByText('1 registro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conductores' })).toHaveAttribute('aria-pressed', 'true')
    expect(http.callsTo('/api/v1/audit?page=1&page_size=20&category=drivers')).toBe(1)
  })

  it('opens on the page and type written in the URL', async () => {
    const http = stubFetch({
      '/api/v1/audit?page=2&page_size=20&category=auth': [page([LOGIN_FAILED], { page: 2, pages: 3, total: 45 })],
    })
    renderPage('?categoria=auth&pagina=2')

    expect(await screen.findByText('45 registros')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Paginación de la auditoría' })).toBeInTheDocument()
    expect(http.callsTo('/api/v1/audit?page=2&page_size=20&category=auth')).toBe(1)
  })

  it('offers to clear the filters when nothing matches', async () => {
    stubFetch({
      '/api/v1/audit?page=1&page_size=20&category=users': [page([])],
      [FIRST_PAGE]: [page([DRIVER_CREATED])],
    })
    renderPage('?categoria=users')

    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByRole('rowheader', { name: 'Creó un conductor' })).toBeInTheDocument()
  })

  it('explains when the log cannot be loaded', async () => {
    stubFetch({ [FIRST_PAGE]: [json(403, { title: 'Acceso denegado', detail: 'No tienes permiso.' })] })
    renderPage()

    expect(await screen.findByText('No pudimos cargar la auditoría')).toBeInTheDocument()
    expect(screen.getByText('No tienes permiso.')).toBeInTheDocument()
  })
})
