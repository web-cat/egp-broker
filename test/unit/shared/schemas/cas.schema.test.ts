import { describe, it, expect } from 'vitest'
import {
  CasCallbackSchema,
  CasLoginSchema,
  CasServerPublicSchema
} from '@@/shared/schemas/cas.schema'

describe('CAS Schemas', () => {
  describe('CasCallbackSchema', () => {
    it('accepts valid callback params', () => {
      const result = CasCallbackSchema.safeParse({
        ticket: 'ST-12345',
        serverId: 'cuid123'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing ticket', () => {
      const result = CasCallbackSchema.safeParse({
        serverId: 'cuid123'
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty ticket', () => {
      const result = CasCallbackSchema.safeParse({
        ticket: '',
        serverId: 'cuid123'
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing serverId', () => {
      const result = CasCallbackSchema.safeParse({
        ticket: 'ST-12345'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('CasLoginSchema', () => {
    it('accepts valid login params', () => {
      const result = CasLoginSchema.safeParse({
        serverId: 'cuid123'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing serverId', () => {
      const result = CasLoginSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects empty serverId', () => {
      const result = CasLoginSchema.safeParse({ serverId: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('CasServerPublicSchema', () => {
    it('accepts valid public server data', () => {
      const result = CasServerPublicSchema.safeParse({
        id: 'cuid123',
        name: 'Virginia Tech'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing name', () => {
      const result = CasServerPublicSchema.safeParse({
        id: 'cuid123'
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing id', () => {
      const result = CasServerPublicSchema.safeParse({
        name: 'Virginia Tech'
      })
      expect(result.success).toBe(false)
    })
  })
})
