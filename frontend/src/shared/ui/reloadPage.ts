/** Reloading is the safe retry: a failed screen may come from a file of an older deployment. */
export function reloadPage(): void {
  window.location.reload()
}
