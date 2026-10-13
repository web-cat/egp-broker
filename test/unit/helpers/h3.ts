import type { H3Event } from 'h3'

export interface MockH3EventOptions {
  method?: string
  url?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  query?: Record<string, string>
  body?: unknown
  context?: Record<string, unknown>
}

/**
 * Creates a typed mock H3Event fixture for server route and API endpoint unit tests.
 */
export function createMockH3Event(options: MockH3EventOptions = {}): H3Event {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {}
  }
  const res = {
    statusCode: 200,
    setHeader: () => {},
    getHeader: () => undefined,
    end: () => {}
  }
  return {
    node: { req, res },
    context: {
      params: options.params || {},
      query: options.query || {},
      matchedRoute: { path: options.url || '/' },
      ...options.context
    }
  } as unknown as H3Event
}
