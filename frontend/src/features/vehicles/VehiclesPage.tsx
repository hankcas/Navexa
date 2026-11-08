import { ApiError } from '../../shared/api/errors'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { Pagination } from '../../shared/ui/Pagination'
import { StateMessage } from '../../shared/ui/StateMessage'
import { TextField } from '../../shared/ui/TextField'
import { STATUS_LABELS } from './format'
import { useVehiclesPage } from './queries'
import { VEHICLE_STATUSES } from './types'
import { useVehicleFilters } from './useVehicleFilters'
import styles from './VehiclesPage.module.css'
import { VehiclesTable } from './VehiclesTable'

const SEARCH_DELAY_MS = 300

export function VehiclesPage() {
  const { filters, update } = useVehicleFilters()
  // The URL updates on every key; the request waits until the user stops typing.
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DELAY_MS)
  const vehicles = useVehiclesPage({ ...filters, search: debouncedSearch })
  const hasFilters = Boolean(filters.search || filters.status)

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

      <section className={styles.card} aria-labelledby="vehicles-filters">
        <h2 id="vehicles-filters" className="visually-hidden">
          Filtros
        </h2>
        <div className={styles.toolbar}>
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
        </div>

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
            <VehiclesTable vehicles={vehicles.data.items} />
            <Pagination
              label="Paginación de vehículos"
              page={vehicles.data.page}
              pages={vehicles.data.pages}
              onChange={(page) => update({ page })}
            />
          </>
        )}
      </section>
    </>
  )
}
