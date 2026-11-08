import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { NotFoundPage } from './app/NotFoundPage'
import { PATHS } from './app/paths'
import { queryClient } from './app/queryClient'
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from './features/auth/guards'
import { PERMISSIONS } from './features/auth/permissions'
import { LandingPage } from './features/landing/LandingPage'
import { Button } from './shared/ui/Button'
import { ErrorBoundary } from './shared/ui/ErrorBoundary'
import { FullPageState } from './shared/ui/FullPageState'
import { reloadPage } from './shared/ui/reloadPage'
import { ServerStatusBanner } from './shared/ui/ServerStatusBanner'
import { ToastProvider } from './shared/ui/toast/ToastProvider'

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
const VehiclesPage = lazy(() =>
  import('./features/vehicles/VehiclesPage').then((module) => ({ default: module.VehiclesPage })),
)
const DriversPage = lazy(() =>
  import('./features/drivers/DriversPage').then((module) => ({ default: module.DriversPage })),
)
const PassengersPage = lazy(() =>
  import('./features/passengers/PassengersPage').then((module) => ({ default: module.PassengersPage })),
)

/** Shown instead of a blank screen when a page fails to render (ARQ-12). */
const pageError = (
  <FullPageState
    title="Algo salió mal"
    detail="Ocurrió un error inesperado al mostrar esta página. Recárgala para intentarlo de nuevo."
    action={<Button onClick={reloadPage}>Recargar página</Button>}
  />
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <ServerStatusBanner />
          <ErrorBoundary fallback={pageError}>
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
                    <Route element={<RequirePermission permission={PERMISSIONS.vehiclesRead} />}>
                      <Route path={PATHS.vehicles} element={<VehiclesPage />} />
                    </Route>
                    <Route element={<RequirePermission permission={PERMISSIONS.driversRead} />}>
                      <Route path={PATHS.drivers} element={<DriversPage />} />
                    </Route>
                    <Route element={<RequirePermission permission={PERMISSIONS.passengersRead} />}>
                      <Route path={PATHS.passengers} element={<PassengersPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
