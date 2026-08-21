import { describe, it, expect } from 'vitest'
import { AdminAssignmentQuerySchema } from '@@/shared/schemas/admin.schema'

describe('AdminAssignmentQuerySchema', () => {
  it('validates empty object', () => {
    const parsed = AdminAssignmentQuerySchema.parse({})
    expect(parsed.c).toBeUndefined()
  })

  it('validates with course query string', () => {
    const parsed = AdminAssignmentQuerySchema.parse({ c: 'course-123' })
    expect(parsed.c).toBe('course-123')
  })
})
