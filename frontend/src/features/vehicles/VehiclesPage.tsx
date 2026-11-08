import { lazy, Suspense, useMemo, useState } from 'react'

import { ApiError } from '../../shared/api/errors'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary'
import { Pagination } from '../../shared/ui/Pagination'
import { reloadPage } from '../../shared/ui/reloadPage'
import { StateMessage } from '../../shared/ui/StateMessage'
import { TextField } from '../../shared/ui/TextField'
import { STATUS_LABELS } from './format'
import { withPosition } from './location'
import type { SelectionSource } from './map/VehiclesMap'
import { useVehiclesMap, useVehiclesPage } from './queries'
import { VEHICLE_STATUSES } from './types'
import { useVehicleFilters } from './useVehicleFilters'
import styles from './VehiclesPage.module.css'
import { VehiclesTable } from './VehiclesTable'

// Leaflet is heavy: the map loads in its own file, so the table appears without waiting for it.
const VehiclesMap = lazy(() =>
  import('./map/VehiclesMap').then((module) => ({ default: module.VehiclesMap })),
)

const SEARCH_DELAY_MS = 300

type MobileView = 'list' | 'map'

interface Selection {
  id: number
  source: SelectionSource
}

export function VehiclesPage() {
  const { filters, update } = useVehicleFilters()
  // The URL updates on every key; the requests wait until the user stops typing.
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DELAY_MS)
  const vehicles = useVehiclesPage({ ...filters, search: debouncedSearch })
  const mapVehicles = useVehiclesMap({ search: debouncedSearch, status: filters.status })
  const located = useMemo(() => withPosition(mapVehicles.data ?? []), [mapVehicles.data])
  const withoutPosition = (mapVehicles.data?.length ?? 0) - located.length

  const [selection, setSelection] = useState<Selection | null>(null)
  // Phones show one panel at a time; from 1024 px both are side by side and this has no effect.
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const hasFilters = Boolean(filters.search || filters.status)

  function selectFromList(id: number) {
    setSelection({ id, source: 'list' })
    setMobileView('map')
  }

  function selectFromMap(id: number) {
    setSelection({ id, source: 'map' })
  }

  function clearFilters() {
    update({ search: '', status: null })
  }

  return (
    <>
      <title>Vehículos · Navexa</title>
      <header className={styles.header}>
        <h1 className={styles.title}>Vehículos</h1>
        {vehicles.data && (
          <p className={styles.total} aria-live="polite">
            {vehicles.data.total} {vehicles.data.total === 1 ? 'vehículo' : 'vehículos'}
            {vehicles.isFetching && <span className={styles.updating}> · Actualizando…</span>}
          </p>
        )}
      </header>

      <section className={styles.filters} aria-labelledby="vehicles-filters">
        <h2 id="vehicles-filters" className="visually-hidden">
          Filtros
        </h2>
        <TextField
          className={styles.search}
          label="Buscar por nombre"
          type="search"
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
          maxLength={100}
        />
        <fieldset className={styles.statusFilter}>
          <legend className={styles.legend}>Estado</legend>
          <div className={styles.chips}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={filters.status === null}
              onClick={() => update({ status: null })}
            >
              Todos
            </button>
            {VEHICLE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={styles.chip}
                aria-pressed={filters.status === status}
                onClick={() => update({ status })}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <div className={styles.viewSwitch} role="group" aria-label="Vista">
        <button type="button" aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}>
          Lista
        </button>
        <button type="button" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}>
          Mapa
        </button>
      </div>

      <div className={styles.workspace} data-mobile-view={mobileView}>
        <section className={`${styles.panel} ${styles.listPanel}`} aria-labelledby="vehicles-list">
          <h2 id="vehicles-list" className="visually-hidden">
            Lista de vehículos
          </h2>
          {vehicles.isPending ? (
            <StateMessage loading title="Cargando vehículos…" />
          ) : vehicles.isError ? (
            <StateMessage
              title="No pudimos cargar los vehículos"
              detail={vehicles.error instanceof ApiError ? vehicles.error.detail : undefined}
              action={<Button onClick={() => void vehicles.refetch()}>Reintentar</Button>}
            />
          ) : vehicles.data.items.length === 0 ? (
            <StateMessage
              title={hasFilters ? 'Ningún vehículo coincide con tu búsqueda' : 'Aún no hay vehículos'}
              detail={
                hasFilters
                  ? 'Prueba con otro nombre o con otro estado.'
                  : 'Cuando la plataforma de rastreo registre unidades, aparecerán aquí.'
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <VehiclesTable
                vehicles={vehicles.data.items}
                selectedId={selection?.id ?? null}
                scrollToSelected={selection?.source === 'map'}
                onSelect={selectFromList}
              />
              <Pagination
                label="Paginación de vehículos"
                page={vehicles.data.page}
                pages={vehicles.data.pages}
                onChange={(page) => update({ page })}
              />
            </>
          )}
        </section>

        <section className={`${styles.panel} ${styles.mapPanel}`} aria-labelledby="vehicles-map">
          <h2 id="vehicles-map" className="visually-hidden">
            Mapa de vehículos
          </h2>
          {mapVehicles.isError && !mapVehicles.data ? (
            <StateMessage
              title="No pudimos cargar el mapa"
              detail={mapVehicles.error instanceof ApiError ? mapVehicles.error.detail : undefined}
              action={<Button onClick={() => void mapVehicles.refetch()}>Reintentar</Button>}
            />
          ) : (
            <>
              <div className={styles.mapFrame}>
                {/* If only the map fails, the list keeps working. */}
                <ErrorBoundary
                  fallback={
                    <StateMessage
                      title="No pudimos mostrar el mapa"
                      detail="La lista de vehículos sigue disponible. Recarga la página para intentarlo de nuevo."
                      action={<Button onClick={reloadPage}>Recargar página</Button>}
                    />
                  }
                >
                  <Suspense fallback={<StateMessage loading title="Cargando mapa…" />}>
                    <VehiclesMap
                      vehicles={located}
                      selectedId={selection?.id ?? null}
                      selectionSource={selection?.source ?? null}
                      onSelect={selectFromMap}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
              {withoutPosition > 0 && (
                <p className={styles.mapNote}>
                  {withoutPosition === 1
                    ? '1 vehículo no aparece en el mapa porque no tiene posición.'
                    : `${withoutPosition} vehículos no aparecen en el mapa porque no tienen posición.`}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
