/**
 * Tiny store with the backend availability, read by the UI through useSyncExternalStore.
 * - online: the last request reached the backend.
 * - waking: the backend is slow or asleep (Render free plan) and we are waiting for it.
 * - unavailable: we gave up waiting.
 */
export type ServerStatus = 'online' | 'waking' | 'unavailable'

let status: ServerStatus = 'online'
const listeners = new Set<() => void>()

export function getServerStatus(): ServerStatus {
  return status
}

export function setServerStatus(next: ServerStatus): void {
  if (next === status) return
  status = next
  listeners.forEach((listener) => listener())
}

export function subscribeToServerStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
