import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('fallo de prueba')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('shows its children when nothing fails', () => {
    render(
      <ErrorBoundary fallback={<p>Algo salió mal</p>}>
        <p>Contenido</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('shows the fallback instead of a blank screen when a child throws', () => {
    // React and the boundary log the error; silence them to keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<p>Algo salió mal</p>}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
  })
})
