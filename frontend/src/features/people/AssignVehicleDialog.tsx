import { useId, useState } from 'react'

import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { FormAlert } from '../../shared/ui/FormAlert'
import type { Vehicle } from '../vehicles/types'
import styles from './PeopleForms.module.css'
import type { Person } from './types'

interface AssignVehicleDialogProps {
  person: Person | null
  vehicles: Vehicle[]
  /** "conductor" or "pasajero", for the texts. */
  singular: string
  /** Drivers: tell the user when the chosen vehicle already has another driver. */
  warnIfVehicleHasDriver?: boolean
  pending: boolean
  error: unknown
  onAssign: (vehicleId: number) => void
  onClose: () => void
}

export function AssignVehicleDialog({
  person,
  vehicles,
  singular,
  warnIfVehicleHasDriver = false,
  pending,
  error,
  onAssign,
  onClose,
}: AssignVehicleDialogProps) {
  const selectId = useId()
  const [vehicleId, setVehicleId] = useState('')
  const sorted = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const chosen = vehicles.find((vehicle) => String(vehicle.id) === vehicleId)
  const currentDriver = warnIfVehicleHasDriver ? chosen?.driver : null

  function close() {
    setVehicleId('')
    onClose()
  }

  return (
    <Dialog
      open={person !== null}
      title={person?.vehicle_id ? `Cambiar el vehículo de ${person.name}` : `Asignar vehículo a ${person?.name ?? ''}`}
      onClose={pending ? () => {} : close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={!chosen}
            loading={pending}
            loadingText="Asignando…"
            onClick={() => chosen && onAssign(chosen.id)}
          >
            Asignar
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <FormAlert error={error} title="No pudimos asignar el vehículo" />
        <div className={styles.field}>
          <label htmlFor={selectId} className={styles.label}>
            Vehículo
          </label>
          <select
            id={selectId}
            className={styles.select}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">Elige un vehículo</option>
            {sorted.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id} disabled={vehicle.id === person?.vehicle_id}>
                {vehicle.name}
                {vehicle.id === person?.vehicle_id ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </div>
        {currentDriver && currentDriver.id !== person?.id && (
          <p className={styles.note} role="status">
            Este vehículo ya tiene a <strong>{currentDriver.name}</strong> como conductor. Al asignar, el
            vehículo mostrará al {singular} vinculado más recientemente.
          </p>
        )}
      </div>
    </Dialog>
  )
}
