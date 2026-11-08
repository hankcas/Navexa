import type { ReactNode } from 'react'

import { Button } from './Button'
import { Dialog } from './Dialog'
import { FormAlert } from './FormAlert'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** Text while the action runs, e.g. "Eliminando…". */
  pendingLabel: string
  pending: boolean
  error?: unknown
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before a destructive action and shows the failure if it happens (UX-04). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={pending ? () => {} : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={pending} loadingText={pendingLabel}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormAlert error={error} />
      {children}
    </Dialog>
  )
}
