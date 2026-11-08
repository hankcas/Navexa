import { PATHS } from '../../app/paths'
import { ApiError } from '../../shared/api/errors'
import { Button } from '../../shared/ui/Button'
import { StateMessage } from '../../shared/ui/StateMessage'
import { formatRelative } from '../vehicles/format'
import type { Segment } from './charts'
import styles from './Dashboard.module.css'
import { DonutChart } from './DonutChart'
import { KpiCard } from './KpiCard'
import { useDashboardSummary } from './queries'
import { StackedBar } from './StackedBar'

/** KPIs and charts of the fleet (RF-23). Colors are the same ones the map uses. */
export function DashboardOverview() {
  const summary = useDashboardSummary()

  if (summary.isPending) return <StateMessage loading title="Calculando los indicadores…" />
  if (summary.isError) {
    return (
      <StateMessage
        title="No pudimos cargar los indicadores"
        detail={summary.error instanceof ApiError ? summary.error.detail : undefined}
        action={<Button onClick={() => void summary.refetch()}>Reintentar</Button>}
      />
    )
  }

  const { vehicles, drivers, passengers, generated_at } = summary.data
  const byStatus: Segment[] = [
    { key: 'moving', label: 'En movimiento', value: vehicles.by_status.moving, color: 'var(--status-moving)' },
    { key: 'stopped', label: 'Detenidos', value: vehicles.by_status.stopped, color: 'var(--status-stopped)' },
    { key: 'offline', label: 'Sin señal', value: vehicles.by_status.offline, color: 'var(--status-offline)' },
    {
      key: 'no_position',
      label: 'Sin posición',
      value: vehicles.by_status.no_position,
      color: 'var(--status-no-position)',
    },
  ]
  const coverage: Segment[] = [
    { key: 'with', label: 'Con conductor', value: vehicles.with_driver, color: 'var(--teal-700)' },
    { key: 'without', label: 'Sin conductor', value: vehicles.without_driver, color: 'var(--gray-500)' },
  ]

  return (
    <>
      <ul className={styles.kpis} aria-label="Indicadores principales">
        <li>
          <KpiCard label="Vehículos" value={vehicles.total} detail="En la flota" to={PATHS.vehicles} />
        </li>
        <li>
          <KpiCard
            label="En movimiento"
            value={vehicles.by_status.moving}
            detail="Ahora mismo"
            accent="var(--status-moving)"
            to={`${PATHS.vehicles}?estado=moving`}
          />
        </li>
        <li>
          <KpiCard
            label="Sin señal"
            value={vehicles.by_status.offline}
            detail="Más de una hora sin reportar"
            accent="var(--status-offline)"
            to={`${PATHS.vehicles}?estado=offline`}
          />
        </li>
        <li>
          <KpiCard
            label="Conductores"
            value={drivers.total}
            detail={`${drivers.assigned} con vehículo`}
            accent="var(--teal-700)"
            to={PATHS.drivers}
          />
        </li>
        <li>
          <KpiCard
            label="Pasajeros"
            value={passengers.total}
            detail={`${passengers.assigned} con vehículo`}
            accent="var(--red-950)"
            to={PATHS.passengers}
          />
        </li>
      </ul>

      <div className={styles.charts}>
        <DonutChart title="Vehículos por estado" segments={byStatus} centerLabel="vehículos" />
        <StackedBar
          title="Vehículos con conductor asignado"
          description="Según los conductores vinculados en la plataforma de rastreo."
          segments={coverage}
        />
      </div>

      <p className={styles.updated}>
        Actualizado {formatRelative(generated_at)}
        {summary.isFetching && ' · Actualizando…'}
      </p>
    </>
  )
}
