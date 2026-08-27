import { describe, it, expect } from 'vitest'
import { courseSectionRowSchema } from '@@/shared/models/section'

describe('CourseSection Schema', () => {
  it('validates a valid course section row', () => {
    const valid = {
      id: 'sec-1',
      canvasSectionId: '12345',
      name: 'Section 001 - Morning',
      totalStudents: 32,
      totalOverrides: 3
    }

    const result = courseSectionRowSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('fails validation on missing required fields', () => {
    const invalid = {
      id: 'sec-1',
      name: 'Section 001'
    }

    const result = courseSectionRowSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
