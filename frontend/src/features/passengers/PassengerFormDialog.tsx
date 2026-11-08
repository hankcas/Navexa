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
import { passengersResource } from '../people/resources'
import type { Passenger } from '../people/types'
import { passengerFormSchema, type PassengerFormInput, type PassengerFormValues } from './passengerFormSchema'

function defaults(passenger: Passenger | null): PassengerFormInput {
  return {
    name: passenger?.name ?? '',
    code: passenger?.code ?? '',
    custom_fields: rowsFromRecord(passenger?.custom_fields ?? {}),
  }
}

export function PassengerFormDialog({ person: passenger, open, onClose }: FormDialogProps<Passenger>) {
  const { create, update } = usePeopleMutations(passengersResource)
  const mutation = passenger ? update : create
  const toast = useToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PassengerFormInput, unknown, PassengerFormValues>({
    resolver: zodResolver(passengerFormSchema),
    defaultValues: defaults(passenger),
  })

  // Each time the dialog opens, start from the passenger being edited (or empty to create).
  useEffect(() => {
    if (open) {
      reset(defaults(passenger))
      create.reset()
      update.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens or the target changes
  }, [open, passenger])

  const onSubmit = handleSubmit((values) => {
    const input = { ...values, custom_fields: recordFromRows(values.custom_fields) }
    const options = {
      onSuccess: (saved: Passenger) => {
        toast.success(passenger ? `Se guardaron los cambios de ${saved.name}.` : `${saved.name} fue creado.`)
        onClose()
      },
      onError: (error: unknown) => applyServerFieldErrors(error, setError, ['name', 'code']),
    }
    if (passenger) update.mutate({ id: passenger.id, input }, options)
    else create.mutate(input, options)
  })

  return (
    <Dialog
      open={open}
      title={passenger ? `Editar a ${passenger.name}` : 'Nuevo pasajero'}
      onClose={mutation.isPending ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="passenger-form" loading={mutation.isPending} loadingText="Guardando…">
            {passenger ? 'Guardar cambios' : 'Crear pasajero'}
          </Button>
        </>
      }
    >
      <form id="passenger-form" className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert error={mutation.error} title="No pudimos guardar el pasajero" />
        <TextField label="Nombre" autoComplete="off" error={errors.name?.message} {...register('name')} />
        <TextField
          label="Código"
          hint="Opcional. Debe ser único, por ejemplo el de su tarjeta de acceso."
          error={errors.code?.message}
          {...register('code')}
        />
        <p className={styles.note}>
          La plataforma de rastreo no guarda teléfono para los pasajeros. Usa los campos personalizados para
          datos como documento, ruta o contacto.
        </p>
        <CustomFieldsEditor control={control} register={register} errors={errors.custom_fields} />
      </form>
    </Dialog>
  )
}
