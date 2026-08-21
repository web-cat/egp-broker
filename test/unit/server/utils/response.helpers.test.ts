import { describe, it, expect } from 'vitest'
import {
  createApiResponse,
  createCreatedResponse,
  createNoContentResponse,
  createDeletedResponse,
  badRequestError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  rateLimitError,
  serverError
} from '@@/server/utils/response.helpers'

describe('Response Helpers', () => {
  describe('createApiResponse', () => {
    it('creates 200 response with default status', () => {
      const res = createApiResponse({ test: true })
      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual({ test: true })
    })

    it('creates 201 created response', () => {
      const res = createCreatedResponse({ id: '123' })
      expect(res.statusCode).toBe(201)
      expect(res.data).toEqual({ id: '123' })
    })

    it('creates 204 no content response', () => {
      const res = createNoContentResponse()
      expect(res.statusCode).toBe(204)
      expect(res.data).toBeNull()
    })

    it('creates 204 deleted response', () => {
      const res = createDeletedResponse()
      expect(res.statusCode).toBe(204)
      expect(res.data).toBeNull()
    })
  })

  describe('Error Creators', () => {
    it('throws badRequestError with status 400', () => {
      expect(() => badRequestError()).toThrow()
    })

    it('throws unauthorizedError with status 401', () => {
      expect(() => unauthorizedError()).toThrow()
    })

    it('throws forbiddenError with status 403', () => {
      expect(() => forbiddenError()).toThrow()
    })

    it('throws notFoundError with status 404', () => {
      expect(() => notFoundError()).toThrow()
    })

    it('throws conflictError with status 409', () => {
      expect(() => conflictError()).toThrow()
    })

    it('throws rateLimitError with status 429', () => {
      expect(() => rateLimitError()).toThrow()
    })

    it('throws serverError with status 500', () => {
      expect(() => serverError()).toThrow()
    })
  })
})
