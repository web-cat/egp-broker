import { describe, it, expect } from 'vitest'
import {
  createPassTypeSchema,
  updatePassTypeSchema,
  passTypeDataSchema
} from '@@/shared/models/pass'

describe('Pass Type Schemas', () => {
  describe('createPassTypeSchema', () => {
    it('accepts valid pass type with 0 or positive minDaysPastDue', () => {
      const validWithZero = {
        name: 'Late Pass',
        minDaysPastDue: 0,
        maxDaysPastDue: 3
      }
      const parsedZero = createPassTypeSchema.parse(validWithZero)
      expect(parsedZero.minDaysPastDue).toBe(0)

      const validWithPositive = {
        name: 'Late Pass',
        minDaysPastDue: 2,
        maxDaysPastDue: 5
      }
      const parsedPositive = createPassTypeSchema.parse(validWithPositive)
      expect(parsedPositive.minDaysPastDue).toBe(2)

      const validWithNull = {
        name: 'Late Pass',
        minDaysPastDue: null,
        maxDaysPastDue: null
      }
      const parsedNull = createPassTypeSchema.parse(validWithNull)
      expect(parsedNull.minDaysPastDue).toBeNull()
    })

    it('rejects negative minDaysPastDue', () => {
      const invalid = {
        name: 'Late Pass',
        minDaysPastDue: -1
      }
      expect(() => createPassTypeSchema.parse(invalid)).toThrow()
    })

    it('rejects negative maxDaysPastDue', () => {
      const invalid = {
        name: 'Late Pass',
        maxDaysPastDue: -2
      }
      expect(() => createPassTypeSchema.parse(invalid)).toThrow()
    })
  })

  describe('updatePassTypeSchema', () => {
    it('rejects negative minDaysPastDue on update', () => {
      expect(() => updatePassTypeSchema.parse({ minDaysPastDue: -5 })).toThrow()
    })

    it('accepts valid minDaysPastDue on update', () => {
      expect(updatePassTypeSchema.parse({ minDaysPastDue: 0 }).minDaysPastDue).toBe(0)
      expect(updatePassTypeSchema.parse({ minDaysPastDue: 3 }).minDaysPastDue).toBe(3)
      expect(updatePassTypeSchema.parse({ minDaysPastDue: null }).minDaysPastDue).toBeNull()
    })
  })

  describe('passTypeDataSchema', () => {
    it('rejects negative minDaysPastDue', () => {
      const data = {
        id: 'pt1',
        name: 'Late Pass',
        description: null,
        extensionOnly: true,
        initialBalance: 3,
        allowRequests: false,
        hoursPerPass: 24,
        titlePattern: null,
        coolDownPeriod: null,
        coolDownUnit: null,
        coolDownReset: null,
        coolDownResetOffset: null,
        minDaysPastDue: -1,
        maxDaysPastDue: null,
        createdAt: new Date().toISOString()
      }
      expect(() => passTypeDataSchema.parse(data)).toThrow()
    })
  })
})
