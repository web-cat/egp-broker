import { describe, it, expect } from 'vitest'
import { createMockH3Event } from './h3'

describe('createMockH3Event', () => {
  it('creates default GET mock event', () => {
    const event = createMockH3Event()
    expect(event.node?.req?.method).toBe('GET')
    expect(event.node?.req?.url).toBe('/')
    expect(event.context?.params).toEqual({})
  })

  it('populates custom method, url, params, and context', () => {
    const event = createMockH3Event({
      method: 'POST',
      url: '/api/test/123',
      params: { id: '123' },
      query: { search: 'alpha' },
      context: { customKey: 'customVal' }
    })
    expect(event.node?.req?.method).toBe('POST')
    expect(event.node?.req?.url).toBe('/api/test/123')
    expect(event.context?.params).toEqual({ id: '123' })
    expect(event.context?.query).toEqual({ search: 'alpha' })
    expect(event.context?.customKey).toBe('customVal')
  })
})
