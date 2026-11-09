import type { DownloadedFile } from '../api/client'

/**
 * Hands a file to the browser's "download" flow. The file is already in memory (it came through
 * fetch, with the session and its errors handled), so a temporary blob: link is clicked and
 * freed right after.
 */
export function saveFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start the download after this tick; freeing it a moment later is safe.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
