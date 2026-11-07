import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { waitForServer } from '../api/client'
import { getServerStatus, subscribeToServerStatus } from '../api/serverStatus'
import styles from './ServerStatusBanner.module.css'
import { Spinner } from './Spinner'

/**
 * Tells the user when the backend is waking up or unreachable (DEP-04).
 * The live region is always in the page so screen readers announce changes to it.
 */
export function ServerStatusBanner() {
  const status = useSyncExternalStore(subscribeToServerStatus, getServerStatus)
  const queryClient = useQueryClient()

  async function retry() {
    if (await waitForServer()) await queryClient.invalidateQueries()
  }

  return (
    <div aria-live="polite" className={styles.region}>
      {status === 'waking' && (
        <div className={`${styles.banner} ${styles.waking}`}>
          <Spinner />
          <p>
            <strong>Iniciando el servidor…</strong> Se suspende cuando no se usa y puede tardar hasta un
            minuto en responder.
          </p>
        </div>
      )}
      {status === 'unavailable' && (
        <div className={`${styles.banner} ${styles.unavailable}`}>
          <p>
            <strong>No pudimos conectar con el servidor.</strong> Revisa tu conexión e inténtalo de nuevo.
          </p>
          <button type="button" className={styles.retry} onClick={() => void retry()}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
