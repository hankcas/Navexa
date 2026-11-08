import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, type InitialEntry } from 'react-router-dom'

import { ToastProvider } from '../shared/ui/toast/ToastProvider'

/** Renders like the app does: fresh React Query cache, toasts and an in-memory router. */
export function renderWithProviders(ui: ReactNode, initialEntry: InitialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}
