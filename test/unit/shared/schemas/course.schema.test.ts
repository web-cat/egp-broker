import { describe, it, expect } from 'vitest'
import { CourseContextSchema } from '@@/shared/schemas/course.schema'

describe('CourseContextSchema', () => {
  it('validates cuid2 courseId', () => {
    const valid = { courseId: 'clh812345678901234567890' }
    expect(CourseContextSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid cuid2', () => {
    expect(() => CourseContextSchema.parse({ courseId: 'INVALID_CUID!@#' })).toThrow()
    expect(() => CourseContextSchema.parse({ courseId: 123 })).toThrow()
  })
})
