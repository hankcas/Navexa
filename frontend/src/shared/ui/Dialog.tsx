import { useEffect, useId, useRef, type ReactNode } from 'react'

import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Buttons at the bottom, e.g. Cancel and Save. */
  footer?: ReactNode
}

/**
 * Modal built on the native <dialog>: showModal() traps the focus, Esc closes it and the page
 * behind becomes inert, so keyboard and screen reader users get a real modal (UX-03).
 */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: let React decide, so the open prop stays the single source of truth.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={onClose}>
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">Cerrar</span>
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
