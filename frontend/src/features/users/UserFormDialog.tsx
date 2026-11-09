import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'

import { applyServerFieldErrors } from '../../shared/forms/applyServerFieldErrors'
import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import { FormAlert } from '../../shared/ui/FormAlert'
import { TextField } from '../../shared/ui/TextField'
import { useToast } from '../../shared/ui/toast/toastContext'
import { roleLabel } from '../auth/roles'
import formStyles from '../people/PeopleForms.module.css'
import { useRoles, useUserMutations } from './queries'
import type { ManagedUser, RoleName, UserWithTemporaryPassword } from './types'
import { userFormSchema, type UserFormInput, type UserFormValues } from './userFormSchema'

const ROLE_HELP: Record<RoleName, string> = {
  admin: 'Todo, incluida la gestión de usuarios y la auditoría.',
  operator: 'Ve y modifica conductores, pasajeros y campos; exporta datos.',
  viewer: 'Solo consulta: mapa, vehículos, conductores, pasajeros e historial.',
}

interface UserFormDialogProps {
  /** null: create a new user. */
  user: ManagedUser | null
  open: boolean
  /** The admin cannot change their own role (the backend refuses it too). */
  isSelf: boolean
  onClose: () => void
  onCreated: (result: UserWithTemporaryPassword) => void
}

export function UserFormDialog({ user, open, isSelf, onClose, onCreated }: UserFormDialogProps) {
  const roleId = useId()
  const roles = useRoles()
  const { create, update } = useUserMutations()
  const mutation = user ? update : create
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<UserFormInput, unknown, UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { email: '', full_name: '', role: 'viewer' },
  })
  const role = watch('role')

  useEffect(() => {
    if (open) {
      reset({ email: user?.email ?? '', full_name: user?.full_name ?? '', role: user?.role ?? 'viewer' })
      create.reset()
      update.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens or the target changes
  }, [open, user])

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) =>
      applyServerFieldErrors(error, setError, ['email', 'full_name', 'role'])
    if (user) {
      update.mutate(
        { id: user.id, input: { full_name: values.full_name, ...(isSelf ? {} : { role: values.role }) } },
        {
          onSuccess: (saved) => {
            toast.success(`Se guardaron los cambios de ${saved.full_name}.`)
            onClose()
          },
          onError,
        },
      )
    } else {
      create.mutate(values, {
        onSuccess: (result) => {
          onClose()
          onCreated(result)
        },
        onError,
      })
    }
  })

  return (
    <Dialog
      open={open}
      title={user ? `Editar a ${user.full_name}` : 'Nuevo usuario'}
      onClose={mutation.isPending ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={mutation.isPending} loadingText="Guardando…">
            {user ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form id="user-form" className={formStyles.form} onSubmit={onSubmit} noValidate>
        <FormAlert error={mutation.error} title="No pudimos guardar el usuario" />
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="off"
          readOnly={user !== null}
          hint={user ? 'El correo no se puede cambiar.' : 'Con este correo iniciará sesión.'}
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Nombre completo"
          autoComplete="off"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <div className={formStyles.field}>
          <label htmlFor={roleId} className={formStyles.label}>
            Rol
          </label>
          <select
            id={roleId}
            className={formStyles.select}
            disabled={isSelf}
            aria-describedby={`${roleId}-help`}
            {...register('role')}
          >
            {(roles.data ?? [{ name: 'admin' }, { name: 'operator' }, { name: 'viewer' }]).map((option) => (
              <option key={option.name} value={option.name}>
                {roleLabel(option.name)}
              </option>
            ))}
          </select>
          <p id={`${roleId}-help`} className={formStyles.note}>
            {isSelf ? 'No puedes cambiar tu propio rol.' : ROLE_HELP[role as RoleName]}
          </p>
        </div>
      </form>
    </Dialog>
  )
}
