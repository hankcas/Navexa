import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { ToastContext, type Toast, type ToastApi, type ToastTone } from './toastContext'
import styles from './Toasts.module.css'

const TOAST_DURATION_MS = 5_000

/**
 * Keeps the visible toasts and renders them in a live region, so screen readers announce
 * each one. Errors use role="alert" to be announced right away.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, tone, message }])
      setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.tone]}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <p>{toast.message}</p>
            <button type="button" className={styles.dismiss} onClick={() => dismiss(toast.id)}>
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">Cerrar notificación</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
