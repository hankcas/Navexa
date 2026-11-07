import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { NotFoundPage } from './app/NotFoundPage'
import { PATHS } from './app/paths'
import { queryClient } from './app/queryClient'
import { RedirectIfAuthenticated, RequireAuth } from './features/auth/guards'
import { LandingPage } from './features/landing/LandingPage'
import { FullPageState } from './shared/ui/FullPageState'
import { ServerStatusBanner } from './shared/ui/ServerStatusBanner'

// Private pages load on demand, so the public landing downloads as little JavaScript as possible.
const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const ChangePasswordPage = lazy(() =>
  import('./features/auth/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
)
const PanelLayout = lazy(() =>
  import('./features/panel/PanelLayout').then((module) => ({ default: module.PanelLayout })),
)
const PanelHome = lazy(() =>
  import('./features/panel/PanelHome').then((module) => ({ default: module.PanelHome })),
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ServerStatusBanner />
        <Suspense fallback={<FullPageState loading title="Cargando…" />}>
          <Routes>
            <Route path={PATHS.home} element={<LandingPage />} />
            <Route element={<RedirectIfAuthenticated />}>
              <Route path={PATHS.login} element={<LoginPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path={PATHS.changePassword} element={<ChangePasswordPage />} />
              <Route path={PATHS.panel} element={<PanelLayout />}>
                <Route index element={<PanelHome />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
