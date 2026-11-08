import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { json, stubFetch } from '../../test/fetchStub'
import { renderWithProviders } from '../../test/renderWithProviders'
import { setSessionHint } from '../auth/sessionHint'
import { LandingPage } from './LandingPage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LandingPage', () => {
  it('has every section the brief asks for, in a proper heading outline (RF-02)', () => {
    stubFetch({})
    renderWithProviders(<LandingPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu flota, en tiempo real y bajo control.')
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(sections).toEqual([
      'Menos llamadas preguntando «¿dónde va?», más operación bajo control',
      'Todo lo que necesitas para gestionar tu flota',
      'De los datos del GPS a decisiones en tres pasos',
      '¿Listo para ver tu flota?',
    ])
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2026 Navexa')
  })

  it('invites a visitor to log in without calling the backend (RF-01)', () => {
    const http = stubFetch({})
    renderWithProviders(<LandingPage />)

    const logins = screen.getAllByRole('link', { name: 'Iniciar sesión' })
    expect(logins.length).toBeGreaterThan(0)
    logins.forEach((link) => expect(link).toHaveAttribute('href', '/login'))
    expect(http.callsTo('/api/v1/auth/me')).toBe(0)
  })

  it('offers a shortcut to the panel to a logged-in user (RF-03)', async () => {
    setSessionHint()
    stubFetch({
      '/api/v1/auth/me': [
        json(200, {
          id: 1,
          email: 'a@navexa.co',
          full_name: 'Ana',
          role: 'admin',
          permissions: [],
          must_change_password: false,
        }),
      ],
    })
    renderWithProviders(<LandingPage />)

    const panelLinks = await screen.findAllByRole('link', { name: 'Ir al panel' })
    panelLinks.forEach((link) => expect(link).toHaveAttribute('href', '/panel'))
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })
})
