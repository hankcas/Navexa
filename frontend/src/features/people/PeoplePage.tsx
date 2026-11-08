import { useState, type ReactNode } from 'react'

import { ApiError } from '../../shared/api/errors'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { Pagination } from '../../shared/ui/Pagination'
import { StateMessage } from '../../shared/ui/StateMessage'
import { TextField } from '../../shared/ui/TextField'
import { useToast } from '../../shared/ui/toast/toastContext'
import { hasPermission, type Permission } from '../auth/permissions'
import { useSession } from '../auth/session'
import { AssignVehicleDialog } from './AssignVehicleDialog'
import styles from './PeoplePage.module.css'
import { PeopleTable, type ExtraColumn } from './PeopleTable'
import { usePeopleMutations, usePeoplePage, type PeopleResource } from './queries'
import type { AssignmentFilter, Person } from './types'
import { usePeopleFilters } from './usePeopleFilters'
import { useVehiclesById } from './useVehicleNames'

const SEARCH_DELAY_MS = 300

const ASSIGNMENT_OPTIONS: { value: AssignmentFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'assigned', label: 'Con vehículo' },
  { value: 'unassigned', label: 'Sin vehículo' },
]

export interface FormDialogProps<T> {
  /** null: create a new one. */
  person: T | null
  open: boolean
  onClose: () => void
}

interface PeoplePageProps<T extends Person, Input> {
  resource: PeopleResource<T, Input>
  title: string
  /** Lower case, e.g. "conductor". */
  singular: string
  /** Lower case, e.g. "conductores". */
  plural: string
  searchLabel: string
  writePermission: Permission
  extraColumns?: ExtraColumn<T>[]
  warnIfVehicleHasDriver?: boolean
  renderForm: (props: FormDialogProps<T>) => ReactNode
}

type FormState<T> = { person: T | null } | null

/**
 * List page shared by drivers and passengers: search, filter by assignment, pagination, and
 * the actions to create, edit, assign a vehicle and delete (RF-08, RF-09, RF-16, RF-17).
 */
export function PeoplePage<T extends Person, Input>({
  resource,
  title,
  singular,
  plural,
  searchLabel,
  writePermission,
  extraColumns,
  warnIfVehicleHasDriver,
  renderForm,
}: PeoplePageProps<T, Input>) {
  const { data: user } = useSession()
  const canWrite = hasPermission(user, writePermission)
  const toast = useToast()

  const { filters, update } = usePeopleFilters()
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DELAY_MS)
  const people = usePeoplePage(resource, { ...filters, search: debouncedSearch })
  const vehicles = useVehiclesById()
  const mutations = usePeopleMutations(resource)

  const [form, setForm] = useState<FormState<T>>(null)
  const [assigning, setAssigning] = useState<T | null>(null)
  const [unassigning, setUnassigning] = useState<T | null>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const hasFilters = Boolean(filters.search || filters.assignment !== 'all')

  function closeAssign() {
    mutations.assign.reset()
    setAssigning(null)
  }

  function closeUnassign() {
    mutations.unassign.reset()
    setUnassigning(null)
  }

  function closeDelete() {
    mutations.remove.reset()
    setDeleting(null)
  }

  return (
    <>
      <title>{`${title} · Navexa`}</title>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {people.data && (
            <p className={styles.total} aria-live="polite">
              {people.data.total} {people.data.total === 1 ? singular : plural}
              {people.isFetching && <span className={styles.updating}> · Actualizando…</span>}
            </p>
          )}
        </div>
        {canWrite && <Button onClick={() => setForm({ person: null })}>Nuevo {singular}</Button>}
      </header>

      <section className={styles.card} aria-label={`Lista de ${plural}`}>
        <div className={styles.toolbar}>
          <TextField
            className={styles.search}
            label={searchLabel}
            type="search"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            maxLength={100}
          />
          <fieldset className={styles.filter}>
            <legend className={styles.legend}>Vehículo</legend>
            <div className={styles.chips}>
              {ASSIGNMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.assignment === option.value}
                  onClick={() => update({ assignment: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {people.isPending ? (
          <StateMessage loading title={`Cargando ${plural}…`} />
        ) : people.isError ? (
          <StateMessage
            title={`No pudimos cargar los ${plural}`}
            detail={people.error instanceof ApiError ? people.error.detail : undefined}
            action={<Button onClick={() => void people.refetch()}>Reintentar</Button>}
          />
        ) : people.data.items.length === 0 ? (
          <StateMessage
            title={hasFilters ? `Ningún ${singular} coincide con tu búsqueda` : `Aún no hay ${plural}`}
            detail={
              hasFilters
                ? 'Prueba con otra búsqueda o con otro filtro.'
                : canWrite
                  ? `Crea el primero con el botón «Nuevo ${singular}».`
                  : `Cuando se registren ${plural}, aparecerán aquí.`
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => update({ search: '', assignment: 'all' })}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PeopleTable
              people={people.data.items}
              caption={`Lista de ${plural}`}
              extraColumns={extraColumns}
              vehiclesById={vehicles.byId}
              canWrite={canWrite}
              onEdit={(person) => setForm({ person })}
              onAssign={setAssigning}
              onUnassign={setUnassigning}
              onDelete={setDeleting}
            />
            <Pagination
              label={`Paginación de ${plural}`}
              page={people.data.page}
              pages={people.data.pages}
              onChange={(page) => update({ page })}
            />
          </>
        )}
      </section>

      {canWrite && (
        <>
          {renderForm({ person: form?.person ?? null, open: form !== null, onClose: () => setForm(null) })}

          <AssignVehicleDialog
            person={assigning}
            vehicles={vehicles.list}
            singular={singular}
            warnIfVehicleHasDriver={warnIfVehicleHasDriver}
            pending={mutations.assign.isPending}
            error={mutations.assign.error}
            onClose={closeAssign}
            onAssign={(vehicleId) =>
              assigning &&
              mutations.assign.mutate(
                { id: assigning.id, vehicleId },
                {
                  onSuccess: (person) => {
                    const vehicle = vehicles.byId.get(vehicleId)?.name ?? 'el vehículo'
                    toast.success(`${person.name} quedó asignado a ${vehicle}.`)
                    closeAssign()
                  },
                },
              )
            }
          />

          <ConfirmDialog
            open={unassigning !== null}
            title="Quitar vehículo"
            confirmLabel="Quitar vehículo"
            pendingLabel="Quitando…"
            pending={mutations.unassign.isPending}
            error={mutations.unassign.error}
            onCancel={closeUnassign}
            onConfirm={() =>
              unassigning &&
              mutations.unassign.mutate(unassigning.id, {
                onSuccess: (person) => {
                  toast.success(`${person.name} ya no tiene vehículo asignado.`)
                  closeUnassign()
                },
              })
            }
          >
            <p>
              ¿Quitar a <strong>{unassigning?.name}</strong> de su vehículo? El cambio se guarda en la
              plataforma de rastreo.
            </p>
          </ConfirmDialog>

          <ConfirmDialog
            open={deleting !== null}
            title={`Eliminar ${singular}`}
            confirmLabel="Eliminar"
            pendingLabel="Eliminando…"
            pending={mutations.remove.isPending}
            error={mutations.remove.error}
            onCancel={closeDelete}
            onConfirm={() =>
              deleting &&
              mutations.remove.mutate(deleting.id, {
                onSuccess: () => {
                  toast.success(`${deleting.name} fue eliminado.`)
                  closeDelete()
                },
              })
            }
          >
            <p>
              ¿Eliminar a <strong>{deleting?.name}</strong>? Se borra de la plataforma de rastreo, junto con
              sus campos personalizados, y no se puede deshacer.
            </p>
          </ConfirmDialog>
        </>
      )}
    </>
  )
}
