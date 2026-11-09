import {
  ApiError,
  errorFromResponse,
  interruptedRequestError,
  serverUnavailableError,
} from './errors'
import { setServerStatus } from './serverStatus'

const API_PREFIX = '/api/v1'
const HEALTH_URL = '/api/health'

/** After this long without an answer we tell the user the server may be starting. */
const SLOW_RESPONSE_MS = 4_000
/** Upper bound for a single request; a cold start on Render takes around 50 seconds. */
const REQUEST_TIMEOUT_MS = 70_000
const HEALTH_CHECK_TIMEOUT_MS = 20_000
/** How long we keep waiting for the backend to wake up before giving up. */
const WAKE_UP_DEADLINE_MS = 150_000
/** Exponential backoff between health checks, capped at the last value. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000]

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  /** Replay a non-GET request after a wake-up. Only for calls that are safe to repeat. */
  retryAfterWakeUp?: boolean
  /** Do not try to renew the session on 401 (login and refresh themselves). */
  skipSessionRefresh?: boolean
}

let sessionExpiredHandler: () => void = () => {}

/** Registered by the auth feature, so this layer does not depend on it. */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await sendWithWakeUp(path, options)

  if (response.status === 401 && !options.skipSessionRefresh && (await refreshSession())) {
    response = await sendWithWakeUp(path, options)
  }

  if (!response.ok) throw await errorFromResponse(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

let wakeUp: Promise<boolean> | null = null

/** Polls the health endpoint until the backend answers. Concurrent callers share one wait. */
export function waitForServer(): Promise<boolean> {
  wakeUp ??= pollHealth().finally(() => {
    wakeUp = null
  })
  return wakeUp
}

let refreshing: Promise<boolean> | null = null

/** Renews the access cookie. Concurrent 401s share one refresh call. */
function refreshSession(): Promise<boolean> {
  refreshing ??= apiRequest<unknown>('/auth/refresh', {
    method: 'POST',
    skipSessionRefresh: true,
    retryAfterWakeUp: true,
  })
    .then(
      () => true,
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          sessionExpiredHandler()
          return false
        }
        throw error
      },
    )
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function sendWithWakeUp(path: string, options: RequestOptions): Promise<Response> {
  const first = await send(path, options)
  if (first) return first

  if (!(await waitForServer())) throw serverUnavailableError()

  const method = options.method ?? 'GET'
  if (method !== 'GET' && !options.retryAfterWakeUp) throw interruptedRequestError()

  const second = await send(path, options)
  if (!second) throw serverUnavailableError()
  return second
}

/** Returns the response when it comes from our API, or null when the backend was not reached. */
async function send(path: string, options: RequestOptions): Promise<Response | null> {
  const slowTimer = setTimeout(() => setServerStatus('waking'), SLOW_RESPONSE_MS)
  try {
    const response = await fetch(API_PREFIX + path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: requestHeaders(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!isFromOurApi(response)) return null
    setServerStatus('online')
    return response
  } catch {
    return null
  } finally {
    clearTimeout(slowTimer)
  }
}

const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'X-CSRF-Token'

/** Reads one cookie the backend left readable on purpose (the session cookies are HttpOnly). */
function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

/**
 * Every state-changing request carries the CSRF token in a header (SEG-11). It is read on each
 * send, so a request replayed after a login or refresh uses the current token.
 */
function requestHeaders(options: RequestOptions): Record<string, string> | undefined {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if ((options.method ?? 'GET') !== 'GET') {
    const token = readCookie(CSRF_COOKIE)
    if (token) headers[CSRF_HEADER] = token
  }
  return Object.keys(headers).length > 0 ? headers : undefined
}

/**
 * Our backend always answers JSON (or 204). An HTML or text answer comes from the proxy or from
 * Render while the service is asleep, so it means the backend was not reached.
 */
function isFromOurApi(response: Response): boolean {
  if (response.status === 204) return true
  return (response.headers.get('Content-Type') ?? '').includes('json')
}

async function pollHealth(): Promise<boolean> {
  const startedAt = Date.now()
  const slowTimer = setTimeout(() => setServerStatus('waking'), SLOW_RESPONSE_MS)
  try {
    for (let attempt = 0; ; attempt++) {
      if (await isHealthy()) {
        setServerStatus('online')
        return true
      }
      if (Date.now() - startedAt >= WAKE_UP_DEADLINE_MS) {
        setServerStatus('unavailable')
        return false
      }
      setServerStatus('waking')
      await delay(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)])
    }
  } finally {
    clearTimeout(slowTimer)
  }
}

async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    })
    return response.ok && isFromOurApi(response)
  } catch {
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
