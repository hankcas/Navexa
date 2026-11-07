import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { PATHS } from '../../app/paths'
import { waitForServer } from '../../shared/api/client'
import { applyServerFieldErrors } from '../../shared/forms/applyServerFieldErrors'
import { Button } from '../../shared/ui/Button'
import { FormAlert } from '../../shared/ui/FormAlert'
import { PasswordField, TextField } from '../../shared/ui/TextField'
import { AuthLayout } from './AuthLayout'
import styles from './authForms.module.css'
import { loginSchema, type LoginFormInput, type LoginFormValues } from './schemas'
import { useLogin } from './session'

export function LoginPage() {
  const login = useLogin()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Wake the backend while the user types, so the login request does not wait for a cold start.
  useEffect(() => {
    void waitForServer()
  }, [])

  // Redirection after a successful login is handled by RedirectIfAuthenticated.
  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onError: (error) => applyServerFieldErrors(error, setError, ['email', 'password']),
    }),
  )

  return (
    <AuthLayout
      title="Inicia sesión"
      subtitle="Ingresa con el correo y la contraseña que te asignó el administrador."
    >
      <title>Iniciar sesión · Navexa</title>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert error={login.error} title="No pudimos iniciar sesión" />
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="username"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className={styles.actions}>
          <Button type="submit" block loading={login.isPending} loadingText="Ingresando…">
            Ingresar
          </Button>
        </div>
        <Link to={PATHS.home} className={styles.backLink}>
          Volver al inicio
        </Link>
      </form>
    </AuthLayout>
  )
}
