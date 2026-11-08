import { PERMISSIONS } from '../auth/permissions'
import { PeoplePage } from '../people/PeoplePage'
import { driversResource } from '../people/resources'
import { DriverFormDialog } from './DriverFormDialog'

/** RF-16, RF-17, RF-18: drivers read from and written to Wialon. */
export function DriversPage() {
  return (
    <PeoplePage
      resource={driversResource}
      title="Conductores"
      singular="conductor"
      plural="conductores"
      searchLabel="Buscar por nombre, código o teléfono"
      writePermission={PERMISSIONS.driversWrite}
      warnIfVehicleHasDriver
      extraColumns={[
        {
          header: 'Teléfono',
          render: (driver) => driver.phone ?? 'Sin teléfono',
        },
      ]}
      renderForm={(props) => <DriverFormDialog {...props} />}
    />
  )
}
