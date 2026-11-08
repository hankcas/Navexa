import { vi } from 'vitest'

type Reply = Response | Error

export function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })
}

/**
 * Replaces fetch with fixed answers per URL. Each URL answers in order and repeats its last answer.
 * A key can start with a method ("POST /api/v1/drivers") to answer only that method.
 * Returns helpers so tests can check which requests were made.
 */
export function stubFetch(routes: Record<string, Reply[]>) {
  const queues = new Map(Object.entries(routes).map(([key, replies]) => [key, [...replies]]))
  const requests: { method: string; url: string; body: unknown }[] = []

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    requests.push({ method, url, body: init?.body ? JSON.parse(init.body as string) : undefined })
    const queue = queues.get(`${method} ${url}`) ?? queues.get(url)
    if (!queue || queue.length === 0) throw new Error(`Unexpected fetch: ${method} ${url}`)
    const answer = queue.length > 1 ? queue.shift()! : queue[0]
    if (answer instanceof Error) throw answer
    return answer.clone()
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    callsTo: (url: string) => requests.filter((request) => request.url === url).length,
    requestsTo: (method: string, url: string) =>
      requests.filter((request) => request.method === method && request.url === url),
  }
}
