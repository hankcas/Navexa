import { vi } from 'vitest'

type Reply = Response | Error

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })
}

/**
 * Replaces fetch with fixed answers per URL. Each URL answers in order and repeats its last answer.
 * Returns the mock so tests can check which URLs were called.
 */
export function stubFetch(routes: Record<string, Reply[]>) {
  const queues = new Map(Object.entries(routes).map(([url, replies]) => [url, [...replies]]))
  const fetchMock = vi.fn(async (url: string) => {
    const queue = queues.get(url)
    if (!queue || queue.length === 0) throw new Error(`Unexpected fetch to ${url}`)
    const answer = queue.length > 1 ? queue.shift()! : queue[0]
    if (answer instanceof Error) throw answer
    return answer.clone()
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    callsTo: (url: string) => fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length,
  }
}
