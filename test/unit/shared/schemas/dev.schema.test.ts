import { describe, it, expect } from 'vitest'
import { MockLaunchSchema } from '@@/shared/schemas/dev.schema'

describe('MockLaunchSchema', () => {
  it('validates partial mock launch fields', () => {
    const valid = {
      email: 'student@example.com',
      role: 'STUDENT',
      courseTitle: 'CS 101'
    }
    expect(MockLaunchSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid email format', () => {
    expect(() => MockLaunchSchema.parse({ email: 'not-an-email' })).toThrow()
  })
})
