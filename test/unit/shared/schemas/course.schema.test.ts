import { describe, it, expect } from 'vitest'
import { CourseContextSchema, updateCourseSettingsSchema } from '@@/shared/schemas/course.schema'

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

describe('updateCourseSettingsSchema', () => {
  it('accepts valid regex patterns for cbtf and gta interviews', () => {
    const input = {
      interviewLocation: 'McBryde 106',
      cbtfTitlePattern: '^Exam\\s[0-9]+',
      interviewTitlePattern: '^Project|Milestone'
    }
    expect(updateCourseSettingsSchema.parse(input)).toEqual(input)
  })

  it('accepts null, empty string, or undefined patterns', () => {
    const input = {
      interviewLocation: null,
      cbtfTitlePattern: null,
      interviewTitlePattern: undefined
    }
    expect(updateCourseSettingsSchema.parse(input)).toEqual(input)
  })

  it('rejects invalid regex patterns', () => {
    expect(() =>
      updateCourseSettingsSchema.parse({
        cbtfTitlePattern: '[unclosed-bracket'
      })
    ).toThrow(/Invalid regular expression pattern/)

    expect(() =>
      updateCourseSettingsSchema.parse({
        interviewTitlePattern: '*invalid-start'
      })
    ).toThrow(/Invalid regular expression pattern/)
  })
})
