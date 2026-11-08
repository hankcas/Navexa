import { formatDateTime, formatRelative, formatSpeed, headingToCardinal } from './format'
import { StatusBadge } from './StatusBadge'
import type { Vehicle } from './types'
import styles from './VehiclesTable.module.css'

/**
 * A real <table> for screen readers. Below 768 px each row becomes a card and every cell shows
 * its column name (data-label), so nothing scrolls sideways on a phone (UX-01).
 */
export function VehiclesTable({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">Vehículos de la flota</caption>
      <thead>
        <tr>
          <th scope="col">Vehículo</th>
          <th scope="col">Estado</th>
          <th scope="col">Velocidad</th>
          <th scope="col">Rumbo</th>
          <th scope="col">Última actualización</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map((vehicle) => {
          const cardinal = headingToCardinal(vehicle.position?.heading ?? null)
          return (
            <tr key={vehicle.id}>
              <th scope="row" className={styles.name}>
                {vehicle.name}
              </th>
              <td data-label="Estado">
                <StatusBadge status={vehicle.status} />
              </td>
              <td data-label="Velocidad">{formatSpeed(vehicle.speed_kmh)}</td>
              <td data-label="Rumbo">
                {cardinal ? <abbr title={cardinal.long}>{cardinal.short}</abbr> : 'Sin dato'}
              </td>
              <td data-label="Última actualización">
                <time dateTime={vehicle.last_update ?? undefined} title={formatDateTime(vehicle.last_update)}>
                  {formatRelative(vehicle.last_update)}
                </time>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
