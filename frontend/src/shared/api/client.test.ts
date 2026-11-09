import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ClientModule = typeof import('./client')
type StatusModule = typeof import('./serverStatus')

type Reply = Response | Error | (() => Promise<Response>)

let client: ClientModule
let status: StatusModule
let replies: Map<string, Reply[]>
let fetchMock: ReturnType<typeof vi.fn>

function json(statusCode: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': contentType },
  })
}

function html(statusCode: number): Response {
  return new Response('<html>Service waking up</html>', {
    status: statusCode,
    headers: { 'Content-Type': 'text/html' },
  })
}

const healthy = () => json(200, { status: 'ok' })
const networkError = () => new TypeError('Failed to fetch')

/** Queues the answers that fetch gives, in order, for one URL. The last one repeats. */
function reply(url: string, ...answers: Reply[]) {
  replies.set(url, answers)
}

function callsTo(url: string): number {
  return fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  client = await import('./client')
  status = await import('./serverStatus')
  replies = new Map()
  fetchMock = vi.fn(async (url: string) => {
    const queue = replies.get(url)
    if (!queue || queue.length === 0) throw new Error(`Unexpected fetch to ${url}`)
    const answer = queue.length > 1 ? queue.shift()! : queue[0]
    if (answer instanceof Error) throw answer
    if (typeof answer === 'function') return answer()
    return answer.clone()
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('returns the parsed JSON of a successful response', async () => {
    reply('/api/v1/vehicles', json(200, { total: 2 }))

    await expect(client.apiRequest('/vehicles')).resolves.toEqual({ total: 2 })
  })

  it('turns Problem Details into an ApiError with the backend message and field errors', async () => {
    reply(
      '/api/v1/users',
      json(
        422,
        {
          title: 'Datos inválidos',
          detail: 'Uno o más parámetros no son válidos.',
          errors: [{ field: 'email', message: 'Correo inválido' }],
        },
        'application/problem+json',
      ),
    )

    await expect(client.apiRequest('/users', { method: 'POST', body: {} })).rejects.toMatchObject({
      kind: 'response',
      status: 422,
      title: 'Datos inválidos',
      detail: 'Uno o más parámetros no son válidos.',
      fieldErrors: [{ field: 'email', message: 'Correo inválido' }],
    })
  })

  it('does not treat a 503 from our backend as a cold start', async () => {
    reply(
      '/api/v1/vehicles',
      json(503, { title: 'Servicio externo no disponible', detail: 'Wialon caído' }, 'application/problem+json'),
    )

    await expect(client.apiRequest('/vehicles')).rejects.toMatchObject({ kind: 'response', status: 503 })
    expect(callsTo('/api/health')).toBe(0)
  })

  it('waits for the server to wake up and replays a GET', async () => {
    reply('/api/v1/vehicles', html(502), json(200, { total: 65 }))
    reply('/api/health', networkError(), html(503), healthy())

    const request = client.apiRequest('/vehicles')
    await vi.advanceTimersByTimeAsync(0)
    expect(status.getServerStatus()).toBe('waking')

    await vi.runAllTimersAsync()

    await expect(request).resolves.toEqual({ total: 65 })
    expect(callsTo('/api/health')).toBe(3)
    expect(status.getServerStatus()).toBe('online')
  })

  it('does not replay a POST after a wake-up, because it may have been applied', async () => {
    reply('/api/v1/users', networkError())
    reply('/api/health', healthy())

    const request = client.apiRequest('/users', { method: 'POST', body: {} })
    const assertion = expect(request).rejects.toMatchObject({ kind: 'interrupted' })
    await vi.runAllTimersAsync()

    await assertion
    expect(callsTo('/api/v1/users')).toBe(1)
  })

  it('replays a POST marked as safe to repeat', async () => {
    reply('/api/v1/auth/login', html(504), json(200, { id: 1 }))
    reply('/api/health', healthy())

    const request = client.apiRequest('/auth/login', { method: 'POST', body: {}, retryAfterWakeUp: true })
    await vi.runAllTimersAsync()

    await expect(request).resolves.toEqual({ id: 1 })
    expect(callsTo('/api/v1/auth/login')).toBe(2)
  })

  it('gives up after the deadline and reports the server as unavailable', async () => {
    reply('/api/v1/vehicles', networkError())
    reply('/api/health', networkError())

    const request = client.apiRequest('/vehicles')
    const assertion = expect(request).rejects.toMatchObject({ kind: 'unavailable' })
    await vi.runAllTimersAsync()

    await assertion
    expect(status.getServerStatus()).toBe('unavailable')
  })

  it('marks the server as waking when a response is slow, and online when it arrives', async () => {
    const slowResponse = () =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(json(200, { ok: true })), 6_000))
    reply('/api/v1/vehicles', slowResponse)

    const request = client.apiRequest('/vehicles')
    await vi.advanceTimersByTimeAsync(4_500)
    expect(status.getServerStatus()).toBe('waking')

    await vi.advanceTimersByTimeAsync(2_000)
    await expect(request).resolves.toEqual({ ok: true })
    expect(status.getServerStatus()).toBe('online')
  })
})

describe('session refresh', () => {
  const unauthorized = () => json(401, { title: 'No autenticado', detail: 'La sesión expiró.' }, 'application/problem+json')

  it('refreshes once for concurrent 401s and retries each request', async () => {
    reply('/api/v1/vehicles', unauthorized(), json(200, { total: 65 }))
    reply('/api/v1/auth/me', unauthorized(), json(200, { id: 1 }))
    reply('/api/v1/auth/refresh', json(200, { id: 1 }))

    const [vehicles, me] = await Promise.all([
      client.apiRequest('/vehicles'),
      client.apiRequest('/auth/me'),
    ])

    expect(vehicles).toEqual({ total: 65 })
    expect(me).toEqual({ id: 1 })
    expect(callsTo('/api/v1/auth/refresh')).toBe(1)
  })

  it('notifies the session expiry when the refresh is rejected', async () => {
    const expired = vi.fn()
    client.onSessionExpired(expired)
    reply('/api/v1/vehicles', unauthorized())
    reply('/api/v1/auth/refresh', unauthorized())

    await expect(client.apiRequest('/vehicles')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
  })

  it('does not try to refresh when the caller opts out, like the login form', async () => {
    reply('/api/v1/auth/login', unauthorized())

    await expect(
      client.apiRequest('/auth/login', { method: 'POST', body: {}, skipSessionRefresh: true }),
    ).rejects.toMatchObject({ status: 401, detail: 'La sesión expiró.' })
    expect(callsTo('/api/v1/auth/refresh')).toBe(0)
  })
})

describe('CSRF token', () => {
  function headersOfCall(index: number): Record<string, string> {
    const init = fetchMock.mock.calls[index][1] as RequestInit
    return (init.headers ?? {}) as Record<string, string>
  }

  afterEach(() => {
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('sends the cookie value in the X-CSRF-Token header on writes', async () => {
    document.cookie = 'csrf_token=abc.123; path=/'
    reply('/api/v1/drivers', json(201, { id: '1-1' }))

    await client.apiRequest('/drivers', { method: 'POST', body: { name: 'Ana' } })

    expect(headersOfCall(0)).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'abc.123' })
  })

  it('also protects writes without a body, like DELETE', async () => {
    document.cookie = 'csrf_token=abc.123; path=/'
    reply('/api/v1/drivers/1-1', new Response(null, { status: 204 }))

    await client.apiRequest('/drivers/1-1', { method: 'DELETE' })

    expect(headersOfCall(0)).toEqual({ 'X-CSRF-Token': 'abc.123' })
  })

  it('does not send it on reads', async () => {
    document.cookie = 'csrf_token=abc.123; path=/'
    reply('/api/v1/vehicles', json(200, { total: 1 }))

    await client.apiRequest('/vehicles')

    expect(headersOfCall(0)).toEqual({})
  })
})

describe('apiDownload', () => {
  function csv(filename?: string): Response {
    const headers: Record<string, string> = { 'Content-Type': 'text/csv; charset=utf-8' }
    if (filename) headers['Content-Disposition'] = `attachment; filename="${filename}"`
    return new Response('﻿Nombre\r\nCamión 01\r\n', { headers })
  }

  it('takes a CSV as an answer of our API, not as a sleeping server', async () => {
    reply('/api/v1/vehicles/export', csv('vehiculos-2026-11-08.csv'))

    const file = await client.apiDownload('/vehicles/export', 'vehiculos.csv')

    expect(file.filename).toBe('vehiculos-2026-11-08.csv')
    expect(await file.blob.text()).toContain('Camión 01')
    expect(callsTo('/api/health')).toBe(0)
  })

  it('uses the fallback name when the backend suggests none', async () => {
    reply('/api/v1/vehicles/export', csv())
    expect((await client.apiDownload('/vehicles/export', 'vehiculos.csv')).filename).toBe('vehiculos.csv')
  })

  it('fails with the Problem Details of the backend', async () => {
    reply(
      '/api/v1/vehicles/export',
      json(403, { title: 'Acceso denegado', detail: 'Sin permiso.' }, 'application/problem+json'),
    )
    await expect(client.apiDownload('/vehicles/export', 'x.csv')).rejects.toMatchObject({ status: 403 })
  })
})
