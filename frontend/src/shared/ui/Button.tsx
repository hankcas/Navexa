import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'

import styles from './Button.module.css'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'

interface StyleOptions {
  variant?: Variant
  block?: boolean
}

function buttonClassName({ variant = 'primary', block = false }: StyleOptions, extra?: string): string {
  return [styles.button, styles[variant], block && styles.block, extra].filter(Boolean).join(' ')
}

interface ButtonProps extends ComponentProps<'button'>, StyleOptions {
  /** Shows a spinner, disables the button and announces the work in progress. */
  loading?: boolean
  loadingText?: string
}

export function Button({
  variant,
  block,
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleOptions

/** A navigation link that looks like a button. */
export function ButtonLink({ variant, block, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, block }, className)} {...props} />
}
