import { describe, it, expect } from 'vitest'
import { idSchema } from '@@/shared/schemas/common.schema'

describe('idSchema', () => {
  it('validates valid UUID', () => {
    const valid = { id: '123e4567-e89b-12d3-a456-426614174000' }
    expect(idSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid UUID', () => {
    expect(() => idSchema.parse({ id: 'not-a-uuid' })).toThrow()
  })
})
