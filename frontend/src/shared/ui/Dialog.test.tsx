import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'
import { Dialog } from './Dialog'
import { ToastProvider } from './toast/ToastProvider'
import { useToast } from './toast/toastContext'

describe('Dialog', () => {
  it('shows its content with an accessible name only while open', () => {
    const { rerender } = render(
      <Dialog open={false} title="Nuevo conductor" onClose={() => {}}>
        <p>Formulario</p>
      </Dialog>,
    )
    expect(screen.queryByText('Formulario')).not.toBeInTheDocument()

    rerender(
      <Dialog open title="Nuevo conductor" onClose={() => {}}>
        <p>Formulario</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Nuevo conductor' })).toBeInTheDocument()
    expect(screen.getByText('Formulario')).toBeInTheDocument()
  })

  it('closes with the close button', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Nuevo conductor" onClose={onClose}>
        <p>Formulario</p>
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ConfirmDialog', () => {
  it('runs the action only after the user confirms', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Eliminar conductor"
        confirmLabel="Eliminar"
        pendingLabel="Eliminando…"
        pending={false}
        onConfirm={onConfirm}
        onCancel={() => {}}
      >
        ¿Seguro?
      </ConfirmDialog>,
    )
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

describe('Toasts', () => {
  function Trigger() {
    const toast = useToast()
    return (
      <>
        <button onClick={() => toast.success('Conductor creado')}>ok</button>
        <button onClick={() => toast.error('No se pudo guardar')}>fail</button>
      </>
    )
  }

  it('announces successes as status and errors as alert, and can be dismissed', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'ok' }))
    await userEvent.click(screen.getByRole('button', { name: 'fail' }))

    expect(screen.getByRole('status')).toHaveTextContent('Conductor creado')
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')

    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar notificación' })[0])
    expect(screen.queryByText('Conductor creado')).not.toBeInTheDocument()
  })
})
