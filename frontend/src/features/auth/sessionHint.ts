/**
 * A "this browser logged in before" flag. It is not a token and grants nothing: the real session
 * is in HttpOnly cookies that JavaScript cannot read. It only lets us skip calling /auth/me (and
 * waking up the backend) for visitors who never logged in.
 * Storage can be blocked (private mode), so every access is wrapped in try/catch.
 */
const KEY = 'navexa.has_session'

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setSessionHint(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Without storage the user simply logs in again on the next visit.
  }
}

export function clearSessionHint(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clean.
  }
}
