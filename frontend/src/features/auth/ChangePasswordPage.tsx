import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { applyServerFieldErrors } from '../../shared/forms/applyServerFieldErrors'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FormAlert } from '../../shared/ui/FormAlert'
import { PasswordField } from '../../shared/ui/TextField'
import { AuthLayout } from './AuthLayout'
import styles from './authForms.module.css'
import { PasswordChecklist } from './PasswordChecklist'
import {
  changePasswordSchema,
  type ChangePasswordFormInput,
  type ChangePasswordFormValues,
} from './schemas'
import { useChangePassword, useLogout, useSession } from './session'

export interface PanelLocationState {
  passwordChanged?: boolean
}

export function ChangePasswordPage() {
  const { data: user } = useSession()
  const changePassword = useChangePassword()
  const logout = useLogout()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ChangePasswordFormInput, unknown, ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })
  const newPassword = useWatch({ control, name: 'new_password' })

  const mustChange = user?.must_change_password ?? false

  const onSubmit = handleSubmit(({ current_password, new_password }) =>
    changePassword.mutate(
      { current_password, new_password },
      {
        onSuccess: () => {
          const state: PanelLocationState = { passwordChanged: true }
          navigate(PATHS.panel, { replace: true, state })
        },
        onError: (error) =>
          applyServerFieldErrors(error, setError, ['current_password', 'new_password']),
      },
    ),
  )

  return (
    <AuthLayout
      title={mustChange ? 'Crea tu contraseña' : 'Cambiar contraseña'}
      subtitle={
        mustChange
          ? 'Por seguridad, reemplaza la contraseña temporal que te asignaron antes de continuar.'
          : 'Elige una contraseña nueva que no uses en otros sitios.'
      }
    >
      <title>Cambiar contraseña · Navexa</title>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert error={changePassword.error} title="No pudimos cambiar la contraseña" />
        <FormAlert error={logout.error} title="No pudimos cerrar la sesión" />
        <PasswordField
          label={mustChange ? 'Contraseña temporal' : 'Contraseña actual'}
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register('current_password')}
        />
        <PasswordField
          label="Nueva contraseña"
          autoComplete="new-password"
          error={errors.new_password?.message}
          hint={<PasswordChecklist password={newPassword} />}
          {...register('new_password')}
        />
        <PasswordField
          label="Confirma la nueva contraseña"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />
        <div className={styles.actions}>
          <Button type="submit" block loading={changePassword.isPending} loadingText="Guardando…">
            Guardar contraseña
          </Button>
          {mustChange ? (
            <Button
              variant="secondary"
              block
              loading={logout.isPending}
              loadingText="Cerrando sesión…"
              onClick={() => logout.mutate()}
            >
              Cerrar sesión
            </Button>
          ) : (
            <ButtonLink to={PATHS.panel} variant="secondary" block>
              Cancelar
            </ButtonLink>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
