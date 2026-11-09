import { useState } from 'react'

import { Button } from '../../shared/ui/Button'
import { Dialog } from '../../shared/ui/Dialog'
import styles from './Users.module.css'
import type { UserWithTemporaryPassword } from './types'

interface TemporaryPasswordDialogProps {
  result: UserWithTemporaryPassword | null
  /** Whether the user was just created or the password was reset, for the title. */
  action: 'created' | 'reset'
  onClose: () => void
}

/**
 * Shows the temporary password once. It lives only in React state while this dialog is open:
 * it is never logged, stored or sent anywhere else (SEG-02).
 */
export function TemporaryPasswordDialog({ result, action, onClose }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.temporary_password)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; the password is still visible to copy by hand.
      setCopied(false)
    }
  }

  function close() {
    setCopied(false)
    onClose()
  }

  return (
    <Dialog
      open={result !== null}
      title={action === 'created' ? 'Usuario creado' : 'Contraseña restablecida'}
      onClose={close}
      footer={<Button onClick={close}>Ya la guardé</Button>}
    >
      {result && (
        <div className={styles.passwordBox}>
          <p>
            Entrégale esta contraseña temporal a <strong>{result.user.full_name}</strong> ({result.user.email}
            ). Al entrar, el sistema le pedirá cambiarla.
          </p>
          <div className={styles.passwordRow}>
            <code className={styles.password}>{result.temporary_password}</code>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <p className={styles.warning} role="note">
            Solo se muestra esta vez. Si se pierde, restablécela de nuevo.
          </p>
        </div>
      )}
    </Dialog>
  )
}
