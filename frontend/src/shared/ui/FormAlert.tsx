import { ApiError } from '../api/errors'
import styles from './FormAlert.module.css'

interface FormAlertProps {
  error: unknown
  /** Replaces the backend title when the form has a clearer one. */
  title?: string
}

/** Shows a failed request above a form. role="alert" makes screen readers announce it. */
export function FormAlert({ error, title }: FormAlertProps) {
  if (!error) return null

  const detail =
    error instanceof ApiError ? error.detail : 'Ocurrió un error inesperado. Intenta de nuevo.'
  const heading = title ?? (error instanceof ApiError ? error.title : 'Error inesperado')

  return (
    <div role="alert" className={styles.alert}>
      <p className={styles.title}>{heading}</p>
      <p>{detail}</p>
    </div>
  )
}
