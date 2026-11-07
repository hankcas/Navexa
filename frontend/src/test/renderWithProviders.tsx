import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, type InitialEntry } from 'react-router-dom'

/** Renders with a fresh React Query cache and an in-memory router starting at the given entry. */
export function renderWithProviders(ui: ReactNode, initialEntry: InitialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}
