import { useEffect, useRef } from 'react'

import { formatDateTime, formatRelative, formatSpeed, headingToCardinal } from './format'
import { StatusBadge } from './StatusBadge'
import type { Vehicle } from './types'
import styles from './VehiclesTable.module.css'

interface VehiclesTableProps {
  vehicles: Vehicle[]
  selectedId: number | null
  /** True when the selection came from the map, so the row scrolls into view. */
  scrollToSelected: boolean
  onSelect: (id: number) => void
}

/**
 * A real <table> for screen readers. Below 768 px each row becomes a card and every cell shows
 * its column name (data-label), so nothing scrolls sideways on a phone (UX-01).
 */
export function VehiclesTable({ vehicles, selectedId, scrollToSelected, onSelect }: VehiclesTableProps) {
  const selectedRow = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (scrollToSelected) selectedRow.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId, scrollToSelected])

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Vehículos de la flota. Elige un vehículo para ubicarlo en el mapa.
        </caption>
        <thead>
          <tr>
            <th scope="col">Vehículo</th>
            <th scope="col">Estado</th>
            <th scope="col">Velocidad</th>
            <th scope="col">Rumbo</th>
            <th scope="col">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => {
            const cardinal = headingToCardinal(vehicle.position?.heading ?? null)
            const selected = vehicle.id === selectedId
            return (
              <tr
                key={vehicle.id}
                ref={selected ? selectedRow : undefined}
                className={selected ? styles.selected : undefined}
              >
                <th scope="row" className={styles.name}>
                  <button
                    type="button"
                    className={styles.select}
                    aria-pressed={selected}
                    disabled={vehicle.position === null}
                    title={vehicle.position === null ? 'Sin posición para mostrar en el mapa' : undefined}
                    onClick={() => onSelect(vehicle.id)}
                  >
                    {vehicle.name}
                  </button>
                </th>
                <td data-label="Estado">
                  <StatusBadge status={vehicle.status} />
                </td>
                <td data-label="Velocidad">{formatSpeed(vehicle.speed_kmh)}</td>
                <td data-label="Rumbo">
                  {cardinal ? <abbr title={cardinal.long}>{cardinal.short}</abbr> : 'Sin dato'}
                </td>
                <td data-label="Actualizado">
                  <time
                    dateTime={vehicle.last_update ?? undefined}
                    title={formatDateTime(vehicle.last_update)}
                  >
                    {formatRelative(vehicle.last_update)}
                  </time>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
