import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/errors'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { FormAlert } from '../../../shared/ui/FormAlert'
import { TextField } from '../../../shared/ui/TextField'
import { useToast } from '../../../shared/ui/toast/toastContext'
import styles from './VehicleDetailPage.module.css'
import { useCustomFieldMutations } from './queries'
import type { CustomField, CustomFieldInput } from './types'

interface CustomFieldsPanelProps {
  vehicleId: number
  fields: CustomField[]
  canWrite: boolean
}

type RowState =
  | { kind: 'idle' }
  | { kind: 'editing'; draft: CustomFieldInput }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'failed'; error: unknown; draft: CustomFieldInput }

function validate({ name, value }: CustomFieldInput): string | null {
  if (!name.trim()) return 'Escribe el nombre del campo.'
  if (name.trim().length > 50) return 'El nombre puede tener como máximo 50 caracteres.'
  if (value.trim().length > 200) return 'El valor puede tener como máximo 200 caracteres.'
  return null
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.detail : 'Ocurrió un error inesperado.'
}

/**
 * Custom fields of the vehicle, edited one at a time (RF-19). Each row shows its own state:
 * saving, saved, or failed with a retry (RF-20). Changes appear at once (RF-21).
 */
export function CustomFieldsPanel({ vehicleId, fields, canWrite }: CustomFieldsPanelProps) {
  const { update, create, remove } = useCustomFieldMutations(vehicleId)
  const toast = useToast()
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [newField, setNewField] = useState<CustomFieldInput>({ name: '', value: '' })
  const [newFieldError, setNewFieldError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CustomField | null>(null)

  const stateOf = (id: number): RowState => rows[id] ?? { kind: 'idle' }
  const setRow = (id: number, state: RowState) => setRows((current) => ({ ...current, [id]: state }))

  function save(field: CustomField, draft: CustomFieldInput) {
    const input = { name: draft.name.trim(), value: draft.value.trim() }
    setRow(field.id, { kind: 'saving' })
    update.mutate(
      { field, input },
      {
        onSuccess: () => setRow(field.id, { kind: 'saved' }),
        onError: (error) => setRow(field.id, { kind: 'failed', error, draft: input }),
      },
    )
  }

  function onCreate(event: FormEvent) {
    event.preventDefault()
    const problem = validate(newField)
    if (problem) {
      setNewFieldError(problem)
      return
    }
    setNewFieldError(null)
    create.mutate(
      { name: newField.name.trim(), value: newField.value.trim() },
      {
        onSuccess: (created) => {
          toast.success(`Se agregó el campo «${created.name}».`)
          setNewField({ name: '', value: '' })
        },
      },
    )
  }

  return (
    <section className={styles.card} aria-labelledby="custom-fields-title">
      <h2 id="custom-fields-title" className={styles.cardTitle}>
        Campos personalizados
      </h2>

      {fields.length === 0 ? (
        <p className={styles.muted}>Este vehículo no tiene campos personalizados.</p>
      ) : (
        <ul className={styles.fields}>
          {fields.map((field) => {
            const state = stateOf(field.id)
            const editing = state.kind === 'editing' ? state : null
            return (
              <li key={field.id} className={styles.field}>
                {editing ? (
                  <form
                    className={styles.fieldForm}
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!validate(editing.draft)) save(field, editing.draft)
                    }}
                  >
                    <TextField
                      label="Nombre"
                      value={editing.draft.name}
                      error={validate(editing.draft) ?? undefined}
                      onChange={(event) =>
                        setRow(field.id, { kind: 'editing', draft: { ...editing.draft, name: event.target.value } })
                      }
                    />
                    <TextField
                      label="Valor"
                      value={editing.draft.value}
                      onChange={(event) =>
                        setRow(field.id, { kind: 'editing', draft: { ...editing.draft, value: event.target.value } })
                      }
                    />
                    <div className={styles.fieldActions}>
                      <Button type="submit">Guardar</Button>
                      <Button variant="ghost" onClick={() => setRow(field.id, { kind: 'idle' })}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={styles.fieldText}>
                      <span className={styles.fieldName}>{field.name}</span>
                      <span className={styles.fieldValue}>{field.value || '—'}</span>
                    </div>
                    <p className={styles.fieldStatus} role="status">
                      {state.kind === 'saving' && 'Guardando…'}
                      {state.kind === 'saved' && 'Guardado'}
                    </p>
                    {state.kind === 'failed' && (
                      <div className={styles.fieldError} role="alert">
                        <p>No se guardó: {errorText(state.error)}</p>
                        <Button variant="secondary" onClick={() => save(field, state.draft)}>
                          Reintentar
                        </Button>
                      </div>
                    )}
                    {canWrite && state.kind !== 'saving' && (
                      <div className={styles.fieldActions}>
                        <Button
                          variant="ghost"
                          aria-label={`Editar el campo ${field.name}`}
                          onClick={() =>
                            setRow(field.id, { kind: 'editing', draft: { name: field.name, value: field.value } })
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className={styles.danger}
                          aria-label={`Eliminar el campo ${field.name}`}
                          onClick={() => setDeleting(field)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canWrite && (
        <form className={styles.newField} onSubmit={onCreate} noValidate>
          <h3 className={styles.subTitle}>Agregar campo</h3>
          <FormAlert error={create.error} title="No pudimos agregar el campo" />
          <TextField
            label="Nombre del campo nuevo"
            value={newField.name}
            error={newFieldError ?? undefined}
            maxLength={50}
            onChange={(event) => setNewField({ ...newField, name: event.target.value })}
          />
          <TextField
            label="Valor del campo nuevo"
            value={newField.value}
            maxLength={200}
            onChange={(event) => setNewField({ ...newField, value: event.target.value })}
          />
          <Button type="submit" loading={create.isPending} loadingText="Agregando…">
            Agregar campo
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar campo"
        confirmLabel="Eliminar"
        pendingLabel="Eliminando…"
        pending={remove.isPending}
        error={remove.error}
        onCancel={() => {
          remove.reset()
          setDeleting(null)
        }}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast.success(`Se eliminó el campo «${deleting.name}».`)
              setDeleting(null)
            },
            onError: () => toast.error('No se eliminó el campo. El valor anterior se restauró.'),
          })
        }
      >
        <p>
          ¿Eliminar el campo <strong>{deleting?.name}</strong>? Se borra de la plataforma de rastreo.
        </p>
      </ConfirmDialog>
    </section>
  )
}
