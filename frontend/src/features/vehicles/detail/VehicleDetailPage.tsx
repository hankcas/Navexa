import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'

import { historyPath, PATHS } from '../../../app/paths'
import { ApiError } from '../../../shared/api/errors'
import { Button } from '../../../shared/ui/Button'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { StateMessage } from '../../../shared/ui/StateMessage'
import { hasPermission, PERMISSIONS } from '../../auth/permissions'
import { useSession } from '../../auth/session'
import { formatDateTime, formatRelative, formatSpeed, headingToCardinal } from '../format'
import { withPosition } from '../location'
import { StatusBadge } from '../StatusBadge'
import { CustomFieldsPanel } from './CustomFieldsPanel'
import { useVehicleDetail } from './queries'
import styles from './VehicleDetailPage.module.css'

// The same map component as the vehicles page, loaded on demand.
const VehiclesMap = lazy(() =>
  import('../map/VehiclesMap').then((module) => ({ default: module.VehiclesMap })),
)

const coordinateFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 5 })

/** One vehicle: transformed data, position, driver, passengers and custom fields (RF-12). */
export function VehicleDetailPage() {
  const params = useParams<{ vehicleId: string }>()
  const vehicleId = Number(params.vehicleId)
  const validId = Number.isInteger(vehicleId) && vehicleId > 0
  const detail = useVehicleDetail(validId ? vehicleId : 0)
  const { data: user } = useSession()
  const canWrite = hasPermission(user, PERMISSIONS.vehiclesWrite)

  const back = (
    <Link to={PATHS.vehicles} className={styles.back}>
      ← Volver a vehículos
    </Link>
  )

  if (!validId || (detail.isError && detail.error instanceof ApiError && detail.error.status === 404)) {
    return (
      <>
        {back}
        <StateMessage
          headingLevel={1}
          title="No encontramos este vehículo"
          detail="Puede que ya no exista o que tu cuenta no tenga acceso a él."
        />
      </>
    )
  }
  if (detail.isPending) return <StateMessage loading headingLevel={1} title="Cargando el vehículo…" />
  if (detail.isError) {
    return (
      <>
        {back}
        <StateMessage
          headingLevel={1}
          title="No pudimos cargar el vehículo"
          detail={detail.error instanceof ApiError ? detail.error.detail : undefined}
          action={<Button onClick={() => void detail.refetch()}>Reintentar</Button>}
        />
      </>
    )
  }

  const vehicle = detail.data
  const located = withPosition([vehicle])
  const cardinal = headingToCardinal(vehicle.position?.heading ?? null)

  return (
    <>
      <title>{`${vehicle.name} · Navexa`}</title>
      {back}
      <header className={styles.header}>
        <h1 className={styles.title}>{vehicle.name}</h1>
        <StatusBadge status={vehicle.status} />
        <p className={styles.updated}>
          Última posición {formatRelative(vehicle.last_update)}
          {detail.isFetching && ' · Actualizando…'}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="data-title">
            <h2 id="data-title" className={styles.cardTitle}>
              Datos
            </h2>
            <dl className={styles.data}>
              <dt>Velocidad</dt>
              <dd>{formatSpeed(vehicle.speed_kmh)}</dd>
              <dt>Rumbo</dt>
              <dd>{cardinal ? `${cardinal.long} (${vehicle.position?.heading}°)` : 'Sin dato'}</dd>
              <dt>Última actualización</dt>
              <dd>{formatDateTime(vehicle.last_update)}</dd>
              <dt>Coordenadas</dt>
              <dd>
                {vehicle.position
                  ? `${coordinateFormat.format(vehicle.position.latitude)}, ${coordinateFormat.format(vehicle.position.longitude)}`
                  : 'Sin posición'}
              </dd>
              <dt>Satélites</dt>
              <dd>{vehicle.position?.satellites ?? 'Sin dato'}</dd>
            </dl>
          </section>

          <section className={styles.card} aria-labelledby="driver-title">
            <h2 id="driver-title" className={styles.cardTitle}>
              Conductor
            </h2>
            {vehicle.driver ? (
              <p className={styles.person}>
                <span className={styles.personName}>{vehicle.driver.name}</span>
                <span className={styles.muted}>{vehicle.driver.phone ?? 'Sin teléfono'}</span>
              </p>
            ) : (
              <p className={styles.muted}>
                Sin conductor asignado. Puedes asignarlo desde <Link to={PATHS.drivers}>Conductores</Link>.
              </p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="passengers-title">
            <h2 id="passengers-title" className={styles.cardTitle}>
              Pasajeros ({vehicle.passengers.length})
            </h2>
            {vehicle.passengers.length === 0 ? (
              <p className={styles.muted}>
                Sin pasajeros asignados. Puedes asignarlos desde <Link to={PATHS.passengers}>Pasajeros</Link>.
              </p>
            ) : (
              <ul className={styles.passengers}>
                {vehicle.passengers.map((passenger) => (
                  <li key={passenger.id}>
                    <span className={styles.personName}>{passenger.name}</span>
                    {passenger.code && <span className={styles.muted}> · {passenger.code}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.column}>
          <section className={`${styles.card} ${styles.mapCard}`} aria-labelledby="position-title">
            <h2 id="position-title" className={styles.cardTitle}>
              Posición
            </h2>
            <Link to={historyPath(vehicle.id)} className={styles.historyLink}>
              Ver historial de recorrido
            </Link>
            {located.length === 0 ? (
              <p className={styles.muted}>Este vehículo todavía no ha reportado una posición válida.</p>
            ) : (
              <div className={styles.map}>
                <ErrorBoundary fallback={<StateMessage title="No pudimos mostrar el mapa" />}>
                  <Suspense fallback={<StateMessage loading title="Cargando mapa…" />}>
                    <VehiclesMap
                      vehicles={located}
                      selectedId={vehicle.id}
                      selectionSource={null}
                      onSelect={() => {}}
                      showDetailLink={false}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </section>

          <CustomFieldsPanel vehicleId={vehicle.id} fields={vehicle.custom_fields} canWrite={canWrite} />
        </div>
      </div>
    </>
  )
}
