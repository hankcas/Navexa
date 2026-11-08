import { PERMISSIONS } from '../auth/permissions'
import { PeoplePage } from '../people/PeoplePage'
import { passengersResource } from '../people/resources'
import { PassengerFormDialog } from './PassengerFormDialog'

/** RF-08, RF-09, RF-27, RF-28: passengers (Wialon "tags") read from and written to Wialon. */
export function PassengersPage() {
  return (
    <PeoplePage
      resource={passengersResource}
      title="Pasajeros"
      singular="pasajero"
      plural="pasajeros"
      searchLabel="Buscar por nombre, código o documento"
      writePermission={PERMISSIONS.passengersWrite}
      renderForm={(props) => <PassengerFormDialog {...props} />}
    />
  )
}
