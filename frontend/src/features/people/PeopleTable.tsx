import type { ReactNode } from 'react'

import { Button } from '../../shared/ui/Button'
import type { Vehicle } from '../vehicles/types'
import styles from './PeopleTable.module.css'
import type { Person } from './types'

export interface ExtraColumn<T> {
  header: string
  render: (person: T) => ReactNode
}

interface PeopleTableProps<T extends Person> {
  people: T[]
  caption: string
  extraColumns?: ExtraColumn<T>[]
  vehiclesById: Map<number, Vehicle>
  /** Without write permission the actions column is not rendered at all. */
  canWrite: boolean
  onEdit: (person: T) => void
  onAssign: (person: T) => void
  onUnassign: (person: T) => void
  onDelete: (person: T) => void
}

function VehicleCell({ vehicleId, vehiclesById }: { vehicleId: number | null; vehiclesById: Map<number, Vehicle> }) {
  if (vehicleId === null) return <span className={styles.muted}>Sin vehículo</span>
  const vehicle = vehiclesById.get(vehicleId)
  // Wialon may bind a person to a unit this account cannot see (checked live: access denied).
  if (!vehicle) return <span className={styles.muted}>Vehículo no disponible (ID {vehicleId})</span>
  return <span>{vehicle.name}</span>
}

export function PeopleTable<T extends Person>({
  people,
  caption,
  extraColumns = [],
  vehiclesById,
  canWrite,
  onEdit,
  onAssign,
  onUnassign,
  onDelete,
}: PeopleTableProps<T>) {
  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Código</th>
            {extraColumns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
            <th scope="col">Vehículo</th>
            <th scope="col">Campos</th>
            {canWrite && (
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const fieldCount = Object.keys(person.custom_fields).length
            return (
              <tr key={person.id}>
                <th scope="row" className={styles.name}>
                  {person.name}
                </th>
                <td data-label="Código">{person.code ?? <span className={styles.muted}>Sin código</span>}</td>
                {extraColumns.map((column) => (
                  <td key={column.header} data-label={column.header}>
                    {column.render(person)}
                  </td>
                ))}
                <td data-label="Vehículo">
                  <VehicleCell vehicleId={person.vehicle_id} vehiclesById={vehiclesById} />
                </td>
                <td data-label="Campos">
                  {fieldCount === 0 ? (
                    <span className={styles.muted}>Ninguno</span>
                  ) : (
                    <span title={Object.keys(person.custom_fields).join(', ')}>
                      {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'}
                    </span>
                  )}
                </td>
                {canWrite && (
                  <td className={styles.actions}>
                    {/* aria-label repeats the visible text and adds who it acts on (WCAG 2.5.3). */}
                    <Button variant="ghost" aria-label={`Editar a ${person.name}`} onClick={() => onEdit(person)}>
                      Editar
                    </Button>
                    {person.vehicle_id === null ? (
                      <Button
                        variant="ghost"
                        aria-label={`Asignar vehículo a ${person.name}`}
                        onClick={() => onAssign(person)}
                      >
                        Asignar vehículo
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          aria-label={`Cambiar vehículo de ${person.name}`}
                          onClick={() => onAssign(person)}
                        >
                          Cambiar vehículo
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Quitar vehículo a ${person.name}`}
                          onClick={() => onUnassign(person)}
                        >
                          Quitar vehículo
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      className={styles.danger}
                      aria-label={`Eliminar a ${person.name}`}
                      onClick={() => onDelete(person)}
                    >
                      Eliminar
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
