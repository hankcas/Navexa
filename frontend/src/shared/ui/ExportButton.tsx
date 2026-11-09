import { useState } from 'react'

import { apiDownload } from '../api/client'
import { ApiError } from '../api/errors'
import { saveFile } from '../files/saveFile'
import { Button } from './Button'
import { useToast } from './toast/toastContext'

interface ExportButtonProps {
  /** API path with the filters on screen, e.g. /vehicles/export?status=moving. */
  path: string
  /** Used only if the backend does not suggest a name. */
  fallbackName: string
  /** What is downloaded, for the screen reader name: "Descargar CSV de vehículos". */
  what: string
}

/** Downloads the list on screen as a CSV for Excel (RF-25). */
export function ExportButton({ path, fallbackName, what }: ExportButtonProps) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function download() {
    setBusy(true)
    try {
      saveFile(await apiDownload(path, fallbackName))
      toast.success(`Se descargó el archivo de ${what}.`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : 'No pudimos descargar el archivo. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={() => void download()}
      loading={busy}
      loadingText="Preparando…"
      aria-label={`Descargar CSV de ${what}`}
    >
      Descargar CSV
    </Button>
  )
}
