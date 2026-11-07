import { useId, useState, type ComponentProps, type ReactNode } from 'react'

import styles from './TextField.module.css'

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string
  error?: string
  hint?: ReactNode
  /** Control placed inside the input, on its right edge (for example a show/hide button). */
  endAdornment?: ReactNode
}

/** Labelled input that links its hint and error to the input for screen readers. */
export function TextField({ label, error, hint, endAdornment, className, ...inputProps }: TextFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={[styles.input, endAdornment && styles.withAdornment].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {endAdornment && <div className={styles.adornment}>{endAdornment}</div>}
      </div>
      {hint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'endAdornment'>

/** Password input with a button to show or hide what was typed. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  const toggle = (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? 'Ocultar' : 'Mostrar'}
      <span className="visually-hidden"> {props.label.toLowerCase()}</span>
    </button>
  )

  return <TextField type={visible ? 'text' : 'password'} endAdornment={toggle} {...props} />
}
