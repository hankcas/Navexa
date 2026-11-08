import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { applyServerFieldErrors } from '../../shared/forms/applyServerFieldErrors'
import { CustomFieldsEditor } from '../../shared/forms/CustomFieldsEditor'
import { recordFromRows, rowsFromRecord } from '../../shared/forms/customFields'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { FormAlert } from '../../shared/ui/FormAlert'
import { TextField } from '../../shared/ui/TextField'
import { useToast } from '../../shared/ui/toast/toastContext'
import type { FormDialogProps } from '../people/PeoplePage'
import styles from '../people/PeopleForms.module.css'
import { usePeopleMutations } from '../people/queries'
import { driversResource } from '../people/resources'
import type { Driver } from '../people/types'
import { driverFormSchema, type DriverFormInput, type DriverFormValues } from './driverFormSchema'

function defaults(driver: Driver | null): DriverFormInput {
  return {
    name: driver?.name ?? '',
    code: driver?.code ?? '',
    phone: driver?.phone ?? '',
    description: driver?.description ?? '',
    custom_fields: rowsFromRecord(driver?.custom_fields ?? {}),
  }
}

export function DriverFormDialog({ person: driver, open, onClose }: FormDialogProps<Driver>) {
  const { create, update } = usePeopleMutations(driversResource)
  const mutation = driver ? update : create
  const toast = useToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DriverFormInput, unknown, DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: defaults(driver),
  })

  // Each time the dialog opens, start from the driver being edited (or empty to create).
  useEffect(() => {
    if (open) {
      reset(defaults(driver))
      create.reset()
      update.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens or the target changes
  }, [open, driver])

  const onSubmit = handleSubmit((values) => {
    const input = { ...values, custom_fields: recordFromRows(values.custom_fields) }
    const options = {
      onSuccess: (saved: Driver) => {
        toast.success(driver ? `Se guardaron los cambios de ${saved.name}.` : `${saved.name} fue creado.`)
        onClose()
      },
      onError: (error: unknown) =>
        applyServerFieldErrors(error, setError, ['name', 'code', 'phone', 'description']),
    }
    if (driver) update.mutate({ id: driver.id, input }, options)
    else create.mutate(input, options)
  })

  return (
    <Dialog
      open={open}
      title={driver ? `Editar a ${driver.name}` : 'Nuevo conductor'}
      onClose={mutation.isPending ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="driver-form" loading={mutation.isPending} loadingText="Guardando…">
            {driver ? 'Guardar cambios' : 'Crear conductor'}
          </Button>
        </>
      }
    >
      <form id="driver-form" className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert error={mutation.error} title="No pudimos guardar el conductor" />
        <TextField label="Nombre" autoComplete="off" error={errors.name?.message} {...register('name')} />
        <TextField
          label="Código"
          hint="Opcional. Por ejemplo, el de su llave de identificación."
          error={errors.code?.message}
          {...register('code')}
        />
        <TextField
          label="Teléfono"
          type="tel"
          inputMode="tel"
          hint="Opcional. Con indicativo, por ejemplo +573001234567."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <div className={styles.field}>
          <label htmlFor="driver-description" className={styles.label}>
            Descripción
          </label>
          <textarea
            id="driver-description"
            className={styles.textarea}
            aria-invalid={errors.description ? true : undefined}
            {...register('description')}
          />
          {errors.description && <p className={styles.note}>{errors.description.message}</p>}
        </div>
        <CustomFieldsEditor control={control} register={register} errors={errors.custom_fields} />
      </form>
    </Dialog>
  )
}
